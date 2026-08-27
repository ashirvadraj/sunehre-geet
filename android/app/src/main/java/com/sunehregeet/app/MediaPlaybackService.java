package com.sunehregeet.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.net.wifi.WifiManager;
import android.os.Binder;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;
import android.support.v4.media.session.MediaSessionCompat;
import android.support.v4.media.session.PlaybackStateCompat;

import androidx.core.app.NotificationCompat;
import androidx.media.app.NotificationCompat.MediaStyle;

import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;

public class MediaPlaybackService extends Service {

    public static final String CHANNEL_ID = "sunehre_geet_playback_channel";
    public static final int NOTIFICATION_ID = 1001;

    public static final String ACTION_PLAY = "com.sunehregeet.app.ACTION_PLAY";
    public static final String ACTION_PAUSE = "com.sunehregeet.app.ACTION_PAUSE";
    public static final String ACTION_NEXT = "com.sunehregeet.app.ACTION_NEXT";
    public static final String ACTION_PREV = "com.sunehregeet.app.ACTION_PREV";

    private final IBinder binder = new LocalBinder();
    private NotificationManager notificationManager;
    private MediaSessionCompat mediaSession;
    private PowerManager.WakeLock wakeLock;
    private WifiManager.WifiLock wifiLock;
    private Bitmap lastBitmap = null;

    public class LocalBinder extends Binder {
        public MediaPlaybackService getService() {
            return MediaPlaybackService.this;
        }
    }

    @Override
    public void onCreate() {
        super.onCreate();
        notificationManager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        createNotificationChannel();

        mediaSession = new MediaSessionCompat(this, "SunehreGeetPlaybackSession");
        mediaSession.setFlags(MediaSessionCompat.FLAG_HANDLES_MEDIA_BUTTONS | MediaSessionCompat.FLAG_HANDLES_TRANSPORT_CONTROLS);
        mediaSession.setCallback(new MediaSessionCompat.Callback() {
            @Override
            public void onPlay() {
                dispatchMediaAction(ACTION_PLAY);
            }

            @Override
            public void onPause() {
                dispatchMediaAction(ACTION_PAUSE);
            }

            @Override
            public void onSkipToNext() {
                dispatchMediaAction(ACTION_NEXT);
            }

            @Override
            public void onSkipToPrevious() {
                dispatchMediaAction(ACTION_PREV);
            }
        });
        mediaSession.setActive(true);

        PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
        if (pm != null) {
            wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "sunehregeet:mediaPlaybackWakeLock");
            wakeLock.setReferenceCounted(false);
        }

        WifiManager wm = (WifiManager) getApplicationContext().getSystemService(Context.WIFI_SERVICE);
        if (wm != null) {
            wifiLock = wm.createWifiLock(WifiManager.WIFI_MODE_FULL_HIGH_PERF, "sunehregeet:mediaPlaybackWifiLock");
            wifiLock.setReferenceCounted(false);
        }
    }

    private void dispatchMediaAction(String action) {
        MediaNotificationPlugin.dispatchActionStatic(action);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null) {
            String action = intent.getAction();
            if ("STOP".equals(action)) {
                stopForegroundService();
                return START_NOT_STICKY;
            }
            String title = intent.getStringExtra("title");
            String artist = intent.getStringExtra("artist");
            boolean isPlaying = intent.getBooleanExtra("isPlaying", true);
            String coverUrl = intent.getStringExtra("coverUrl");

            if (title != null) {
                updateNotification(title, artist != null ? artist : "", isPlaying, coverUrl);
            }
        }
        return START_STICKY;
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "Music Playback Service",
                NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Continuous background playback and lockscreen media controls");
            channel.setShowBadge(false);
            channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
            if (notificationManager != null) {
                notificationManager.createNotificationChannel(channel);
            }
        }
    }

    public void updateNotification(String title, String artist, boolean isPlaying, String coverUrl) {
        if (isPlaying) {
            acquireLocks();
        } else {
            releaseLocks();
        }

        Notification notification = buildNotification(title, artist, isPlaying, lastBitmap);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
        } else {
            startForeground(NOTIFICATION_ID, notification);
        }

        if (coverUrl != null && !coverUrl.isEmpty()) {
            new Thread(() -> {
                try {
                    Bitmap bmp = null;
                    if (coverUrl.startsWith("/")) {
                        InputStream is = getAssets().open("public" + coverUrl);
                        bmp = BitmapFactory.decodeStream(is);
                    } else {
                        URL url = new URL(coverUrl);
                        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                        conn.setDoInput(true);
                        conn.connect();
                        InputStream is = conn.getInputStream();
                        bmp = BitmapFactory.decodeStream(is);
                    }
                    if (bmp != null) {
                        lastBitmap = bmp;
                        Notification updatedNotif = buildNotification(title, artist, isPlaying, bmp);
                        notificationManager.notify(NOTIFICATION_ID, updatedNotif);
                    }
                } catch (Exception ignored) {}
            }).start();
        }
    }

    private Notification buildNotification(String title, String artist, boolean isPlaying, Bitmap bitmap) {
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

        Intent prevIntent = new Intent(ACTION_PREV).setPackage(getPackageName());
        PendingIntent pPrev = PendingIntent.getBroadcast(this, 101, prevIntent, flags);

        Intent playIntent = new Intent(ACTION_PLAY).setPackage(getPackageName());
        PendingIntent pPlay = PendingIntent.getBroadcast(this, 102, playIntent, flags);

        Intent pauseIntent = new Intent(ACTION_PAUSE).setPackage(getPackageName());
        PendingIntent pPause = PendingIntent.getBroadcast(this, 103, pauseIntent, flags);

        Intent nextIntent = new Intent(ACTION_NEXT).setPackage(getPackageName());
        PendingIntent pNext = PendingIntent.getBroadcast(this, 104, nextIntent, flags);

        Intent contentIntent = new Intent(this, MainActivity.class);
        contentIntent.setFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pContent = PendingIntent.getActivity(this, 100, contentIntent, flags);

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
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

        return builder.build();
    }

    private void acquireLocks() {
        try {
            if (wakeLock != null && !wakeLock.isHeld()) {
                wakeLock.acquire(24 * 60 * 60 * 1000L); // 24 hours lock
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

    public void stopForegroundService() {
        releaseLocks();
        stopForeground(true);
        stopSelf();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return binder;
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        releaseLocks();
        if (mediaSession != null) {
            mediaSession.release();
        }
    }
}