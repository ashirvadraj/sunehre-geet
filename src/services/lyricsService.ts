// Unified Real-Time Synced Lyrics Service (LRCLIB Synced LRC + JioSaavn + Offline Cache)
import { Song } from '../types';

export interface LyricLine {
  time: number; // seconds
  text: string;
}

export interface LyricsData {
  isSynced: boolean;
  lines: LyricLine[];
  plainText: string;
}

const LYRICS_CACHE_PREFIX = 'sunehre_geet_lyrics_v2_';

function cleanTrackName(name: string): string {
  if (!name) return '';
  return name
    .replace(/"/g, '"')
    .replace(/'/g, "'")
    .replace(/&/g, '&')
    .replace(/\s*\(From\s+["'][^"']+["']\)/gi, '')
    .replace(/\s*\[From\s+["'][^"']+["']\]/gi, '')
    .replace(/\s*\(Duet Version\)/gi, '')
    .replace(/\s*\(Female Version\)/gi, '')
    .replace(/\s*\(Male Version\)/gi, '')
    .replace(/\s*\(Original[^)]*\)/gi, '')
    .replace(/^Song:\s*/i, '')
    .trim();
}

/**
 * Parses LRC formatted string into timestamped LyricLine array
 */
export function parseLrcString(lrcText: string): LyricsData {
  if (!lrcText) {
    return { isSynced: false, lines: [], plainText: '' };
  }

  const timeRegex = /\[(\d{2}):(\d{2})(?:\.(\d{1,3}))?\]/g;
  const rawLines = lrcText.split('\n');
  const parsedLines: LyricLine[] = [];
  const plainTextArr: string[] = [];

  let hasTimestamp = false;

  for (const line of rawLines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('[ti:') || trimmed.startsWith('[ar:') || trimmed.startsWith('[al:') || trimmed.startsWith('[by:')) {
      continue;
    }

    const matches = [...trimmed.matchAll(timeRegex)];
    if (matches.length > 0) {
      hasTimestamp = true;
      const cleanText = trimmed.replace(timeRegex, '').trim();
      if (!cleanText) continue;

      for (const match of matches) {
        const min = parseInt(match[1], 10);
        const sec = parseInt(match[2], 10);
        const ms = match[3] ? parseFloat('0.' + match[3]) : 0;
        const totalSec = min * 60 + sec + ms;
        parsedLines.push({ time: totalSec, text: cleanText });
        plainTextArr.push(cleanText);
      }
    } else {
      plainTextArr.push(trimmed);
    }
  }

  if (!hasTimestamp && plainTextArr.length > 0) {
    // Pure plain text lyrics without timestamps
    return {
      isSynced: false,
      lines: plainTextArr.map(text => ({ time: 0, text })),
      plainText: plainTextArr.join('\n'),
    };
  }

  // Sort by timestamp
  parsedLines.sort((a, b) => a.time - b.time);

  return {
    isSynced: hasTimestamp && parsedLines.length > 0,
    lines: parsedLines,
    plainText: plainTextArr.join('\n'),
  };
}

async function nativeFetchText(targetUrl: string, timeoutMs: number = 1800): Promise<string | null> {
  // 1. Try Native Android Http Plugin (CORS-free, fast)
  try {
    const cap = (window as any).Capacitor;
    if (cap?.Plugins?.MediaNotificationPlugin?.fetchHttpUrl) {
      const res = await cap.Plugins.MediaNotificationPlugin.fetchHttpUrl({ url: targetUrl });
      if (res && res.content && res.content.trim().length > 0) {
        return res.content;
      }
    }
  } catch (e) {}

  // 2. Web fetch fallback with strict timeout
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(targetUrl, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (res.ok) {
      return await res.text();
    }
  } catch (e) {}

  return null;
}

const IN_MEMORY_LYRICS_CACHE = new Map<string, LyricsData>();

async function fetchLrclibExact(cleanTitle: string, cleanArtist: string): Promise<LyricsData | null> {
  try {
    const lrcUrl = `https://lrclib.net/api/search?track_name=${encodeURIComponent(cleanTitle)}&artist_name=${encodeURIComponent(cleanArtist)}`;
    const text = await nativeFetchText(lrcUrl, 1800);
    if (text) {
      const data = JSON.parse(text);
      if (Array.isArray(data) && data.length > 0) {
        // Strongly prefer synced lyrics over plain text
        const syncedItem = data.find((d: any) => d.syncedLyrics && d.syncedLyrics.length > 20);
        if (syncedItem) {
          return parseLrcString(syncedItem.syncedLyrics);
        }
        // Fallback to plain lyrics
        const plainItem = data.find((d: any) => d.plainLyrics && d.plainLyrics.length > 20);
        if (plainItem) {
          return parseLrcString(plainItem.plainLyrics);
        }
      }
    }
  } catch {}
  return null;
}

async function fetchLrclibQuery(cleanTitle: string): Promise<LyricsData | null> {
  try {
    const lrcUrl = `https://lrclib.net/api/search?q=${encodeURIComponent(cleanTitle)}`;
    const text = await nativeFetchText(lrcUrl, 1800);
    if (text) {
      const data = JSON.parse(text);
      if (Array.isArray(data) && data.length > 0) {
        const item = data.find((d: any) => d.syncedLyrics) || data[0];
        const rawLrc = item.syncedLyrics || item.plainLyrics;
        if (rawLrc && rawLrc.length > 20) {
          return parseLrcString(rawLrc);
        }
      }
    }
  } catch {}
  return null;
}

