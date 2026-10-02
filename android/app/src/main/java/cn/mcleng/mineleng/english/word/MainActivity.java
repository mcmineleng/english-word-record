package cn.mcleng.mineleng.english.word;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.Bitmap;
import android.net.Uri;
import android.os.Bundle;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;

import androidx.appcompat.app.AppCompatActivity;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import androidx.webkit.WebViewAssetLoader;

import java.io.OutputStream;

public class MainActivity extends AppCompatActivity {

    private static final String VIRTUAL_HOST = "https://appassets.androidplatform.net/";
    private static final int REQ_SAVE = 2001;
    private static final int REQ_SAVE_DATA = 2002;
    private static final int REQ_PICK = 1001;

    private WebViewAssetLoader assetLoader;
    private WebView webView;

    private OutputStream pendingOs = null;
    private byte[] pendingBytes;
    private String pendingName;

    private ValueCallback<Uri[]> fileCallback;

    private static final String BLOB_SHIM_JS = """
    (function(){
      if (window.__blobShimReady) return;
      window.__blobShimReady = true;

      var CHUNK = 1024 * 1024;
      window.__canPump = false;

      AndroidBridge.onReady = function(){
        window.__canPump = true;
        window.__pump && window.__pump();
      };

      function sendBlob(blob, name){
        name = name || 'download';
        blob.arrayBuffer().then(function(buf){
          var u8 = new Uint8Array(buf);
          AndroidBridge.beginFile(name, blob.type || 'application/octet-stream', u8.length);
          var off = 0;
          window.__pump = function(){
            if(!window.__canPump) return;
            if(off >= u8.length){ AndroidBridge.endFile(); return; }
            var end = Math.min(off + CHUNK, u8.length);
            AndroidBridge.writeChunk(Array.from(u8.subarray(off, end)));
            off = end;
            setTimeout(window.__pump, 0);
          };
          window.__pump();
        });
      }

      function handleHref(href, name){
        if(href.startsWith('blob:')){
          fetch(href).then(function(r){return r.blob();}).then(function(b){sendBlob(b,name);});
          return true;
        }
        if(href.startsWith('data:')){
          var c = href.indexOf(',');
          var meta = href.substring(5, c);
          var mime = (meta.match(/^(.*?);/)||[])[1] || 'application/octet-stream';
          AndroidBridge.saveDataRaw(name, href.substring(c+1), mime);
          return true;
        }
        return false;
      }

      document.addEventListener('click', function(e){
        var a = e.target.closest('a[download]');
        if(!a) return;
        var href = a.getAttribute('href')||'';
        if(handleHref(href, a.getAttribute('download')||'download')) e.preventDefault();
      }, true);

      var _click = HTMLAnchorElement.prototype.click;
      HTMLAnchorElement.prototype.click = function(){
        var href = this.getAttribute('href')||'';
        var name = this.getAttribute('download')||'download';
        if(handleHref(href, name)) return;
        return _click.apply(this, arguments);
      };
    })();
    """;

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
        webView.addJavascriptInterface(new JSBridge(), "AndroidBridge");

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
                view.evaluateJavascript("window.__blobShimReady=false;", null);
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                view.evaluateJavascript(BLOB_SHIM_JS, null);
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
                String u = req.getUrl().toString();
                if (u.startsWith("http://") || u.startsWith("https://")) {
                    if (u.startsWith(VIRTUAL_HOST)) return false;
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

    public class JSBridge {
        @JavascriptInterface
        public void beginFile(String name, String mime, int total) {
            pendingName = name;
            Intent i = new Intent(Intent.ACTION_CREATE_DOCUMENT);
            i.addCategory(Intent.CATEGORY_OPENABLE);
            i.setType(mime.isEmpty() ? "*/*" : mime);
            i.putExtra(Intent.EXTRA_TITLE, name);
            startActivityForResult(i, REQ_SAVE);
        }

        @JavascriptInterface
        public void writeChunk(int[] arr) {
            if (pendingOs == null) return;
            byte[] b = new byte[arr.length];
            for (int i = 0; i < arr.length; i++) b[i] = (byte) arr[i];
            try { pendingOs.write(b); } catch (Exception e) { e.printStackTrace(); }
        }

        @JavascriptInterface
        public void endFile() {
            try { if (pendingOs != null) pendingOs.close(); } catch (Exception e) {}
            pendingOs = null;
        }

        @JavascriptInterface
        public void saveDataRaw(String name, String b64, String mime) {
            try {
                pendingBytes = Base64.decode(b64, Base64.DEFAULT);
                pendingName = name;
                Intent i = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                i.addCategory(Intent.CATEGORY_OPENABLE);
                i.setType(mime.isEmpty() ? "application/octet-stream" : mime);
                i.putExtra(Intent.EXTRA_TITLE, name);
                startActivityForResult(i, REQ_SAVE_DATA);
            } catch (Exception e) { e.printStackTrace(); }
        }

        @JavascriptInterface
        public void onReady() {}
    }

    @Override
    protected void onActivityResult(int req, int res, Intent data) {
        super.onActivityResult(req, res, data);

        if (req == REQ_SAVE) {
            if (res == Activity.RESULT_OK && data != null && data.getData() != null) {
                try {
                    pendingOs = getContentResolver().openOutputStream(data.getData());
                } catch (Exception e) { e.printStackTrace(); }
                webView.evaluateJavascript(
                        "if(AndroidBridge&&AndroidBridge.onReady)AndroidBridge.onReady();", null);
            }
            return;
        }

        if (req == REQ_SAVE_DATA) {
            if (res == Activity.RESULT_OK && data != null && pendingBytes != null) {
                try (OutputStream os = getContentResolver().openOutputStream(data.getData())) {
                    if (os != null) os.write(pendingBytes);
                } catch (Exception e) { e.printStackTrace(); }
            }
            pendingBytes = null;
            pendingName = null;
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

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) webView.goBack();
        else super.onBackPressed();
    }
}
