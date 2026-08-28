package com.sunehregeet.app;

import android.accounts.Account;
import android.accounts.AccountManager;
import android.app.Activity;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.net.wifi.WifiManager;
import android.os.Build;
import android.os.Environment;
import android.os.PowerManager;
import android.support.v4.media.session.MediaSessionCompat;
import android.support.v4.media.session.PlaybackStateCompat;

import androidx.activity.result.ActivityResult;
import androidx.core.app.NotificationCompat;
import androidx.media.app.NotificationCompat.MediaStyle;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;

@CapacitorPlugin(name = "MediaNotificationPlugin")
public class MediaNotificationPlugin extends Plugin {

    private static final String CHANNEL_ID = "sunehre_geet_media_channel";
    private static final String RECOMMENDATION_CHANNEL_ID = "sunehre_geet_recommendations";
    private static final int NOTIFICATION_ID = 1001;
    private static final int RECOMMENDATION_NOTIFICATION_ID = 2002;

    public static final String ACTION_PLAY = "com.sunehregeet.app.ACTION_PLAY";
    public static final String ACTION_PAUSE = "com.sunehregeet.app.ACTION_PAUSE";
    public static final String ACTION_NEXT = "com.sunehregeet.app.ACTION_NEXT";
    public static final String ACTION_PREV = "com.sunehregeet.app.ACTION_PREV";

    private NotificationManager notificationManager;
    private MediaSessionCompat mediaSession;
    private BroadcastReceiver actionReceiver;

    private PowerManager.WakeLock wakeLock;
    private WifiManager.WifiLock wifiLock;

    private String lastTitle = "Sunehre Geet";
    private String lastArtist = "Playing Classic Melody";
    private String lastCoverUrl = null;
    private boolean lastIsPlaying = false;
    private Bitmap lastBitmap = null;

    private static MediaNotificationPlugin sInstance;

    @Override
    public void load() {
        super.load();
        sInstance = this;
        Context context = getContext();
        notificationManager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        createNotificationChannel();

        mediaSession = new MediaSessionCompat(context, "SunehreGeetMediaSession");
        mediaSession.setFlags(MediaSessionCompat.FLAG_HANDLES_MEDIA_BUTTONS | MediaSessionCompat.FLAG_HANDLES_TRANSPORT_CONTROLS);
        mediaSession.setCallback(new MediaSessionCompat.Callback() {
            @Override
            public void onPlay() {
                dispatchAction(ACTION_PLAY);
            }

            @Override
            public void onPause() {
                dispatchAction(ACTION_PAUSE);
            }

            @Override
            public void onSkipToNext() {
                dispatchAction(ACTION_NEXT);
            }

            @Override
            public void onSkipToPrevious() {
                dispatchAction(ACTION_PREV);
            }
        });
        mediaSession.setActive(true);

        PowerManager pm = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
        if (pm != null) {
            wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "sunehregeet:mediaWakeLock");
            wakeLock.setReferenceCounted(false);
        }

        WifiManager wm = (WifiManager) context.getApplicationContext().getSystemService(Context.WIFI_SERVICE);
        if (wm != null) {
            wifiLock = wm.createWifiLock(WifiManager.WIFI_MODE_FULL_HIGH_PERF, "sunehregeet:mediaWifiLock");
            wifiLock.setReferenceCounted(false);
        }

        actionReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context ctx, Intent intent) {
                String action = intent.getAction();
                if (action != null) {
                    dispatchAction(action);
                }
            }
        };

        IntentFilter filter = new IntentFilter();
        filter.addAction(ACTION_PLAY);
        filter.addAction(ACTION_PAUSE);
        filter.addAction(ACTION_NEXT);
        filter.addAction(ACTION_PREV);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            context.registerReceiver(actionReceiver, filter, Context.RECEIVER_EXPORTED);
        } else {
            context.registerReceiver(actionReceiver, filter);
        }
    }

    public static void dispatchActionStatic(String action) {
        if (sInstance != null) {
            sInstance.dispatchAction(action);
        }
    }

    public void dispatchAction(String action) {
        if (getActivity() != null && bridge != null && bridge.getWebView() != null) {
            getActivity().runOnUiThread(() -> {
                bridge.getWebView().evaluateJavascript(
                    "window.dispatchEvent(new CustomEvent('nativeMediaAction', { detail: { action: '" + action + "' } }));",
                    null
                );
            });
        }
    }

    private void acquireLocks() {
        try {
            if (wakeLock != null && !wakeLock.isHeld()) {
                wakeLock.acquire(24 * 60 * 60 * 1000L);
            }
            if (wifiLock != null && !wifiLock.isHeld()) {
                wifiLock.acquire();
            }
        } catch (Exception ignored) {}
    }

    private void releaseLocks() {
        try {
            if (wakeLock != null && wakeLock.isHeld()) {
                wakeLock.release();
            }
            if (wifiLock != null && wifiLock.isHeld()) {
                wifiLock.release();
            }
        } catch (Exception ignored) {}
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "Music Playback Controls",
                NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Shows media controls on lock screen and notification shade");
            channel.setShowBadge(false);
            channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);

            NotificationChannel recChannel = new NotificationChannel(
                RECOMMENDATION_CHANNEL_ID,
                "दैनिक गीत सिफ़ारिशें (Song Recommendations)",
                NotificationManager.IMPORTANCE_DEFAULT
            );
            recChannel.setDescription("Shows delightful nostalgic song recommendations and classical melodies");
            recChannel.setShowBadge(true);
            recChannel.enableVibration(true);

            if (notificationManager != null) {
                notificationManager.createNotificationChannel(channel);
                notificationManager.createNotificationChannel(recChannel);
            }
        }
    }

    private void buildAndShowNotification(String title, String artist, boolean isPlaying, Bitmap bitmap) {
        Context context = getContext();
        if (context == null || notificationManager == null) return;

        int state = isPlaying ? PlaybackStateCompat.STATE_PLAYING : PlaybackStateCompat.STATE_PAUSED;
        PlaybackStateCompat.Builder stateBuilder = new PlaybackStateCompat.Builder()
            .setActions(
                PlaybackStateCompat.ACTION_PLAY |
                PlaybackStateCompat.ACTION_PAUSE |
                PlaybackStateCompat.ACTION_SKIP_TO_NEXT |
                PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS
            )
            .setState(state, PlaybackStateCompat.PLAYBACK_POSITION_UNKNOWN, 1.0f);
        mediaSession.setPlaybackState(stateBuilder.build());

        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }

        Intent prevIntent = new Intent(ACTION_PREV).setPackage(context.getPackageName());
        PendingIntent pPrev = PendingIntent.getBroadcast(context, 101, prevIntent, flags);

        Intent playIntent = new Intent(ACTION_PLAY).setPackage(context.getPackageName());
        PendingIntent pPlay = PendingIntent.getBroadcast(context, 102, playIntent, flags);

        Intent pauseIntent = new Intent(ACTION_PAUSE).setPackage(context.getPackageName());
        PendingIntent pPause = PendingIntent.getBroadcast(context, 103, pauseIntent, flags);

        Intent nextIntent = new Intent(ACTION_NEXT).setPackage(context.getPackageName());
        PendingIntent pNext = PendingIntent.getBroadcast(context, 104, nextIntent, flags);

        Intent contentIntent = new Intent(context, MainActivity.class);
        contentIntent.setFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pContent = PendingIntent.getActivity(context, 100, contentIntent, flags);

        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_media_play)
            .setContentTitle(title)
            .setContentText(artist)
            .setContentIntent(pContent)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setOngoing(isPlaying)
            .setShowWhen(false)
            .addAction(android.R.drawable.ic_media_previous, "Previous", pPrev)
            .addAction(isPlaying ? android.R.drawable.ic_media_pause : android.R.drawable.ic_media_play, isPlaying ? "Pause" : "Play", isPlaying ? pPause : pPlay)
            .addAction(android.R.drawable.ic_media_next, "Next", pNext)
            .setStyle(new MediaStyle()
                .setMediaSession(mediaSession.getSessionToken())
                .setShowActionsInCompactView(0, 1, 2)
            )
            .setPriority(NotificationCompat.PRIORITY_MAX);

        if (bitmap != null) {
            builder.setLargeIcon(bitmap);
        }

        notificationManager.notify(NOTIFICATION_ID, builder.build());
    }

    @PluginMethod
    public void updateNotification(PluginCall call) {
        lastTitle = call.getString("title", "Sunehre Geet");
        lastArtist = call.getString("artist", "Playing Classic Melody");
        lastIsPlaying = Boolean.TRUE.equals(call.getBoolean("isPlaying", true));
        String coverUrl = call.getString("coverUrl", null);
        lastCoverUrl = coverUrl;

        if (lastIsPlaying) {
            acquireLocks();
        } else {
            releaseLocks();
        }

        Context context = getContext();
        if (context != null) {
            try {
                Intent serviceIntent = new Intent(context, MediaPlaybackService.class);
                serviceIntent.putExtra("title", lastTitle);
                serviceIntent.putExtra("artist", lastArtist);
                serviceIntent.putExtra("isPlaying", lastIsPlaying);
                serviceIntent.putExtra("coverUrl", coverUrl);
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    context.startForegroundService(serviceIntent);
                } else {
                    context.startService(serviceIntent);
                }
            } catch (Exception ignored) {}
        }

        buildAndShowNotification(lastTitle, lastArtist, lastIsPlaying, lastBitmap);

        if (coverUrl != null && !coverUrl.isEmpty()) {
            new Thread(() -> {
                try {
                    Bitmap bitmap = null;
                    if (coverUrl.startsWith("/")) {
                        InputStream is = context.getAssets().open("public" + coverUrl);
                        bitmap = BitmapFactory.decodeStream(is);
                    } else {
                        URL url = new URL(coverUrl);
                        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                        conn.setDoInput(true);
                        conn.connect();
                        InputStream input = conn.getInputStream();
                        bitmap = BitmapFactory.decodeStream(input);
                    }
                    if (bitmap != null) {
                        lastBitmap = bitmap;
                        buildAndShowNotification(lastTitle, lastArtist, lastIsPlaying, bitmap);
                    }
                } catch (Exception ignored) {}
            }).start();
        }

        call.resolve();
    }

    @PluginMethod
    public void hideNotification(PluginCall call) {
        releaseLocks();
        Context context = getContext();
        if (context != null) {
            try {
                Intent serviceIntent = new Intent(context, MediaPlaybackService.class);
                serviceIntent.setAction("STOP");
                context.startService(serviceIntent);
            } catch (Exception ignored) {}
        }
        if (notificationManager != null) {
            notificationManager.cancel(NOTIFICATION_ID);
        }
        call.resolve();
    }

    @PluginMethod
    public void startOfficialGoogleSignIn(PluginCall call) {
        try {
            Intent intent = AccountManager.newChooseAccountIntent(
                null, null, new String[]{"com.google"}, null, null, null, null
            );
            startActivityForResult(call, intent, "handleGoogleAccountResult");
        } catch (Exception e) {
            call.reject("Google Sign-In failed: " + e.getMessage());
        }
    }

    @ActivityCallback
    private void handleGoogleAccountResult(PluginCall call, ActivityResult result) {
        if (result.getResultCode() == Activity.RESULT_OK && result.getData() != null) {
            String accountName = result.getData().getStringExtra(AccountManager.KEY_ACCOUNT_NAME);
            if (accountName != null && !accountName.isEmpty()) {
                JSObject ret = new JSObject();
                ret.put("success", true);
                ret.put("email", accountName);
                ret.put("name", accountName.split("@")[0]);
                ret.put("sub", "g_" + Math.abs(accountName.hashCode()));
                call.resolve(ret);
                return;
            }
        }
        JSObject ret = new JSObject();
        ret.put("success", false);
        ret.put("error", "Google Account selection cancelled.");
        call.resolve(ret);
    }

    @PluginMethod
    public void saveLocalCloudBackup(PluginCall call) {
        String email = call.getString("email", "default");
        String backupData = call.getString("data", "{}");
        try {
            File docDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOCUMENTS);
            File appDir = new File(docDir, "SunehreGeet");
            if (!appDir.exists()) {
                appDir.mkdirs();
            }
            String fileName = "backup_" + Math.abs(email.toLowerCase().trim().hashCode()) + ".json";
            File backupFile = new File(appDir, fileName);
            FileOutputStream fos = new FileOutputStream(backupFile);
            fos.write(backupData.getBytes("utf-8"));
            fos.close();

            // Save master latest backup fallback as well
            File latestFile = new File(appDir, "backup_latest.json");
            FileOutputStream fosLatest = new FileOutputStream(latestFile);
            fosLatest.write(backupData.getBytes("utf-8"));
            fosLatest.close();

            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("path", backupFile.getAbsolutePath());
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to save backup: " + e.getMessage());
        }
    }

    @PluginMethod
    public void loadLocalCloudBackup(PluginCall call) {
        String email = call.getString("email", "default");
        try {
            File docDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOCUMENTS);
            File appDir = new File(docDir, "SunehreGeet");
            String fileName = "backup_" + Math.abs(email.toLowerCase().trim().hashCode()) + ".json";
            File backupFile = new File(appDir, fileName);
            if (!backupFile.exists()) {
                backupFile = new File(appDir, "backup_latest.json");
            }
            if (backupFile.exists()) {
                FileInputStream fis = new FileInputStream(backupFile);
                BufferedReader reader = new BufferedReader(new InputStreamReader(fis, "utf-8"));
                StringBuilder sb = new StringBuilder();
                String line;
                while ((line = reader.readLine()) != null) {
                    sb.append(line);
                }
                reader.close();

                JSObject ret = new JSObject();
                ret.put("success", true);
                ret.put("data", sb.toString());
                call.resolve(ret);
                return;
            }
            JSObject ret = new JSObject();
            ret.put("success", false);
            call.resolve(ret);
        } catch (Exception e) {
            JSObject ret = new JSObject();
            ret.put("success", false);
            call.resolve(ret);
        }
    }

    @PluginMethod
    public void getDeviceGoogleAccounts(PluginCall call) {
        try {
            AccountManager am = AccountManager.get(getContext());
            Account[] accounts = am.getAccountsByType("com.google");
            JSArray arr = new JSArray();
            if (accounts != null) {
                for (Account acc : accounts) {
                    JSObject o = new JSObject();
                    o.put("name", acc.name.split("@")[0]);
                    o.put("email", acc.name);
                    arr.put(o);
                }
            }
            JSObject ret = new JSObject();
            ret.put("accounts", arr);
            call.resolve(ret);
        } catch (Exception e) {
            JSObject ret = new JSObject();
            ret.put("accounts", new JSArray());
            call.resolve(ret);
        }
    }

    @PluginMethod
    public void fetchHttpUrl(PluginCall call) {
        String urlStr = call.getString("url", "");
        if (urlStr.isEmpty()) {
            call.reject("URL required");
            return;
        }

        new Thread(() -> {
            try {
                URL url = new URL(urlStr);
                HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod("GET");
                conn.setRequestProperty("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)");
                conn.setConnectTimeout(2800);
                conn.setReadTimeout(2800);

                int code = conn.getResponseCode();
                if (code >= 200 && code < 300) {
                    BufferedReader in = new BufferedReader(new InputStreamReader(conn.getInputStream(), "UTF-8"));
                    StringBuilder sb = new StringBuilder();
                    String line;
                    while ((line = in.readLine()) != null) {
                        sb.append(line).append("\n");
                    }
                    in.close();

                    JSObject ret = new JSObject();
                    ret.put("content", sb.toString());
                    call.resolve(ret);
                } else {
                    JSObject ret = new JSObject();
                    ret.put("content", "");
                    call.resolve(ret);
                }
            } catch (Exception e) {
                JSObject ret = new JSObject();
                ret.put("content", "");
                call.resolve(ret);
            }
        }).start();
    }

    @PluginMethod
    public void sendSongRecommendation(PluginCall call) {
        String phrase = call.getString("phrase", "मौसम है सुहाना, सुनिए यह सदाबहार तराना 🎶");
        String songTitle = call.getString("songTitle", "Sunehre Geet");
        String songArtist = call.getString("songArtist", "Evergreen Melody");
        String songId = call.getString("songId", "");
        String coverUrl = call.getString("coverUrl", "");

        Context context = getContext();
        if (context == null || notificationManager == null) {
            call.reject("Context unavailable");
            return;
        }

        new Thread(() -> {
            try {
                Bitmap bitmap = null;
                if (coverUrl != null && !coverUrl.isEmpty()) {
                    try {
                        URL url = new URL(coverUrl);
                        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                        conn.setDoInput(true);
                        conn.setConnectTimeout(3000);
                        conn.setReadTimeout(3000);
                        conn.connect();
                        InputStream input = conn.getInputStream();
                        bitmap = BitmapFactory.decodeStream(input);
                    } catch (Exception ignored) {}
                }

                if (bitmap == null) {
                    try {
                        bitmap = BitmapFactory.decodeResource(context.getResources(), R.drawable.splash);
                    } catch (Exception ignored) {}
                }

                Intent intent = new Intent(context, MainActivity.class);
                intent.putExtra("recommendationSongId", songId);
                intent.putExtra("autoPlay", true);
                intent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);

                int flags = PendingIntent.FLAG_UPDATE_CURRENT;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    flags |= PendingIntent.FLAG_IMMUTABLE;
                }
                PendingIntent pendingIntent = PendingIntent.getActivity(context, (int) System.currentTimeMillis(), intent, flags);

                NotificationCompat.Builder builder = new NotificationCompat.Builder(context, RECOMMENDATION_CHANNEL_ID)
                    .setSmallIcon(R.mipmap.ic_launcher)
                    .setContentTitle(phrase)
                    .setContentText(songTitle + " • " + songArtist)
                    .setContentIntent(pendingIntent)
                    .setAutoCancel(true)
                    .setPriority(NotificationCompat.PRIORITY_HIGH)
                    .setDefaults(Notification.DEFAULT_ALL)
                    .setVisibility(NotificationCompat.VISIBILITY_PUBLIC);

                if (bitmap != null) {
                    builder.setLargeIcon(bitmap);
                    builder.setStyle(new NotificationCompat.BigPictureStyle()
                        .bigPicture(bitmap)
                        .setBigContentTitle(phrase)
                        .setSummaryText(songTitle + " — " + songArtist));
                } else {
                    builder.setStyle(new NotificationCompat.BigTextStyle()
                        .bigText(songTitle + "\nगायक: " + songArtist + "\n\nक्लिक करें और सुनिए यह ख़ास नगमा!"));
                }

                notificationManager.notify(RECOMMENDATION_NOTIFICATION_ID, builder.build());

                JSObject ret = new JSObject();
                ret.put("success", true);
                call.resolve(ret);
            } catch (Exception e) {
                call.reject("Failed: " + e.getMessage());
            }
        }).start();
    }
}