import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { Playlist, Song } from '../types';
import { SONGS } from '../data/songs';
import { useAuth } from './AuthContext';
import { CloudSyncService } from '../services/cloudSyncService';

interface PlaylistContextType {
  likedSongIds: string[];
  favorites: Song[];
  playlists: Playlist[];
  recentSongIds: string[];
  toggleLike: (songId: string, songObj?: Song) => void;
  isLiked: (songId: string) => boolean;
  toggleFavorite: (songId: string, songObj?: Song) => void;
  isFavorite: (songId: string) => boolean;
  createPlaylist: (name: string, description?: string) => Playlist;
  deletePlaylist: (playlistId: string) => void;
  addSongToPlaylist: (playlistId: string, songOrId: string | Song) => void;
  removeSongFromPlaylist: (playlistId: string, songId: string) => void;
  addToRecent: (songId: string) => void;
  getSongById: (id: string) => Song | undefined;
  restoreUserData: (likedIds?: string[], restoredPlaylists?: Playlist[], recentIds?: string[], restoredSongs?: Song[]) => void;
  restoreFromCloud: (customEmail?: string) => Promise<{ success: boolean; count: number }>;
}

const PlaylistContext = createContext<PlaylistContextType | undefined>(undefined);

const STORAGE_KEYS = {
  LIKED: 'sunehre_geet_liked',
  LIKED_MAP: 'sunehre_geet_liked_map_v2',
  PLAYLISTS: 'sunehre_geet_playlists',
  RECENT: 'sunehre_geet_recent',
};

const DEFAULT_PLAYLISTS: Playlist[] = [
  {
    id: 'pl-golden-duets',
    name: 'Evergreen Golden Duets',
    description: 'Immortal romantic dialogues between Lata, Kishore, Rafi, and Hemant Kumar.',
    coverUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600&auto=format&fit=crop&q=80',
    songIds: ['sg-PNHIkJPr', 'sg-U3wEEo6F'],
    isCustom: false,
    createdAt: Date.now() - 1000000,
  }
];

