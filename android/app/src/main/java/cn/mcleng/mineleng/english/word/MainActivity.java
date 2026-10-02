package cn.mcleng.mineleng.english.word;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.util.Log;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import androidx.webkit.WebViewAssetLoader;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;
import androidx.webkit.WebMessageCompat;
import androidx.webkit.WebMessagePortCompat;

import org.json.JSONObject;

import java.io.OutputStream;
import java.util.Collections;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

public class MainActivity extends AppCompatActivity {

    private static final String TAG = "BlobDownload";
    private static final String VIRTUAL_HOST = "https://appassets.androidplatform.net/";
    private static final String BRIDGE_NAME = "AndroidBridge";

    private static final int REQ_SAVE = 2001;   // 二进制流式下载
    private static final int REQ_PICK = 1001;

    private WebViewAssetLoader assetLoader;
    private WebView webView;

    /** 每个下载任务的运行时状态。 */
    private static class Task {
        final String id;
        String name;
        String mime;
        long total;              // -1 表示未知
        long written;
        OutputStream os;         // 写文件流（SAF 返回后打开）
        boolean safResolved;     // 用户是否已经选完路径
        boolean safCanceled;     // 用户取消了 SAF
        boolean finished;
        // 数据还没写出去时先缓存在内存（SAF 弹窗期间到达的 chunk）
        final java.io.ByteArrayOutputStream buffer = new java.io.ByteArrayOutputStream();

        Task(String id) { this.id = id; }
    }

    private final Map<String, Task> tasks = new ConcurrentHashMap<>();
    private final Map<String, String> pendingSafTaskId = new ConcurrentHashMap<>(); // requestCode 区分不了，用单个 pending 也行
    private String activeSafTaskId = null;
    private int activeSafRequestCode = -1;

    private ValueCallback<Uri[]> fileCallback;

