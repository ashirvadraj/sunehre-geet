package com.sunehregeet.app;

import android.app.NotificationManager;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.view.WindowManager;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(MediaNotificationPlugin.class);
        super.onCreate(savedInstanceState);
        
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        // Request all runtime permissions ONCE on launch (notifications, microphone for voice search, storage)
        android.content.SharedPreferences permsPrefs = getSharedPreferences("sunehre_permissions_pref", Context.MODE_PRIVATE);
        boolean alreadyRequested = permsPrefs.getBoolean("has_requested_all_permissions_once", false);
        if (!alreadyRequested) {
            java.util.List<String> permissionsToRequest = new java.util.ArrayList<>();
            
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                if (checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                    permissionsToRequest.add(android.Manifest.permission.POST_NOTIFICATIONS);
                }
                if (checkSelfPermission(android.Manifest.permission.READ_MEDIA_AUDIO) != PackageManager.PERMISSION_GRANTED) {
                    permissionsToRequest.add(android.Manifest.permission.READ_MEDIA_AUDIO);
                }
            } else {
                if (checkSelfPermission(android.Manifest.permission.READ_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED) {
                    permissionsToRequest.add(android.Manifest.permission.READ_EXTERNAL_STORAGE);
                }
            }

            if (checkSelfPermission(android.Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
                permissionsToRequest.add(android.Manifest.permission.RECORD_AUDIO);
            }

            if (!permissionsToRequest.isEmpty()) {
                requestPermissions(permissionsToRequest.toArray(new String[0]), 101);
            }
            permsPrefs.edit().putBoolean("has_requested_all_permissions_once", true).apply();
        }

        if (getBridge() != null && getBridge().getWebView() != null) {
            WebView webView = getBridge().getWebView();
            WebSettings settings = webView.getSettings();
            settings.setCacheMode(WebSettings.LOAD_NO_CACHE);
            settings.setMediaPlaybackRequiresUserGesture(false);
            settings.setJavaScriptEnabled(true);
            settings.setDomStorageEnabled(true);
            settings.setDatabaseEnabled(true);
            settings.setAllowFileAccess(true);
            settings.setAllowContentAccess(true);
            webView.clearCache(true);
        }

        handleRecommendationIntent(getIntent());
    }

    @Override
    public void onNewIntent(android.content.Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleRecommendationIntent(intent);
    }

    private void handleRecommendationIntent(android.content.Intent intent) {
        if (intent != null && intent.hasExtra("recommendationSongId")) {
            String songId = intent.getStringExtra("recommendationSongId");
            if (songId != null && !songId.isEmpty()) {
                if (getBridge() != null && getBridge().getWebView() != null) {
                    getBridge().getWebView().postDelayed(() -> {
                        getBridge().getWebView().evaluateJavascript(
                            "window.dispatchEvent(new CustomEvent('playRecommendedSong', { detail: { songId: '" + songId + "' } }));",
                            null
                        );
                    }, 500);
                }
            }
        }
    }

    @Override
    public void onResume() {
        super.onResume();
        handleRecommendationIntent(getIntent());
        if (getBridge() != null && getBridge().getWebView() != null) {
            WebView webView = getBridge().getWebView();
            WebSettings settings = webView.getSettings();
            settings.setMediaPlaybackRequiresUserGesture(false);
            webView.resumeTimers();
        }
    }

    @Override
    public void onPause() {
        super.onPause();
        if (getBridge() != null && getBridge().getWebView() != null) {
            getBridge().getWebView().resumeTimers();
        }
    }

    @Override
    public void onStop() {
        super.onStop();
        if (getBridge() != null && getBridge().getWebView() != null) {
            getBridge().getWebView().resumeTimers();
        }
    }

    @Override
    public void onDestroy() {
        try {
            NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null) {
                nm.cancel(1001);
            }
        } catch (Exception ignored) {}
        super.onDestroy();
    }
}