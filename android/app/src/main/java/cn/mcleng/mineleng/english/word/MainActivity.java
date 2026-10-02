package cn.mcleng.mineleng.english.word;

import android.os.Bundle;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.appcompat.app.AppCompatActivity;
import androidx.webkit.WebViewAssetLoader;

import java.io.InputStream;

public class MainActivity extends AppCompatActivity {

    // ✅ 官方白名单虚拟域，Chromium 认作 secure context
    private static final String VIRTUAL_HOST = "https://appassets.androidplatform.net/";

    private WebViewAssetLoader assetLoader;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // 1. AssetLoader：把 "/" 映射到 assets 根目录
        assetLoader = new WebViewAssetLoader.Builder()
                .addPathHandler("/", new WebViewAssetLoader.AssetsPathHandler(this))
                .build();

        WebView webView = new WebView(this);
        webView.getSettings().setJavaScriptEnabled(true);
        // 注意：不再需要 AllowUniversalAccessFromFileURLs
        webView.getSettings().setDomStorageEnabled(true);   // IndexedDB/OPFS 辅助
        webView.getSettings().setAllowFileAccess(false);

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest req) {
                WebResourceResponse resp = assetLoader.shouldInterceptRequest(req.getUrl());
                // 补跨域隔离头（SQLite OPFS VFS 需要）
                if (resp != null) {
                    resp.setResponseHeaders(java.util.Map.of(
                            "Cross-Origin-Opener-Policy", "same-origin",
                            "Cross-Origin-Embedder-Policy", "require-corp"
                    ));
                }
                return resp;
            }

            @Override
            @SuppressWarnings("deprecation")
            public WebResourceResponse shouldInterceptRequest(WebView view, String url) {
                return shouldInterceptRequest(view,
                        new android.webkit.WebResourceRequest() {
                            @Override public android.net.Uri getUrl() { return android.net.Uri.parse(url); }
                            @Override public java.util.Map<String, String> getRequestHeaders() { return null; }
                            @Override public boolean isForMainFrame() { return true; }
                            @Override public boolean hasGesture() { return false; }
                            @Override public boolean isRedirect() { return false; }
                            @Override public String getMethod() { return "GET"; }
                        });
            }
        });

        // 2. 用白名单虚拟域加载
        webView.loadUrl(VIRTUAL_HOST + "index.html");

        setContentView(webView);
    }
}