async function fetchJioSaavnDirect(songId: string): Promise<LyricsData | null> {
  try {
    const jioId = songId.startsWith('sg-') ? songId.replace('sg-', '') : (songId.startsWith('online-') ? songId.replace('online-', '') : null);
    if (!jioId) return null;
    const jioUrl = `https://www.jiosaavn.com/api.php?__call=lyrics.getLyrics&_format=json&_marker=0&api_version=4&ctx=web6dot0&lyrics_id=${jioId}`;
    const text = await nativeFetchText(jioUrl, 1800);
    if (text) {
      const data = JSON.parse(text);
      if (data && data.lyrics) {
        const formatted = String(data.lyrics)
          .replace(/<br\s*[\/]?>/gi, '\n')
          .replace(/<[^>]+>/g, '')
          .trim();
        if (formatted.length > 20) {
          return parseLrcString(formatted);
        }
      }
    }
  } catch {}
  return null;
}

async function fetchJioSaavnBySearch(cleanTitle: string, cleanArtist: string): Promise<LyricsData | null> {
  try {
    const query = `${cleanTitle} ${cleanArtist}`.trim();
    const searchUrl = `https://www.jiosaavn.com/api.php?__call=search.getResults&_format=json&_marker=0&api_version=4&ctx=web6dot0&n=2&p=1&q=${encodeURIComponent(query)}`;
    const searchText = await nativeFetchText(searchUrl, 1500);
    if (!searchText) return null;
    const searchData = JSON.parse(searchText);
    if (searchData?.results && Array.isArray(searchData.results) && searchData.results.length > 0) {
      const best = searchData.results[0];
      if (best && best.id) {
        const lyrUrl = `https://www.jiosaavn.com/api.php?__call=lyrics.getLyrics&_format=json&_marker=0&api_version=4&ctx=web6dot0&lyrics_id=${best.id}`;
        const lyrText = await nativeFetchText(lyrUrl, 1500);
        if (lyrText) {
          const lyrData = JSON.parse(lyrText);
          if (lyrData && lyrData.lyrics) {
            const formatted = String(lyrData.lyrics)
              .replace(/<br\s*[\/]?>/gi, '\n')
              .replace(/<[^>]+>/g, '')
              .trim();
            if (formatted.length > 20) {
              return parseLrcString(formatted);
            }
          }
        }
      }
    }
  } catch {}
  return null;
}

function raceForFirstValid(promises: Promise<LyricsData | null>[]): Promise<LyricsData | null> {
  return new Promise((resolve) => {
    let resolved = false;
    let pending = promises.length;
    let bestPlainResult: LyricsData | null = null;

    const finish = (result: LyricsData | null) => {
      if (resolved) return;
      resolved = true;
      resolve(result);
    };

    promises.forEach((p) => {
      p.then((res) => {
        if (resolved) return;
        if (res && res.lines && res.lines.length > 0) {
          if (res.isSynced) {
            // Synced lyrics found — resolve immediately, this is the best outcome
            finish(res);
            return;
          } else if (!bestPlainResult) {
            // Plain text lyrics — hold it, wait a bit more for a synced result
            bestPlainResult = res;
          }
        }
        pending--;
        if (pending === 0 && !resolved) {
          finish(bestPlainResult);
        }
      }).catch(() => {
        pending--;
        if (pending === 0 && !resolved) {
          finish(bestPlainResult);
        }
      });
    });

    // After 800ms, if we have plain text and synced is still waiting, accept plain text
    setTimeout(() => {
      if (!resolved && bestPlainResult) {
        finish(bestPlainResult);
      }
    }, 800);

    // Hard fallback timeout: 1.8s maximum
    setTimeout(() => {
      if (!resolved) {
        finish(bestPlainResult);
      }
    }, 1800);
  });
}

export async function fetchLyricsForSong(song: Song): Promise<LyricsData | null> {
  if (!song || !song.title) return null;

  // 1. Direct song object lyrics
  if (song.lyrics && song.lyrics.trim().length > 10) {
    return parseLrcString(song.lyrics);
  }

  // 2. Ultra-Fast In-Memory Cache (0ms instant response)
  if (IN_MEMORY_LYRICS_CACHE.has(song.id)) {
    return IN_MEMORY_LYRICS_CACHE.get(song.id)!;
  }

  const cacheKey = `${LYRICS_CACHE_PREFIX}${song.id}`;

  // 3. LocalStorage Cache (Instant)
  try {
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed && Array.isArray(parsed.lines) && parsed.lines.length > 0) {
        IN_MEMORY_LYRICS_CACHE.set(song.id, parsed);
        return parsed;
      }
    }
  } catch {}

  const cleanTitle = cleanTrackName(song.title);
  const cleanArtist = (song.artist || '').split(',')[0].split('ft.')[0].split('-')[0].trim();

  // 4. PARALLEL Fast Race across All Sources simultaneously
  try {
    const promises: Promise<LyricsData | null>[] = [
      fetchLrclibExact(cleanTitle, cleanArtist),
      fetchLrclibQuery(cleanTitle),
      fetchJioSaavnDirect(song.id),
      fetchJioSaavnBySearch(cleanTitle, cleanArtist),
    ];

    const winner = await raceForFirstValid(promises);
    if (winner && winner.lines && winner.lines.length > 0) {
      IN_MEMORY_LYRICS_CACHE.set(song.id, winner);
      try { localStorage.setItem(cacheKey, JSON.stringify(winner)); } catch {}
      return winner;
    }
  } catch {}

  return null;
}