    // ============================================================
    // 注入脚本：网页端零改动，纯注入拦截
    // ============================================================
    private static final String BOOTSTRAP_JS = """
    (function(){
      if (window.__dlShimReady) return;
      window.__dlShimReady = true;

      var CHUNK = 512 * 1024;              // 每块 512KB
      var blobMap = new Map();             // blobUrl -> Blob
      var MAX_BLOB_CACHE = 32;             // 防内存泄漏

      function cacheBlob(url, blob){
        blobMap.set(url, blob);
        if (blobMap.size > MAX_BLOB_CACHE) {
          var firstKey = blobMap.keys().next().value;
          blobMap.delete(firstKey);
        }
      }

      // ---- 1. 劫持 createObjectURL，从源头截住 Blob ----
      var _createObjectURL = URL.createObjectURL;
      URL.createObjectURL = function(obj){
        var url = _createObjectURL.call(URL, obj);
        try { if (obj instanceof Blob) cacheBlob(url, obj); } catch(e){}
        return url;
      };

      // ---- 2. 发送工具：ArrayBuffer 直接走 WebMessage ----
      function post(msg){ try { AndroidBridge.postMessage(msg); } catch(e){} }

      function sendControl(obj){ post(JSON.stringify(obj)); }

      function sendBlob(blob, name, id){
        name = name || 'download';
        blob.arrayBuffer().then(function(buf){
          sendControl({ cmd:'begin', id:id, name:name,
                        mime: blob.type || 'application/octet-stream',
                        total: buf.byteLength });
          var u8 = new Uint8Array(buf);
          var off = 0;
          function pump(){
            if (off >= u8.length) { sendControl({ cmd:'end', id:id }); return; }
            var end = Math.min(off + CHUNK, u8.length);
            // 关键：切片后是 ArrayBuffer，走二进制通道，不经过 Base64/JSON
            post(u8.subarray(off, end).slice().buffer);
            off = end;
            // 让出主线程，避免长任务卡 UI
            setTimeout(pump, 0);
          }
          pump();
        }).catch(function(err){
          sendControl({ cmd:'error', id:id, msg: String(err) });
        });
      }

      // ---- 3. data URL 处理（base64 与非 base64 都覆盖）----
      function sendDataUrl(href, name, id){
        name = name || 'download';
        var comma = href.indexOf(',');
        if (comma < 0) { sendControl({cmd:'error', id:id, msg:'bad data url'}); return; }
        var meta = href.substring(5, comma);
        var payload = href.substring(comma + 1);
        var isBase64 = /;base64/i.test(meta);
        var mime = (meta.split(';')[0] || 'application/octet-stream');

        if (isBase64) {
          // Base64 无法避免（data URL 本身就是 base64），但分块解码，避免大字符串 OOM
          var raw = payload.replace(/\\s/g, '');
          var total = Math.floor(raw.length * 3 / 4);
          sendControl({ cmd:'begin', id:id, name:name, mime:mime, total:total, base64:true });
          var i = 0;
          function pumpB64(){
            if (i >= raw.length) { sendControl({ cmd:'end', id:id }); return; }
            var end = Math.min(i + CHUNK, raw.length);
            sendControl({ cmd:'b64chunk', id:id, data: raw.substring(i, end) });
            i = end;
            setTimeout(pumpB64, 0);
          }
          pumpB64();
        } else {
          // 非 base64：URL 解码后转 UTF-8 字节
          var text;
          try { text = decodeURIComponent(payload); } catch(e){ text = payload; }
          var bytes = new TextEncoder().encode(text);
          sendControl({ cmd:'begin', id:id, name:name, mime:mime, total:bytes.length });
          post(bytes.buffer);
          sendControl({ cmd:'end', id:id });
        }
      }

      // ---- 4. 统一入口 ----
      function handleHref(href, name, id){
        if (!href) return false;
        if (href.startsWith('blob:')) {
          if (blobMap.has(href)) { sendBlob(blobMap.get(href), name, id); return true; }
          // 兜底：blob 已被 revoke 或不是本上下文创建，尝试 fetch
          fetch(href).then(function(r){ return r.blob(); })
                     .then(function(b){ sendBlob(b, name, id); })
                     .catch(function(e){ sendControl({cmd:'error', id:id, msg:String(e)}); });
          return true;
        }
        if (href.startsWith('data:')) { sendDataUrl(href, name, id); return true; }
        return false;
      }

      function newId(){ return 'dl_' + Date.now() + '_' + Math.random().toString(36).slice(2); }

      // ---- 5. 拦截 <a download> 的 click 事件 ----
      document.addEventListener('click', function(e){
        var a = e.target && e.target.closest ? e.target.closest('a[download]') : null;
        if (!a) return;
        var href = a.getAttribute('href') || '';
        var name = a.getAttribute('download') || 'download';
        if (handleHref(href, name, newId())) e.preventDefault();
      }, true);

      // ---- 6. 拦截 a.click() 程序化触发 ----
      var _click = HTMLAnchorElement.prototype.click;
      HTMLAnchorElement.prototype.click = function(){
        var href = this.getAttribute('href') || '';
        var name = this.getAttribute('download') || 'download';
        if (handleHref(href, name, newId())) return;
        return _click.apply(this, arguments);
      };

      // ---- 7. 拦截 window.open(blob:) ----
      var _open = window.open;
      window.open = function(url){
        if (typeof url === 'string' && url.startsWith('blob:') && blobMap.has(url)) {
          sendBlob(blobMap.get(url), 'download', newId());
          return null;
        }
        return _open.apply(window, arguments);
      };

      // ---- 8. 兜底：捕获未处理错误 ----
      window.addEventListener('error', function(ev){
        // 不做 UI，只在控制台留痕，避免干扰站点
        console.warn('[dl-shim]', ev.message);
      });
    })();
    """;

    // ============================================================
    // 生命周期
    // ============================================================
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        getWindow().setStatusBarColor(Color.TRANSPARENT);
        getWindow().setNavigationBarColor(Color.TRANSPARENT);
        WindowInsetsControllerCompat ctrl =
                WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        ctrl.setAppearanceLightStatusBars(true);
        ctrl.setAppearanceLightNavigationBars(true);

        assetLoader = new WebViewAssetLoader.Builder()
                .addPathHandler("/", new WebViewAssetLoader.AssetsPathHandler(this))
                .build();

        webView = new WebView(this);
        webView.getSettings().setJavaScriptEnabled(true);
        webView.getSettings().setDomStorageEnabled(true);
        webView.getSettings().setAllowFileAccess(false);
        webView.getSettings().setAllowContentAccess(false);
        webView.getSettings().setMixedContentMode(android.webkit.WebSettings.MIXED_CONTENT_NEVER_ALLOW);

        setupBridge();
        setupWebViewClients();

        webView.loadUrl(VIRTUAL_HOST + "index.html");

