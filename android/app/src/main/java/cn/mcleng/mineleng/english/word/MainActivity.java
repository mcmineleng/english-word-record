package cn.mcleng.mineleng.english.word;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.Color;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Bundle;
import android.util.Log;
import android.view.Gravity;
import android.view.View;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;

import androidx.appcompat.app.AppCompatActivity;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import androidx.webkit.WebMessageCompat;
import androidx.webkit.WebViewAssetLoader;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.OutputStream;
import java.util.Collections;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

public class MainActivity extends AppCompatActivity {

    private static final String TAG = "BlobDownload";
    private static final String VIRTUAL_HOST = "https://appassets.androidplatform.net/";
    private static final String BRIDGE_NAME = "AndroidBridge";

    private static final int REQ_SAVE = 2001;
    private static final int REQ_PICK = 1001;

    private WebViewAssetLoader assetLoader;
    private WebView webView;

    // ---------- 下载任务 ----------
    private static class Task {
        final String id;
        String name;
        String mime;
        long total = -1;
        long written = 0;
        boolean finished = false;
        final ByteArrayOutputStream buffer = new ByteArrayOutputStream();

        Task(String id) { this.id = id; }
    }

    private final Map<String, Task> tasks = new ConcurrentHashMap<>();
    private volatile Task currentBinaryTask = null;
    private String activeSafTaskId = null;

    // ---------- 文件选择 ----------
    private ValueCallback<Uri[]> fileCallback;

    // ---------- 悬浮进度视图 ----------
    private LinearLayout floatingView;
    private TextView tvTitle;
    private TextView tvProgress;
    private ProgressBar pbProgress;
    private long lastUiUpdate = 0;

