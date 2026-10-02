package cn.mcleng.mineleng.english.word;

import android.net.Uri;
import android.os.Bundle;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.webkit.WebViewAssetLoader;

import java.util.Collections;
import java.util.HashMap;
import java.util.Map;

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
        webView.getSettings().setDomStorageEnabled(true);   // IndexedDB/OPFS 辅助
        webView.getSettings().setAllowFileAccess(false);

        // ✅ 关键：用 WindowInsets 给 WebView 加四边 padding，避免状态栏/导航栏遮挡
        ViewCompat.setOnApplyWindowInsetsListener(webView, (v, insets) -> {
            Insets bars = insets.getInsets(WindowInsetsCompat.Type.systemBars());
            v.setPadding(bars.left, bars.top, bars.right, bars.bottom);
            return insets;
        });

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest req) {
                WebResourceResponse resp = assetLoader.shouldInterceptRequest(req.getUrl());
                // 补跨域隔离头（SQLite OPFS VFS 需要）
                if (resp != null) {
                    Map<String, String> headers = new HashMap<>();
                    headers.put("Cross-Origin-Opener-Policy", "same-origin");
                    headers.put("Cross-Origin-Embedder-Policy", "require-corp");
                    resp.setResponseHeaders(headers);
                }
                return resp;
            }

            @Override
            @SuppressWarnings("deprecation")
            public WebResourceResponse shouldInterceptRequest(WebView view, String url) {
                return shouldInterceptRequest(view, new WebResourceRequest() {
                    @NonNull @Override public Uri getUrl() { return Uri.parse(url); }
                    @NonNull @Override public Map<String, String> getRequestHeaders() {
                        return Collections.emptyMap();
                    }
                    @Override public boolean isForMainFrame() { return true; }
                    @Override public boolean hasGesture() { return false; }
                    @Override public boolean isRedirect() { return false; }
                    @NonNull @Override public String getMethod() { return "GET"; }
                });
            }
        });

        // 2. 用白名单虚拟域加载
        webView.loadUrl(VIRTUAL_HOST + "index.html");

        setContentView(webView);
    }
}