export const PlaylistProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, syncNow } = useAuth();
  const syncTimeoutRef = useRef<any>(null);
  const hasInitialRestoreAttempted = useRef<boolean>(false);

  const [likedSongIds, setLikedSongIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.LIKED);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [likedSongsMap, setLikedSongsMap] = useState<Record<string, Song>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.LIKED_MAP);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const [playlists, setPlaylists] = useState<Playlist[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.PLAYLISTS);
      return saved ? JSON.parse(saved) : DEFAULT_PLAYLISTS;
    } catch {
      return DEFAULT_PLAYLISTS;
    }
  });

  const [recentSongIds, setRecentSongIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.RECENT);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.LIKED, JSON.stringify(likedSongIds));
  }, [likedSongIds]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.LIKED_MAP, JSON.stringify(likedSongsMap));
  }, [likedSongsMap]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.PLAYLISTS, JSON.stringify(playlists));
  }, [playlists]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.RECENT, JSON.stringify(recentSongIds));
  }, [recentSongIds]);

  const restoreFromCloud = async (customEmail?: string): Promise<{ success: boolean; count: number }> => {
    const emailToUse = customEmail || user?.email || 'default';
    const backup = await CloudSyncService.fetchCloudBackup(emailToUse);
    if (backup) {
      let count = 0;
      if (backup.likedSongs && Array.isArray(backup.likedSongs) && backup.likedSongs.length > 0) {
        const map: Record<string, Song> = {};
        backup.likedSongs.forEach((s: any) => { if (s && s.id) map[s.id] = s; });
        setLikedSongsMap(prev => ({ ...prev, ...map }));
      }
      if (backup.likedSongIds && Array.isArray(backup.likedSongIds) && backup.likedSongIds.length > 0) {
        setLikedSongIds(prev => Array.from(new Set([...prev, ...backup.likedSongIds])));
        count = backup.likedSongIds.length;
      }
      if (backup.playlists && Array.isArray(backup.playlists) && backup.playlists.length > 0) {
        setPlaylists(prev => {
          const m = new Map<string, Playlist>();
          [...prev, ...backup.playlists].forEach(p => m.set(p.id, p));
          return Array.from(m.values());
        });
      }
      if (backup.recentSongIds && Array.isArray(backup.recentSongIds) && backup.recentSongIds.length > 0) {
        setRecentSongIds(prev => Array.from(new Set([...prev, ...backup.recentSongIds])));
      }
      hasInitialRestoreAttempted.current = true;
      return { success: true, count };
    }
    hasInitialRestoreAttempted.current = true;
    return { success: false, count: 0 };
  };

  // On App Launch (Fresh Install / Reinstall): Auto-restore latest persistent phone backup
  useEffect(() => {
    const autoRestoreIfEmpty = async () => {
      const savedLiked = localStorage.getItem(STORAGE_KEYS.LIKED);
      if (!savedLiked || savedLiked === '[]' || (JSON.parse(savedLiked || '[]').length === 0)) {
        await restoreFromCloud(user?.email);
      } else {
        hasInitialRestoreAttempted.current = true;
      }
    };
    autoRestoreIfEmpty();
  }, [user]);

  // Listen to song playback across the entire app and cache song objects
  useEffect(() => {
    const handleSongPlayed = (e: any) => {
      const song = e.detail?.song;
      if (song && song.id) {
        setRecentSongIds(prev => [song.id, ...prev.filter(id => id !== song.id)].slice(0, 50));
        setLikedSongsMap(prev => ({ ...prev, [song.id]: song }));
      }
    };
    window.addEventListener('sunehreSongPlayed', handleSongPlayed);
    return () => window.removeEventListener('sunehreSongPlayed', handleSongPlayed);
  }, []);

  const favorites: Song[] = likedSongIds
    .map(id => likedSongsMap[id] || SONGS.find(s => s.id === id))
    .filter(Boolean) as Song[];

  // Automatic Real-Time Local & Cloud Backup (Always keeps phone backup up to date)
  useEffect(() => {
    if (!hasInitialRestoreAttempted.current) return;
    if (likedSongIds.length === 0 && playlists.length <= 1 && recentSongIds.length === 0) return;

    clearTimeout(syncTimeoutRef.current);
    syncTimeoutRef.current = setTimeout(() => {
      const userProfile = user || {
        email: 'local_user@sunehregeet.app',
        name: 'Local User',
        picture: '',
        sub: 'local_default',
        provider: 'google' as const,
        lastLoginAt: Date.now(),
      };
      CloudSyncService.syncToGoogleCloud(
        userProfile,
        { likedSongIds, playlists, recentSongIds, likedSongs: favorites }
      );
    }, 1000);
    return () => clearTimeout(syncTimeoutRef.current);
  }, [likedSongIds, playlists, recentSongIds, user, likedSongsMap]);

  const toggleLike = (songId: string, songObj?: Song) => {
    const song = songObj || likedSongsMap[songId] || SONGS.find(s => s.id === songId);
    if (song) {
      setLikedSongsMap(prev => ({ ...prev, [songId]: song }));
    }

    setLikedSongIds(prev => {
      const next = prev.includes(songId) ? prev.filter(id => id !== songId) : [...prev, songId];
      return next;
    });
  };

  const isLiked = (songId: string) => likedSongIds.includes(songId);
  const toggleFavorite = (songId: string, songObj?: Song) => toggleLike(songId, songObj);
  const isFavorite = (songId: string) => isLiked(songId);

  const createPlaylist = (name: string, description: string = '') => {
    const newPlaylist: Playlist = {
      id: `custom-pl-${Date.now()}`,
      name,
      description,
      coverUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&auto=format&fit=crop&q=80',
      songIds: [],
      isCustom: true,
      createdAt: Date.now(),
    };
    setPlaylists(prev => [newPlaylist, ...prev]);
    return newPlaylist;
  };

  const deletePlaylist = (playlistId: string) => {
    setPlaylists(prev => prev.filter(p => p.id !== playlistId));
  };

  const addSongToPlaylist = (playlistId: string, songOrId: string | Song) => {
    const sId = typeof songOrId === 'string' ? songOrId : songOrId.id;
    setPlaylists(prev =>
      prev.map(pl => {
        if (pl.id === playlistId && !pl.songIds.includes(sId)) {
          return { ...pl, songIds: [...pl.songIds, sId] };
        }
        return pl;
      })
    );
  };

  const removeSongFromPlaylist = (playlistId: string, songId: string) => {
    setPlaylists(prev =>
      prev.map(pl => {
        if (pl.id === playlistId) {
          return { ...pl, songIds: pl.songIds.filter(id => id !== songId) };
        }
        return pl;
      })
    );
  };

  const addToRecent = (songId: string) => {
    setRecentSongIds(prev => [songId, ...prev.filter(id => id !== songId)].slice(0, 30));
  };

  const getSongById = (id: string) => likedSongsMap[id] || SONGS.find(s => s.id === id);

  /**
   * Restore User Data from Cloud or Backup File
   */
  const restoreUserData = (restoredLiked?: string[], restoredPlaylists?: Playlist[], restoredRecent?: string[], restoredSongs?: Song[]) => {
    if (restoredLiked && Array.isArray(restoredLiked)) {
      setLikedSongIds(prev => Array.from(new Set([...prev, ...restoredLiked])));
    }
    if (restoredSongs && Array.isArray(restoredSongs)) {
      setLikedSongsMap(prev => {
        const next = { ...prev };
        restoredSongs.forEach(s => {
          if (s && s.id) next[s.id] = s;
        });
        return next;
      });
      const ids = restoredSongs.map(s => s.id).filter(Boolean);
      setLikedSongIds(prev => Array.from(new Set([...prev, ...ids])));
    }
    if (restoredPlaylists && Array.isArray(restoredPlaylists)) {
      setPlaylists(prev => {
        const map = new Map<string, Playlist>();
        [...prev, ...restoredPlaylists].forEach(p => map.set(p.id, p));
        return Array.from(map.values());
      });
    }
    if (restoredRecent && Array.isArray(restoredRecent)) {
      setRecentSongIds(prev => Array.from(new Set([...prev, ...restoredRecent])).slice(0, 30));
    }
  };

  return (
    <PlaylistContext.Provider
      value={{
        likedSongIds,
        favorites,
        playlists,
        recentSongIds,
        toggleLike,
        isLiked,
        toggleFavorite,
        isFavorite,
        createPlaylist,
        deletePlaylist,
        addSongToPlaylist,
        removeSongFromPlaylist,
        addToRecent,
        getSongById,
        restoreUserData,
        restoreFromCloud,
      }}
    >
      {children}
    </PlaylistContext.Provider>
  );
};

export const usePlaylist = () => {
  const context = useContext(PlaylistContext);
  if (!context) throw new Error('usePlaylist must be used within PlaylistProvider');
  return context;
};

// Aliases for compatibility
export const usePlaylists = usePlaylist;