    // ============================================================
    // 注入脚本：网页端零改动
    // ============================================================
    private static final String BOOTSTRAP_JS = """
    (function(){
      if (window.__dlShimReady) return;
      window.__dlShimReady = true;

      var CHUNK = 512 * 1024;
      var blobMap = new Map();
      var MAX_BLOB_CACHE = 32;

      function cacheBlob(url, blob){
        blobMap.set(url, blob);
        if (blobMap.size > MAX_BLOB_CACHE) {
          var firstKey = blobMap.keys().next().value;
          blobMap.delete(firstKey);
        }
      }

      var _createObjectURL = URL.createObjectURL;
      URL.createObjectURL = function(obj){
        var url = _createObjectURL.call(URL, obj);
        try { if (obj instanceof Blob) cacheBlob(url, obj); } catch(e){}
        return url;
      };

      function post(msg){ try { AndroidBridge.postMessage(msg); } catch(e){} }
      function sendControl(obj){ post(JSON.stringify(obj)); }
      function newId(){ return 'dl_' + Date.now() + '_' + Math.random().toString(36).slice(2); }

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
            post(u8.subarray(off, end).slice().buffer);
            off = end;
            setTimeout(pump, 0);
          }
          pump();
        }).catch(function(err){
          sendControl({ cmd:'error', id:id, msg: String(err) });
        });
      }

      function sendDataUrl(href, name, id){
        name = name || 'download';
        var comma = href.indexOf(',');
        if (comma < 0) { sendControl({cmd:'error', id:id, msg:'bad data url'}); return; }
        var meta = href.substring(5, comma);
        var payload = href.substring(comma + 1);
        var isBase64 = /;base64/i.test(meta);
        var mime = (meta.split(';')[0] || 'application/octet-stream');

        if (isBase64) {
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
          var text;
          try { text = decodeURIComponent(payload); } catch(e){ text = payload; }
          var bytes = new TextEncoder().encode(text);
          sendControl({ cmd:'begin', id:id, name:name, mime:mime, total:bytes.length });
          post(bytes.buffer);
          sendControl({ cmd:'end', id:id });
        }
      }

      function handleHref(href, name, id){
        if (!href) return false;
        if (href.startsWith('blob:')) {
          if (blobMap.has(href)) { sendBlob(blobMap.get(href), name, id); return true; }
          fetch(href).then(function(r){ return r.blob(); })
                     .then(function(b){ sendBlob(b, name, id); })
                     .catch(function(e){ sendControl({cmd:'error', id:id, msg:String(e)}); });
          return true;
        }
        if (href.startsWith('data:')) { sendDataUrl(href, name, id); return true; }
        return false;
      }

      document.addEventListener('click', function(e){
        var a = e.target && e.target.closest ? e.target.closest('a[download]') : null;
        if (!a) return;
        var href = a.getAttribute('href') || '';
        var name = a.getAttribute('download') || 'download';
        if (handleHref(href, name, newId())) e.preventDefault();
      }, true);

      var _click = HTMLAnchorElement.prototype.click;
      HTMLAnchorElement.prototype.click = function(){
        var href = this.getAttribute('href') || '';
        var name = this.getAttribute('download') || 'download';
        if (handleHref(href, name, newId())) return;
        return _click.apply(this, arguments);
      };

      var _open = window.open;
      window.open = function(url){
        if (typeof url === 'string' && url.startsWith('blob:') && blobMap.has(url)) {
          sendBlob(blobMap.get(url), 'download', newId());
          return null;
        }
        return _open.apply(window, arguments);
      };

      window.addEventListener('error', function(ev){
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
        webView.getSettings().setMixedContentMode(
                android.webkit.WebSettings.MIXED_CONTENT_NEVER_ALLOW);

        setupBridge();
        setupWebViewClients();

        webView.loadUrl(VIRTUAL_HOST + "index.html");

        FrameLayout root = new FrameLayout(this);
        root.addView(webView, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT));

        initFloatingView(root);

        ViewCompat.setOnApplyWindowInsetsListener(root, (v, insets) -> {
            Insets bars = insets.getInsets(WindowInsetsCompat.Type.systemBars());
            v.setPadding(bars.left, bars.top, bars.right, bars.bottom);
            return insets;
        });
        setContentView(root);
    }

    // ============================================================
    // 纯 Java 悬浮进度视图
    // ============================================================
    private void initFloatingView(FrameLayout root) {
        float density = getResources().getDisplayMetrics().density;

        floatingView = new LinearLayout(this);
        floatingView.setOrientation(LinearLayout.VERTICAL);

        GradientDrawable bg = new GradientDrawable();
        bg.setColor(0xCC000000);
        bg.setCornerRadius(12 * density);
        floatingView.setBackground(bg);

        int padH = (int) (16 * density);
        int padV = (int) (12 * density);
        floatingView.setPadding(padH, padV, padH, padV);
        floatingView.setVisibility(View.GONE);

        tvTitle = new TextView(this);
        tvTitle.setText("正在处理 Blob 数据");
        tvTitle.setTextColor(0xFFFFFFFF);
        tvTitle.setTextSize(13);
        floatingView.addView(tvTitle);

        tvProgress = new TextView(this);
        tvProgress.setText("0 MiB / 0 MiB");
        tvProgress.setTextColor(0xFFFFFFFF);
        tvProgress.setTextSize(13);
        LinearLayout.LayoutParams tp = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT,
                LinearLayout.LayoutParams.WRAP_CONTENT);
        tp.topMargin = (int) (4 * density);
        tvProgress.setLayoutParams(tp);
        floatingView.addView(tvProgress);

        pbProgress = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        pbProgress.setMax(100);
        pbProgress.setProgress(0);
        LinearLayout.LayoutParams pp = new LinearLayout.LayoutParams(
                (int) (220 * density),
                (int) (4 * density));
        pp.topMargin = (int) (8 * density);
        pbProgress.setLayoutParams(pp);
        floatingView.addView(pbProgress);

        FrameLayout.LayoutParams lp = new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.WRAP_CONTENT,
                FrameLayout.LayoutParams.WRAP_CONTENT);
        lp.gravity = Gravity.BOTTOM | Gravity.CENTER_HORIZONTAL;
        lp.bottomMargin = (int) (48 * density);
        root.addView(floatingView, lp);
    }

    private void showProgress(String name, long written, long total) {
        if (floatingView == null) return;
        floatingView.setVisibility(View.VISIBLE);

        String writtenStr = formatSize(written);
        if (total > 0) {
            String totalStr = formatSize(total);
            int pct = (int) (written * 100 / total);
            tvTitle.setText("正在处理 Blob 数据");
            tvProgress.setText("处理进度：" + writtenStr + " / " + totalStr);
            pbProgress.setProgress(pct);
        } else {
            tvTitle.setText("正在处理 Blob 数据");
            tvProgress.setText("已处理：" + writtenStr);
            pbProgress.setProgress(0);
        }
    }

    private void setProgressReady() {
        if (floatingView == null) return;
        tvTitle.setText("数据处理完成");
        tvProgress.setText("请选择保存位置");
        pbProgress.setProgress(100);
    }

    private void hideProgress() {
        if (floatingView != null) floatingView.setVisibility(View.GONE);
    }

    private void maybeUpdateProgress(String name, long written, long total) {
        long now = System.currentTimeMillis();
        if (now - lastUiUpdate < 100 && written < total) return;
        lastUiUpdate = now;
        runOnUiThread(() -> showProgress(name, written, total));
    }

    private static String formatSize(long bytes) {
        if (bytes < 1024) return bytes + " B";
        double kb = bytes / 1024.0;
        if (kb < 1024) return String.format(Locale.US, "%.1f KiB", kb);
        double mb = kb / 1024.0;
        if (mb < 1024) return String.format(Locale.US, "%.1f MiB", mb);
        double gb = mb / 1024.0;
        return String.format(Locale.US, "%.2f GiB", gb);
    }

    // ============================================================
    // WebMessageCompat 桥
    // ============================================================
    private void setupBridge() {
        if (!WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_ARRAY_BUFFER)
                || !WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) {
            Log.e(TAG, "当前 WebView 不支持 ArrayBuffer 消息，无法处理 blob 下载");
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
        if (t == null) {
            Log.w(TAG, "binary chunk dropped: no current task, len=" + data.length);
            return;
        }
        writeToTask(t, data);
    }

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
                    currentBinaryTask = isBase64 ? null : t;
                    runOnUiThread(() -> showProgress(t.name, 0, t.total));
                    Log.d(TAG, "begin id=" + id + " name=" + t.name
                            + " total=" + t.total + " base64=" + isBase64);
                    break;
                }
                case "end": {
                    Task t = tasks.get(id);
                    if (t != null) {
                        t.finished = true;
                        Log.d(TAG, "end id=" + id + " buffered=" + t.buffer.size());
                        runOnUiThread(this::setProgressReady);
                        launchSaf(t, t.mime, t.name);
                    }
                    break;
                }
                case "b64chunk": {
                    Task t = tasks.get(id);
                    if (t == null) break;
                    String b64 = o.optString("data", "");
                    byte[] decoded = android.util.Base64.decode(b64, android.util.Base64.DEFAULT);
                    writeToTask(t, decoded);
                    break;
                }
                case "error": {
                    Task t = tasks.remove(id);
                    if (currentBinaryTask == t) currentBinaryTask = null;
                    runOnUiThread(this::hideProgress);
                    Log.w(TAG, "download error: " + o.optString("msg"));
                    break;
                }
                default:
                    break;
            }
        } catch (Throwable t) {
            Log.e(TAG, "onControl parse error", t);
        }
    }

    // ============================================================
    // 写入缓存
    // ============================================================
    private synchronized void writeToTask(Task t, byte[] data) {
        if (t.finished) return;
        try {
            t.buffer.write(data);
            t.written += data.length;
            maybeUpdateProgress(t.name, t.written, t.total);
        } catch (Throwable e) {
            Log.e(TAG, "write error", e);
        }
    }

    // ============================================================
    // SAF
    // ============================================================
    private void launchSaf(Task t, String mime, String name) {
        activeSafTaskId = t.id;
        Intent i = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        i.addCategory(Intent.CATEGORY_OPENABLE);
        i.setType(mime == null || mime.isEmpty() ? "application/octet-stream" : mime);
        i.putExtra(Intent.EXTRA_TITLE, name);
        startActivityForResult(i, REQ_SAVE);
    }

    @Override
    protected void onActivityResult(int req, int res, Intent data) {
        super.onActivityResult(req, res, data);

        if (req == REQ_SAVE) {
            String id = activeSafTaskId;
            activeSafTaskId = null;
            Task t = id == null ? null : tasks.get(id);
            if (t != null) {
                if (res == Activity.RESULT_OK && data != null && data.getData() != null) {
                    OutputStream os = null;
                    try {
                        os = getContentResolver().openOutputStream(data.getData(), "wt");
                        if (os == null) throw new Exception("openOutputStream returned null");
                        byte[] all = t.buffer.toByteArray();
                        os.write(all);
                        os.flush();
                        Log.d(TAG, "saved id=" + id + " bytes=" + all.length);
                    } catch (Throwable e) {
                        Log.e(TAG, "open/write error", e);
                    } finally {
                        if (os != null) try { os.close(); } catch (Throwable ignored) {}
                    }
                } else {
                    Log.d(TAG, "saf canceled id=" + id);
                }
                t.buffer.reset();
                tasks.remove(t.id);
                if (currentBinaryTask == t) currentBinaryTask = null;
            }
            runOnUiThread(this::hideProgress);
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

    // ============================================================
    // WebViewClient / WebChromeClient
    // ============================================================
    private void setupWebViewClients() {
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView w, ValueCallback<Uri[]> cb,
                                             FileChooserParams p) {
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
            public WebResourceResponse shouldInterceptRequest(WebView view,
                                                              WebResourceRequest req) {
                return assetLoader.shouldInterceptRequest(req.getUrl());
            }

            @Override
            public void onPageStarted(WebView view, String url, Bitmap fav) {
                super.onPageStarted(view, url, fav);
                view.evaluateJavascript(BOOTSTRAP_JS, null);
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
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

        webView.setDownloadListener((url, ua, disp, mime, len) -> {
            if (url.startsWith("http://") || url.startsWith("https://")) {
                startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
            }
        });
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) webView.goBack();
        else super.onBackPressed();
    }
}