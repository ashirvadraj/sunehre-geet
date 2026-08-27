import { Playlist, Song } from '../types';
import { GoogleUserProfile } from './googleAuthService';

export interface BackupData {
  version: string;
  exportedAt: number;
  user: {
    email: string;
    name: string;
  };
  likedSongIds: string[];
  likedSongs?: Song[];
  playlists: Playlist[];
  recentSongIds: string[];
}

export const CloudSyncService = {
  async syncToGoogleCloud(
    user: GoogleUserProfile,
    data: { likedSongIds: string[]; playlists: Playlist[]; recentSongIds: string[]; likedSongs?: Song[] }
  ): Promise<boolean> {
    const payload: BackupData = {
      version: '11.0',
      exportedAt: Date.now(),
      user: {
        email: user.email,
        name: user.name,
      },
      likedSongIds: data.likedSongIds,
      likedSongs: data.likedSongs || [],
      playlists: data.playlists,
      recentSongIds: data.recentSongIds,
    };

    const jsonStr = JSON.stringify(payload);

    // 1. Session & Storage Cache
    try {
      const emailHash = Math.abs(
        user.email.toLowerCase().trim().split('').reduce((a, b) => ((a << 5) - a + b.charCodeAt(0)) | 0, 0)
      ).toString(36);
      localStorage.setItem(`sunehre_backup_${emailHash}`, jsonStr);
      localStorage.setItem('sunehre_last_backup', jsonStr);
    } catch {}

    // 2. Native Persistent Document Storage (Survives Uninstall & Clear-Data)
    try {
      const cap = (window as any).Capacitor;
      if (cap?.Plugins?.MediaNotificationPlugin?.saveLocalCloudBackup) {
        await cap.Plugins.MediaNotificationPlugin.saveLocalCloudBackup({
          email: user.email,
          data: jsonStr,
        });
      }
    } catch {}

    return true;
  },

  async fetchCloudBackup(email: string): Promise<BackupData | null> {
    const cleanEmail = email.toLowerCase().trim();
    const emailHash = Math.abs(
      cleanEmail.split('').reduce((a, b) => ((a << 5) - a + b.charCodeAt(0)) | 0, 0)
    ).toString(36);

    // 1. Check Native Persistent Storage first (survives app reinstall)
    try {
      const cap = (window as any).Capacitor;
      if (cap?.Plugins?.MediaNotificationPlugin?.loadLocalCloudBackup) {
        const res = await cap.Plugins.MediaNotificationPlugin.loadLocalCloudBackup({ email: cleanEmail });
        if (res?.success && res.data) {
          const parsed = JSON.parse(res.data);
          if (parsed && Array.isArray(parsed.likedSongIds)) {
            return parsed;
          }
        }
      }
    } catch {}

    // 2. Check LocalStorage fallback
    try {
      const raw = localStorage.getItem(`sunehre_backup_${emailHash}`) || localStorage.getItem('sunehre_last_backup');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.likedSongIds)) {
          return parsed;
        }
      }
    } catch {}

    return null;
  },
};