        FrameLayout root = new FrameLayout(this);
        root.addView(webView, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT));
        ViewCompat.setOnApplyWindowInsetsListener(root, (v, insets) -> {
            Insets bars = insets.getInsets(WindowInsetsCompat.Type.systemBars());
            v.setPadding(bars.left, bars.top, bars.right, bars.bottom);
            return insets;
        });
        setContentView(root);
    }

    // ============================================================
    // WebMessageCompat 桥
    // ============================================================
    private void setupBridge() {
        if (!WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_ARRAY_BUFFER)
                || !WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) {
            // 极老 WebView 兜底：退回到 addJavascriptInterface（此路径不支持二进制）
            Log.w(TAG, "WebMessage ArrayBuffer 不受支持，退回到 JS Interface");
            webView.addJavascriptInterface(new LegacyBridge(), BRIDGE_NAME);
            return;
        }

        WebViewCompat.addWebMessageListener(
                webView,
                BRIDGE_NAME,
                Collections.singleton(VIRTUAL_HOST.replaceAll("/$", "")),
                (view, message, sourceOrigin, isMainFrame, replyProxy) -> {
                    try {
                        if (message.getType() == WebMessageCompat.TYPE_ARRAY_BUFFER) {
                            onBinaryChunk(message.getArrayBuffer());
                        } else if (message.getType() == WebMessageCompat.TYPE_STRING) {
                            onControl(message.getData());
                        }
                    } catch (Throwable t) {
                        Log.e(TAG, "bridge error", t);
                    }
                });
    }

    private void onBinaryChunk(byte[] data) {
        if (data == null || data.length == 0) return;
        Task t = currentBinaryTask;
        if (t == null) return;
        writeToTask(t, data);
    }

    /** 当前正在接收二进制块的下载任务（单任务串行即可，因为 JS 端一次只会 pump 一个任务）。 */
    private volatile Task currentBinaryTask = null;

    private void onControl(String json) {
        try {
            JSONObject o = new JSONObject(json);
            String cmd = o.optString("cmd");
            String id = o.optString("id", UUID.randomUUID().toString());
            switch (cmd) {
                case "begin": {
                    Task t = new Task(id);
                    t.name = o.optString("name", "download");
                    t.mime = o.optString("mime", "application/octet-stream");
                    t.total = o.optLong("total", -1);
                    boolean isBase64 = o.optBoolean("base64", false);
                    t.mime = t.mime.isEmpty() ? "application/octet-stream" : t.mime;
                    tasks.put(id, t);
                    currentBinaryTask = isBase64 ? null : t; // base64 走字符串通道
                    if (isBase64) {
                        // base64 任务：用单独 buffer 暂存解码结果
                        // 这里直接用 Task.buffer 存解码后的字节
                    } else {
                        // 立即拉起 SAF
                        launchSaf(t, REQ_SAVE, t.mime, t.name);
                    }
                    break;
                }
                case "end": {
                    Task t = tasks.get(id);
                    if (t != null) {
                        t.finished = true;
                        finishTask(t);
                    }
                    break;
                }
                case "b64chunk": {
                    Task t = tasks.get(id);
                    if (t == null) break;
                    String b64 = o.optString("data", "");
                    byte[] decoded = android.util.Base64.decode(b64, android.util.Base64.DEFAULT);
                    // 首个 b64chunk 到达时拉起 SAF
                    if (!t.safResolved && !t.safCanceled) {
                        launchSaf(t, REQ_SAVE, t.mime, t.name);
                    }
                    writeToTask(t, decoded);
                    break;
                }
                case "error": {
                    Task t = tasks.remove(id);
                    if (t != null) closeQuietly(t.os);
                    Log.w(TAG, "download error: " + o.optString("msg"));
                    break;
                }
                default: break;
            }
        } catch (Throwable t) {
            Log.e(TAG, "onControl parse error", t);
        }
    }

    // ============================================================
    // SAF / 写入
    // ============================================================
    private void launchSaf(Task t, int reqCode, String mime, String name) {
        activeSafTaskId = t.id;
        activeSafRequestCode = reqCode;
        Intent i = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        i.addCategory(Intent.CATEGORY_OPENABLE);
        i.setType(mime == null || mime.isEmpty() ? "application/octet-stream" : mime);
        i.putExtra(Intent.EXTRA_TITLE, name);
        startActivityForResult(i, reqCode);
    }

    private synchronized void writeToTask(Task t, byte[] data) {
        if (t.finished) return;
        try {
            if (t.os != null) {
                t.os.write(data);
                t.written += data.length;
            } else if (!t.safCanceled) {
                // SAF 还没返回，先缓存
                t.buffer.write(data);
                t.written += data.length;
            }
        } catch (Throwable e) {
            Log.e(TAG, "write error", e);
        }
    }

    private void finishTask(Task t) {
        try {
            if (t.os == null && !t.safCanceled && t.buffer.size() > 0) {
                // SAF 还没回来，标记等到 onActivityResult 一起 flush
                t.finished = true; // 保持 buffer 直到写盘
                return;
            }
            if (t.os != null) {
                t.os.flush();
                t.os.close();
            }
        } catch (Throwable e) {
            Log.e(TAG, "finish error", e);
        } finally {
            t.os = null;
            if (currentBinaryTask == t) currentBinaryTask = null;
            tasks.remove(t.id);
        }
    }

    @Override
    protected void onActivityResult(int req, int res, Intent data) {
        super.onActivityResult(req, res, data);

        if (req == REQ_SAVE) {
            String id = activeSafTaskId;
            activeSafTaskId = null;
            Task t = id == null ? null : tasks.get(id);
            if (t == null) return;

            t.safResolved = true;
            if (res == Activity.RESULT_OK && data != null && data.getData() != null) {
                try {
                    t.os = getContentResolver().openOutputStream(data.getData(), "wt");
                    if (t.os == null) throw new Exception("openOutputStream returned null");
                    // 把缓存中的字节 flush 出去
                    if (t.buffer.size() > 0) {
                        t.os.write(t.buffer.toByteArray());
                        t.buffer.reset();
                    }
                    if (t.finished) {
                        t.os.flush();
                        t.os.close();
                        t.os = null;
                        tasks.remove(t.id);
                        if (currentBinaryTask == t) currentBinaryTask = null;
                    }
                } catch (Throwable e) {
                    Log.e(TAG, "open output error", e);
                    closeQuietly(t.os);
                    tasks.remove(t.id);
                    if (currentBinaryTask == t) currentBinaryTask = null;
                }
            } else {
                // 用户取消 SAF：丢弃任务
                t.safCanceled = true;
                closeQuietly(t.os);
                tasks.remove(t.id);
                if (currentBinaryTask == t) currentBinaryTask = null;
            }
            return;
        }

        if (req == REQ_PICK) {
            if (fileCallback != null) {
                Uri[] uris = (res == RESULT_OK && data != null)
                        ? new Uri[]{data.getData()} : null;
                fileCallback.onReceiveValue(uris);
                fileCallback = null;
            }
        }
    }

    private void closeQuietly(OutputStream os) {
        if (os != null) try { os.close(); } catch (Throwable ignored) {}
    }

    // ============================================================
    // WebViewClient / WebChromeClient
    // ============================================================
    private void setupWebViewClients() {
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView w, ValueCallback<Uri[]> cb, FileChooserParams p) {
                fileCallback = cb;
                Intent intent;
                try {
                    intent = p.createIntent();
                    if (intent == null) throw new Exception();
                } catch (Exception e) {
                    intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                    intent.addCategory(Intent.CATEGORY_OPENABLE);
                    intent.setType("*/*");
                }
                startActivityForResult(intent, REQ_PICK);
                return true;
            }
        });

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest req) {
                return assetLoader.shouldInterceptRequest(req.getUrl());
            }

            @Override
            public void onPageStarted(WebView view, String url, Bitmap fav) {
                super.onPageStarted(view, url, fav);
                // 页面开始时就注入 bootstrap（早点劫持 createObjectURL / click）
                view.evaluateJavascript(BOOTSTRAP_JS, null);
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                // 再注入一次，覆盖 SPA 动态路由
                view.evaluateJavascript(BOOTSTRAP_JS, null);
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
                String u = req.getUrl().toString();
                if (u.startsWith(VIRTUAL_HOST)) return false;
                if (u.startsWith("http://") || u.startsWith("https://")) {
                    startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(u)));
                    return true;
                }
                return false;
            }
        });

        // 老式下载（http/https 直链）走系统
        webView.setDownloadListener((url, ua, disp, mime, len) -> {
            if (url.startsWith("http://") || url.startsWith("https://")) {
                startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
            }
        });
    }

    // ============================================================
    // 极老 WebView 的降级桥（不支持 ArrayBuffer）
    // ============================================================
    private class LegacyBridge {
        @JavascriptInterface public void postMessage(String ignored) {}
        @JavascriptInterface public void postMessage(byte[] ignored) {}
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) webView.goBack();
        else super.onBackPressed();
    }
}