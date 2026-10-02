package cn.mcleng.mineleng.english.word;

import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
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

import java.util.Collections;
import java.util.HashMap;
import java.util.Map;

public class MainActivity extends AppCompatActivity {

    private static final String VIRTUAL_HOST = "https://appassets.androidplatform.net/";

    private WebViewAssetLoader assetLoader;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        Window window = getWindow();

        // ✅ 1. 让窗口延伸到系统栏下面（全屏、Edge-to-Edge）
        WindowCompat.setDecorFitsSystemWindows(window, false);

        // ✅ 2. 状态栏透明（否则默认可能是灰/白条，看着像"盖住"）
        window.setStatusBarColor(Color.TRANSPARENT);
        window.setNavigationBarColor(Color.TRANSPARENT);

        // ✅ 3. 深色图标（浅色背景网页用深色图标；深色网页改成 false）
        WindowInsetsControllerCompat controller =
                WindowCompat.getInsetsController(window, window.getDecorView());
        controller.setAppearanceLightStatusBars(true);
        controller.setAppearanceLightNavigationBars(true);

        // 4. AssetLoader
        assetLoader = new WebViewAssetLoader.Builder()
                .addPathHandler("/", new WebViewAssetLoader.AssetsPathHandler(this))
                .build();

        WebView webView = new WebView(this);
        webView.getSettings().setJavaScriptEnabled(true);
        webView.getSettings().setDomStorageEnabled(true);
        webView.getSettings().setAllowFileAccess(false);

        // ✅ 5. 外层容器承载 padding，比直接给 WebView 加更可靠
        FrameLayout root = new FrameLayout(this);
        root.addView(webView, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT));

        ViewCompat.setOnApplyWindowInsetsListener(root, (v, insets) -> {
            Insets bars = insets.getInsets(WindowInsetsCompat.Type.systemBars());
            android.util.Log.d("INSETS", "top=" + bars.top
                    + " bottom=" + bars.bottom
                    + " left=" + bars.left
                    + " right=" + bars.right);
            v.setPadding(bars.left, bars.top, bars.right, bars.bottom);
            return insets;
        });

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest req) {
                WebResourceResponse resp = assetLoader.shouldInterceptRequest(req.getUrl());
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
                    @Override public Uri getUrl() { return Uri.parse(url); }
                    @Override public Map<String, String> getRequestHeaders() {
                        return Collections.emptyMap();
                    }
                    @Override public boolean isForMainFrame() { return true; }
                    @Override public boolean hasGesture() { return false; }
                    @Override public boolean isRedirect() { return false; }
                    @Override public String getMethod() { return "GET"; }
                });
            }
        });

        webView.loadUrl(VIRTUAL_HOST + "index.html");
        setContentView(root);
    }
}