import { Song } from '../types';

export interface VideoData {
  videoId: string;
  title: string;
  thumbnailUrl: string;
  embedUrl: string;
}

const VIDEO_CACHE_PREFIX = 'sunehre_geet_video_v3_';
const IN_MEMORY_VIDEO_CACHE = new Map<string, VideoData>();

function cleanTrackName(name: string): string {
  if (!name) return '';
  return name
    .replace(/"/g, '')
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

function cleanArtistName(artist: string): string {
  if (!artist) return '';
  return artist
    .split(',')[0]
    .split(/\s+ft\.?\s+/i)[0]
    .split(/\s+feat\.?\s+/i)[0]
    .split(' - ')[0]
    .split(' & ')[0]
    .trim();
}

function cleanMovieName(movie: string): string {
  if (!movie) return '';
  return movie.split('(')[0].split('-')[0].trim();
}

async function nativeFetchText(targetUrl: string, timeoutMs: number = 2500): Promise<string | null> {
  // 1. Try Native Android Http Plugin (CORS-free, fast, direct network)
  try {
    const cap = (window as any).Capacitor;
    if (cap?.Plugins?.MediaNotificationPlugin?.fetchHttpUrl) {
      const res = await cap.Plugins.MediaNotificationPlugin.fetchHttpUrl({ url: targetUrl });
      if (res && res.content && res.content.trim().length > 0) {
        return res.content;
      }
    }
  } catch {}

  // 2. Web fetch fallback with strict timeout
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(targetUrl, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (res.ok) {
      return await res.text();
    }
  } catch {}

  return null;
}

export async function fetchVideoForSong(song: Song): Promise<VideoData | null> {
  if (!song || !song.title) return null;

  // 1. Ultra-fast in-memory cache
  if (IN_MEMORY_VIDEO_CACHE.has(song.id)) {
    return IN_MEMORY_VIDEO_CACHE.get(song.id)!;
  }

  // 2. LocalStorage cache
  const cacheKey = `${VIDEO_CACHE_PREFIX}${song.id}`;
  try {
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached) as VideoData;
      if (parsed && parsed.videoId) {
        IN_MEMORY_VIDEO_CACHE.set(song.id, parsed);
        return parsed;
      }
    }
  } catch {}

  const cleanTitle = cleanTrackName(song.title);
  const cleanArtist = cleanArtistName(song.artist);
  const cleanMovie = cleanMovieName(song.movie);

  // Search queries ordered by highest resolution & official video quality
  const queries = [
    `${cleanTitle} ${cleanMovie ? cleanMovie : ''} ${cleanArtist} 4K video song`.trim(),
    `${cleanTitle} ${cleanMovie ? cleanMovie : ''} 1080p 4K official video`.trim(),
    `${cleanTitle} ${cleanArtist} 4K official video`.trim(),
    `${cleanTitle} ${cleanArtist} official video HD`.trim(),
    `${cleanTitle} ${cleanArtist} video song`.trim(),
  ];

  for (const query of queries) {
    try {
      const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
      const html = await nativeFetchText(searchUrl, 2600);

      if (html && html.length > 500) {
        // Extract videoId from ytInitialData / HTML
        const regex = /"videoId":"([a-zA-Z0-9_-]{11})"/g;
        const matches: string[] = [];
        let m: RegExpExecArray | null;
        while ((m = regex.exec(html)) !== null) {
          if (!matches.includes(m[1])) {
            matches.push(m[1]);
          }
        }

        // Extract titles if available
        const titleRegex = /"title":\{"runs":\[\{"text":"([^"]+)"\}\]/g;
        const titles: string[] = [];
        let t: RegExpExecArray | null;
        while ((t = titleRegex.exec(html)) !== null) {
          titles.push(t[1]);
        }

        if (matches.length > 0) {
          // Prefer official 4k/1080p/video song title match if available
          let selectedIdx = 0;
          for (let i = 0; i < Math.min(titles.length, matches.length); i++) {
            const lower = titles[i].toLowerCase();
            if (lower.includes('4k') || lower.includes('1080p') || lower.includes('official') || lower.includes('video song') || lower.includes('full video')) {
              selectedIdx = i;
              break;
            }
          }

          const videoId = matches[selectedIdx] || matches[0];
          const videoTitle = titles[selectedIdx] || titles[0] || `${cleanTitle} - ${cleanArtist}`;
          const videoData: VideoData = {
            videoId,
            title: videoTitle,
            thumbnailUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
            embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&controls=0&modestbranding=1&rel=0&iv_load_policy=3&playsinline=1&enablejsapi=1&fs=0&disablekb=1&showinfo=0&autohide=1&cc_load_policy=0&vq=hd1080&hd=1&high_res=1&widget_referrer=${encodeURIComponent(typeof window !== 'undefined' && window.location.origin ? window.location.origin : 'http://localhost')}&origin=${encodeURIComponent(typeof window !== 'undefined' && window.location.origin ? window.location.origin : 'http://localhost')}`,
          };

          // Cache result
          IN_MEMORY_VIDEO_CACHE.set(song.id, videoData);
          try {
            localStorage.setItem(cacheKey, JSON.stringify(videoData));
          } catch {}

          return videoData;
        }
      }
    } catch {}
  }

  return null;
}
