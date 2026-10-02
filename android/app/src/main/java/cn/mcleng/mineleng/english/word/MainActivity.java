package cn.mcleng.mineleng.english.word;

import android.Manifest;
import android.annotation.SuppressLint;
import android.content.Intent;
import android.graphics.Color;
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
    private static final int REQ_PICK = 1001;

    private WebViewAssetLoader assetLoader;
    private WebView webView;

    private byte[] pendingBytes;
    private String pendingMime;

    private ValueCallback<Uri[]> fileCallback;

    @SuppressLint("SetJavaScriptEnabled")
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
            public boolean onShowFileChooser(WebView w, ValueCallback<Uri[]> cb,
                                             FileChooserParams p) {
                fileCallback = cb;
                Intent intent = p.createIntent();
                if (intent == null) {
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
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
                return handleExternalUrl(req.getUrl().toString());
            }

            private boolean handleExternalUrl(String url) {
                if (url.startsWith("http://") || url.startsWith("https://")) {
                    if (url.startsWith(VIRTUAL_HOST)) return false;
                    startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
                    return true;
                }
                return false;
            }
        });

        webView.setDownloadListener((url, ua, disp, mime, len) -> {
            if (url.startsWith("blob:") || url.startsWith("data:")) return;
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
        public void saveFile(String fileName, String base64, String mimeType) {
            try {
                byte[] bytes = Base64.decode(base64, Base64.DEFAULT);
                pendingBytes = bytes;
                pendingMime = mimeType != null ? mimeType : "application/octet-stream";
                Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType(pendingMime);
                intent.putExtra(Intent.EXTRA_TITLE, fileName);
                startActivityForResult(intent, REQ_SAVE);
            } catch (Exception e) {
                e.printStackTrace();
            }
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);

        if (requestCode == REQ_SAVE) {
            if (resultCode == RESULT_OK && data != null && data.getData() != null
                    && pendingBytes != null) {
                try (OutputStream os = getContentResolver().openOutputStream(data.getData())) {
                    if (os != null) os.write(pendingBytes);
                } catch (Exception e) {
                    e.printStackTrace();
                }
            }
            pendingBytes = null;
            pendingMime = null;
            return;
        }

        if (requestCode == REQ_PICK) {
            if (fileCallback != null) {
                Uri[] uris = (resultCode == RESULT_OK && data != null)
                        ? new Uri[]{data.getData()} : null;
                fileCallback.onReceiveValue(uris);
                fileCallback = null;
            }
        }
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }
}
