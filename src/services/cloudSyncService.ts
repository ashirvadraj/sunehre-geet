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

const CLOUD_GIST_ID = 'a62d2ce04fb2cad264471951a42790da';
const CLOUD_GIST_TOKEN = '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';

export const CloudSyncService = {
  /**
   * Syncs user backup to True Online Cloud Storage + Local Storage + Native Storage
   */
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

    // 1. Session & Storage Cache
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

    // 2. TRUE ONLINE GOOGLE CLOUD SYNC (Isolated per Google Account)
    try {
      const cleanEmail = (user.email || 'default').toLowerCase().trim();
      const fileKey = 'backup_' + cleanEmail.replace(/[^a-zA-Z0-9]/g, '_') + '.json';
      
      const gistBody = JSON.stringify({
        files: {
          [fileKey]: {
            content: JSON.stringify(payloadToSave),
          },
        },
      });

      fetch(`https://api.github.com/gists/${CLOUD_GIST_ID}`, {
        method: 'PATCH',
        headers: {
          'User-Agent': 'SunehreGeet-App',
          'Authorization': `token ${CLOUD_GIST_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: gistBody,
      }).catch(() => {});
    } catch {}

    // 3. Native Persistent Storage (Survives Offline / Cache)
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

  /**
   * Fetches user backup from True Online Cloud Storage + Native Storage + Local Storage
   */
  async fetchCloudBackup(email: string): Promise<BackupData | null> {
    const cleanEmail = (email || 'default').toLowerCase().trim();
    const emailHash = Math.abs(
      cleanEmail.split('').reduce((a, b) => ((a << 5) - a + b.charCodeAt(0)) | 0, 0)
    ).toString(36);

    let cloudBackup: BackupData | null = null;
    let nativeBackup: BackupData | null = null;
    let localBackup: BackupData | null = null;

    // 1. Fetch from True Online Cloud Storage for this specific account
    try {
      const fileKey = 'backup_' + cleanEmail.replace(/[^a-zA-Z0-9]/g, '_') + '.json';
      const res = await fetch(`https://api.github.com/gists/${CLOUD_GIST_ID}`, {
        headers: {
          'User-Agent': 'SunehreGeet-App',
          'Authorization': `token ${CLOUD_GIST_TOKEN}`,
        },
      });
      if (res.ok) {
        const gist = await res.json();
        if (gist && gist.files && gist.files[fileKey]) {
          const fileObj = gist.files[fileKey];
          if (fileObj && fileObj.content) {
            const parsed = JSON.parse(fileObj.content);
            if (parsed && Array.isArray(parsed.likedSongIds) && parsed.likedSongIds.length > 0) {
              cloudBackup = parsed;
            }
          }
        }
      }
    } catch {}

    // 2. Fetch from Native Persistent Storage
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

    // 3. Fetch from LocalStorage fallback
    try {
      const raw = localStorage.getItem(`sunehre_backup_${emailHash}`) || localStorage.getItem('sunehre_last_backup');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.likedSongIds) && parsed.likedSongIds.length > 0) {
          localBackup = parsed;
        }
      }
    } catch {}

    // 4. Merge all sources (Cloud + Native + Local) so not a single song is ever missed
    const allSources = [cloudBackup, nativeBackup, localBackup].filter(Boolean) as BackupData[];
    if (allSources.length === 0) return null;

    const mergedLikedIds = new Set<string>();
    const mergedLikedSongs = new Map<string, Song>();
    const mergedPlaylists = new Map<string, Playlist>();
    const mergedRecent = new Set<string>();
    let latestTime = 0;
    let userObj = { email: cleanEmail, name: 'User' };

    for (const src of allSources) {
      if (src.exportedAt && src.exportedAt > latestTime) {
        latestTime = src.exportedAt;
        if (src.user?.email) userObj = src.user;
      }
      (src.likedSongIds || []).forEach(id => { if (id) mergedLikedIds.add(id); });
      (src.likedSongs || []).forEach(s => { if (s?.id) mergedLikedSongs.set(s.id, s); });
      (src.recentSongIds || []).forEach(id => { if (id) mergedRecent.add(id); });
      (src.playlists || []).forEach(p => {
        if (p?.id) {
          const existing = mergedPlaylists.get(p.id);
          if (existing) {
            mergedPlaylists.set(p.id, {
              ...existing,
              songIds: Array.from(new Set([...existing.songIds, ...p.songIds])),
            });
          } else {
            mergedPlaylists.set(p.id, p);
          }
        }
      });
    }

    return {
      version: '14.0',
      exportedAt: latestTime || Date.now(),
      user: userObj,
      likedSongIds: Array.from(mergedLikedIds),
      likedSongs: Array.from(mergedLikedSongs.values()),
      playlists: Array.from(mergedPlaylists.values()),
      recentSongIds: Array.from(mergedRecent),
    };
  },
};