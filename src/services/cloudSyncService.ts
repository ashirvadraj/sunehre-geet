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
      version: '14.0',
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

    // 1. Session & Storage Cache (Merge with existing storage to prevent any loss)
    let payloadToSave = payload;
    try {
      const emailHash = Math.abs(
        user.email.toLowerCase().trim().split('').reduce((a, b) => ((a << 5) - a + b.charCodeAt(0)) | 0, 0)
      ).toString(36);

      const existingRaw = localStorage.getItem(`sunehre_backup_${emailHash}`) || localStorage.getItem('sunehre_last_backup');
      if (existingRaw) {
        try {
          const existing: BackupData = JSON.parse(existingRaw);
          if (existing && Array.isArray(existing.likedSongIds) && existing.likedSongIds.length > payload.likedSongIds.length) {
            // Existing backup has more songs: merge them!
            const mergedIds = Array.from(new Set([...payload.likedSongIds, ...existing.likedSongIds]));
            const songsMap = new Map<string, Song>();
            (existing.likedSongs || []).forEach(s => { if (s?.id) songsMap.set(s.id, s); });
            (payload.likedSongs || []).forEach(s => { if (s?.id) songsMap.set(s.id, s); });

            payloadToSave = {
              ...payload,
              likedSongIds: mergedIds,
              likedSongs: Array.from(songsMap.values()),
            };
          }
        } catch {}
      }

      const jsonStr = JSON.stringify(payloadToSave);
      localStorage.setItem(`sunehre_backup_${emailHash}`, jsonStr);
      localStorage.setItem('sunehre_last_backup', jsonStr);
    } catch {}

    // 2. Native Persistent Document Storage (Survives Uninstall & Clear-Data)
    try {
      const cap = (window as any).Capacitor;
      if (cap?.Plugins?.MediaNotificationPlugin?.saveLocalCloudBackup) {
        await cap.Plugins.MediaNotificationPlugin.saveLocalCloudBackup({
          email: user.email,
          data: JSON.stringify(payloadToSave),
        });
      }
    } catch {}

    return true;
  },

  async fetchCloudBackup(email: string): Promise<BackupData | null> {
    const cleanEmail = (email || 'default').toLowerCase().trim();
    const emailHash = Math.abs(
      cleanEmail.split('').reduce((a, b) => ((a << 5) - a + b.charCodeAt(0)) | 0, 0)
    ).toString(36);

    let nativeBackup: BackupData | null = null;
    let localBackup: BackupData | null = null;

    // 1. Check Native Persistent Storage (multi-directory & multi-file scanner & merger in Java)
    try {
      const cap = (window as any).Capacitor;
      if (cap?.Plugins?.MediaNotificationPlugin?.loadLocalCloudBackup) {
        const res = await cap.Plugins.MediaNotificationPlugin.loadLocalCloudBackup({ email: cleanEmail });
        if (res?.success && res.data) {
          const parsed = JSON.parse(res.data);
          if (parsed && Array.isArray(parsed.likedSongIds) && parsed.likedSongIds.length > 0) {
            nativeBackup = parsed;
          }
        }
      }
    } catch {}

    // 2. Check LocalStorage fallback
    try {
      const raw = localStorage.getItem(`sunehre_backup_${emailHash}`) || localStorage.getItem('sunehre_last_backup');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.likedSongIds) && parsed.likedSongIds.length > 0) {
          localBackup = parsed;
        }
      }
    } catch {}

    // 3. Merge native and local backups so that every song is recovered
    if (nativeBackup && localBackup) {
      const mergedIds = Array.from(new Set([...nativeBackup.likedSongIds, ...localBackup.likedSongIds]));
      const songsMap = new Map<string, Song>();
      (localBackup.likedSongs || []).forEach(s => { if (s?.id) songsMap.set(s.id, s); });
      (nativeBackup.likedSongs || []).forEach(s => { if (s?.id) songsMap.set(s.id, s); });

      const mergedPlaylistsMap = new Map<string, Playlist>();
      (localBackup.playlists || []).forEach(p => { if (p?.id) mergedPlaylistsMap.set(p.id, p); });
      (nativeBackup.playlists || []).forEach(p => {
        if (p?.id) {
          const existing = mergedPlaylistsMap.get(p.id);
          if (existing) {
            mergedPlaylistsMap.set(p.id, {
              ...existing,
              songIds: Array.from(new Set([...existing.songIds, ...p.songIds])),
            });
          } else {
            mergedPlaylistsMap.set(p.id, p);
          }
        }
      });

      const mergedRecent = Array.from(new Set([...(nativeBackup.recentSongIds || []), ...(localBackup.recentSongIds || [])]));

      return {
        version: '14.0',
        exportedAt: Math.max(nativeBackup.exportedAt || 0, localBackup.exportedAt || 0),
        user: nativeBackup.user?.email ? nativeBackup.user : localBackup.user,
        likedSongIds: mergedIds,
        likedSongs: Array.from(songsMap.values()),
        playlists: Array.from(mergedPlaylistsMap.values()),
        recentSongIds: mergedRecent,
      };
    }

    return nativeBackup || localBackup || null;
  },
};