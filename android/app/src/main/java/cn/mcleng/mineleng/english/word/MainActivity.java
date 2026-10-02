package cn.mcleng.mineleng.english.word;

import android.Manifest;
import android.annotation.SuppressLint;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.os.Environment;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;

import androidx.annotation.JavascriptInterface;
import androidx.annotation.Nullable;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import androidx.webkit.WebViewAssetLoader;

import java.io.OutputStream;
import java.util.HashMap;
import java.util.Map;

public class MainActivity extends AppCompatActivity {

    // ====================== 配置 ======================
    private static final String VIRTUAL_HOST = "https://appassets.androidplatform.net/";
    private static final int REQ_SAVE   = 2001; // SAF 另存为
    private static final int REQ_PICK   = 1001; // SAF 打开（导入）
    // =================================================

    private WebViewAssetLoader assetLoader;
    private WebView webView;

    // 暂存待写出的字节（SAF 拿到 Uri 后再落盘）
    private byte[] pendingBytes;
    private String pendingMime;

    // 文件选择器回调
    private ValueCallback<Uri[]> fileCallback;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);

        // ---- 全屏 / 状态栏 ----
        getWindow().setStatusBarColor(Color.TRANSPARENT);
        getWindow().setNavigationBarColor(Color.TRANSPARENT);
        WindowInsetsControllerCompat ctrl =
                WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        ctrl.setAppearanceLightStatusBars(true);
        ctrl.setAppearanceLightNavigationBars(true);

        // ---- AssetLoader ----
        assetLoader = new WebViewAssetLoader.Builder()
                .addPathHandler("/", new WebViewAssetLoader.AssetsPathHandler(this))
                .build();

        // ---- WebView ----
        webView = new WebView(this);
        webView.getSettings().setJavaScriptEnabled(true);
        webView.getSettings().setDomStorageEnabled(true);
        webView.getSettings().setAllowFileAccess(false);

        // JS → 原生桥：保存文件
        webView.addJavascriptInterface(new JSBridge(), "AndroidBridge");

        // 文件选择（导入）→ 直接 SAF
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView w, ValueCallback<Uri[]> cb,
                                             FileChooserParams p) {
                fileCallback = cb;
                Intent intent = p.createIntent(); // 已带 acceptType / mode
                // 兜底：若 createIntent 不可用，走 OPEN_DOCUMENT
                if (intent == null) {
                    intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                    intent.addCategory(Intent.CATEGORY_OPENABLE);
                    intent.setType("*/*");
                }
                startActivityForResult(intent, REQ_PICK);
                return true;
            }
        });

        // 资源拦截 + 外链跳转 + 下载兜底
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest req) {
                return assetLoader.shouldInterceptRequest(req.getUrl());
            }

            // 外链跳浏览器
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
                return handleExternalUrl(req.getUrl().toString());
            }

            private boolean handleExternalUrl(String url) {
                if (url.startsWith("http://") || url.startsWith("https://")) {
                    if (url.startsWith(VIRTUAL_HOST)) return false; // 自家资产走 WebView
                    startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
                    return true;
                }
                return false; // blob:/data:/其它协议不拦截
            }
        });

        // 下载监听：blob/data 由 JSBridge 处理；外链兜底跳浏览器
        webView.setDownloadListener((url, userAgent, contentDisposition, mimeType, contentLength) -> {
            if (url.startsWith("blob:") || url.startsWith("data:")) {
                // 不应走到这里，网页须用 AndroidBridge.saveFile
                return;
            }
            if (url.startsWith("http://") || url.startsWith("https://")) {
                startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
            }
        });

        webView.loadUrl(VIRTUAL_HOST + "index.html");

        // ---- 根布局 + 系统栏 padding ----
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

    // =================== JS Bridge ===================
    public class JSBridge {
        /**
         * 网页调用：AndroidBridge.saveFile("demo.txt", "dGVzdA==", "text/plain");
         */
        @JavascriptInterface
        public void saveFile(String fileName, String base64, @Nullable String mimeType) {
            try {
                byte[] bytes = android.util.Base64.decode(base64, android.util.Base64.DEFAULT);
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

    // =================== Activity Result ===================
    @Override
    protected void onActivityResult(int requestCode, int resultCode, @Nullable Intent data) {
        super.onActivityResult(requestCode, resultCode, data);

        // SAF 另存为（blob/data 下载）
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

        // SAF 打开（导入）
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
