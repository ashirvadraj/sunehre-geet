import { Song } from '../types';

export interface VideoData {
  videoId: string;
  title: string;
  thumbnailUrl: string;
  embedUrl: string;
}

const VIDEO_CACHE_PREFIX = 'sunehre_geet_video_v4_';
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

function parseDurationText(lengthText: string): number {
  if (!lengthText) return 0;
  const parts = lengthText.split(':').map(Number);
  if (parts.length === 2) {
    return (parts[0] || 0) * 60 + (parts[1] || 0);
  } else if (parts.length === 3) {
    return (parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0);
  }
  return 0;
}

const KNOWN_OFFICIAL_CHANNELS = [
  't-series', 'tseries', 'saregama', 'shemaroo', 'ishtar music', 'ishtar',
  'tips official', 'tips', 'zee music', 'sony music', 'yrf', 'yash raj films',
  'ultra bollywood', 'ultra movie', 'eros now', 'venus', 'speed records',
  't-series classics', 'saregama music', 'rajshri', 't-series oldisgold',
  'pen bollywood', 'nh studioz', 'goldmines', 'geet mp3', 'white hill music',
  'times music', 'aditya music', 'lahari music', 'think music', 'dm - desi melodies'
];

const FORBIDDEN_KEYWORDS = [
  'karaoke', 'instrumental', 'cover', 'reaction', 'react', 'unplugged',
  'dance cover', 'choreography', 'status', 'whatsapp status', '#shorts',
  'lofi', 'lo-fi', 'slowed', 'reverb', '8d audio', 'bass boosted',
  'mashup', 'dj remix', 'remix', 'flute', 'guitar tutorial', 'how to play',
  'bgm', 'ringtone', 'parody', 'fan made', 'behind the scene', 'making of',
  'interview', 'trailer', 'teaser', 'review'
];

interface ScoredCandidate {
  videoId: string;
  title: string;
  channel: string;
  lengthText: string;
  isVerified: boolean;
  score: number;
}

function scoreAndValidateVideo(video: { videoId: string; title: string; channel: string; lengthText: string; isVerified: boolean }, song: Song): { valid: boolean; score: number } {
  const titleLower = video.title.toLowerCase();
  const channelLower = video.channel.toLowerCase();
  const dur = parseDurationText(video.lengthText);

  // 1. Duration Sanity Filter
  if (dur > 0 && dur < 50) return { valid: false, score: 0 };
  if (dur > 900 && (!song.duration || song.duration < 600)) return { valid: false, score: 0 };

  // 2. Reject Forbidden / Fake / Cover / Status Keywords
  for (const bad of FORBIDDEN_KEYWORDS) {
    const reg = new RegExp(`(^|[^a-zA-Z0-9])${bad}([^a-zA-Z0-9]|$)`, 'i');
    if (reg.test(titleLower) && !song.title.toLowerCase().includes(bad)) {
      return { valid: false, score: 0 };
    }
  }

  // 3. Strict Title Matching: Must contain key words from song title
  const cleanSongTitle = cleanTrackName(song.title).toLowerCase().replace(/[^a-z0-9\s]/g, ' ').trim();
  const titleWords = cleanSongTitle.split(/\s+/).filter(w => w.length >= 3);
  
  if (titleWords.length > 0) {
    let matchedWords = 0;
    for (const w of titleWords) {
      if (titleLower.includes(w)) matchedWords++;
    }
    const matchRatio = matchedWords / titleWords.length;
    if (titleWords.length >= 2 && matchRatio < 0.5) {
      return { valid: false, score: 0 };
    } else if (titleWords.length === 1 && matchedWords === 0) {
      return { valid: false, score: 0 };
    }
  }

  // 4. Calculate Official Authenticity Score
  let score = 0;

  // Known official music channels get high priority
  const isKnownOfficial = KNOWN_OFFICIAL_CHANNELS.some(c => channelLower.includes(c));
  if (isKnownOfficial) score += 60;

  // Verified / Official Artist Channel badge
  if (video.isVerified) score += 25;

  // Official title markers
  if (titleLower.includes('official video') || titleLower.includes('official music video')) score += 30;
  if (titleLower.includes('video song') || titleLower.includes('full video')) score += 25;
  if (titleLower.includes('4k') || titleLower.includes('8k') || titleLower.includes('1080p') || titleLower.includes('hd')) score += 15;
  if (titleLower.includes('remastered')) score += 15;

  // Artist & Movie match
  const firstArtist = cleanArtistName(song.artist || '').toLowerCase();
  const artistParts = firstArtist.split(/\s+/).filter(p => p.length >= 3);
  const artistMatches = artistParts.some(p => titleLower.includes(p) || channelLower.includes(p));
  if (artistMatches) score += 20;

  const cleanMovie = cleanMovieName(song.movie || '').toLowerCase();
  if (cleanMovie.length >= 3 && titleLower.includes(cleanMovie)) {
    score += 20;
  }

  // Duration match with actual song duration
  if (song.duration && dur > 0) {
    const diff = Math.abs(song.duration - dur);
    if (diff <= 30) score += 25;
    else if (diff <= 60) score += 15;
    else if (diff > 120) score -= 20;
  }

  // Strict Threshold: Minimum score must be >= 45 to be considered a genuine official video
  if (score < 45) {
    return { valid: false, score };
  }

  return { valid: true, score };
}

async function nativeFetchText(targetUrl: string, timeoutMs: number = 2800): Promise<string | null> {
  // 1. Try Native Android Http Plugin (CORS-free, direct network)
  try {
    const cap = (window as any).Capacitor;
    if (cap?.Plugins?.MediaNotificationPlugin?.fetchHttpUrl) {
      const res = await cap.Plugins.MediaNotificationPlugin.fetchHttpUrl({ url: targetUrl });
      if (res && res.content && res.content.trim().length > 0) {
        return res.content;
      }
    }
  } catch {}

  // 2. Web fetch fallback
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

  // Search queries targeting genuine official video songs in HD/4K
  const queries = [
    `${cleanTitle} ${cleanMovie ? cleanMovie : ''} ${cleanArtist} official video song`.trim(),
    `${cleanTitle} ${cleanMovie ? cleanMovie : ''} 4K official video`.trim(),
    `${cleanTitle} ${cleanArtist} 4K video song`.trim(),
    `${cleanTitle} ${cleanArtist} official music video`.trim(),
  ];

  for (const query of queries) {
    try {
      const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
      const html = await nativeFetchText(searchUrl, 3000);

      if (html && html.length > 500) {
        const scoredCandidates: ScoredCandidate[] = [];

        // 1. Try JSON parsing from ytInitialData
        const ytInitialDataMatch = html.match(/var ytInitialData = ({.*?});<\/script>/s) || html.match(/ytInitialData\s*=\s*({.*?});/s);
        if (ytInitialDataMatch) {
          try {
            const json = JSON.parse(ytInitialDataMatch[1]);
            const contents = json.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents;
            const itemSection = contents?.find((c: any) => c.itemSectionRenderer)?.itemSectionRenderer?.contents;

            if (Array.isArray(itemSection)) {
              for (const item of itemSection) {
                const vr = item.videoRenderer;
                if (!vr || !vr.videoId) continue;
                const title = vr.title?.runs?.map((r: any) => r.text).join('') || '';
                const channel = vr.ownerText?.runs?.map((r: any) => r.text).join('') || '';
                const lengthText = vr.lengthText?.simpleText || '';
                const isVerified = vr.ownerBadges?.some((b: any) => 
                  b.metadataBadgeRenderer?.style?.includes('VERIFIED') || 
                  b.metadataBadgeRenderer?.style?.includes('OFFICIAL')
                ) || false;

                const candidate = { videoId: vr.videoId, title, channel, lengthText, isVerified };
                const evaluation = scoreAndValidateVideo(candidate, song);
                if (evaluation.valid) {
                  scoredCandidates.push({ ...candidate, score: evaluation.score });
                }
              }
            }
          } catch {}
        }

        // 2. Fallback regex extraction if JSON parsing was not available
        if (scoredCandidates.length === 0) {
          const videoIdRegex = /"videoId":"([a-zA-Z0-9_-]{11})"/g;
          const titleRegex = /"title":\{"runs":\[\{"text":"([^"]+)"\}\]/g;
          
          const ids: string[] = [];
          const titles: string[] = [];
          let m: RegExpExecArray | null;
          while ((m = videoIdRegex.exec(html)) !== null) {
            if (!ids.includes(m[1])) ids.push(m[1]);
          }
          while ((m = titleRegex.exec(html)) !== null) {
            titles.push(m[1]);
          }

          for (let i = 0; i < Math.min(ids.length, titles.length); i++) {
            const candidate = {
              videoId: ids[i],
              title: titles[i],
              channel: '',
              lengthText: '',
              isVerified: false,
            };
            const evaluation = scoreAndValidateVideo(candidate, song);
            if (evaluation.valid) {
              scoredCandidates.push({ ...candidate, score: evaluation.score });
            }
          }
        }

        // Sort candidates by highest score
        if (scoredCandidates.length > 0) {
          scoredCandidates.sort((a, b) => b.score - a.score);
          const best = scoredCandidates[0];

          const origin = typeof window !== 'undefined' && window.location.origin ? window.location.origin : 'http://localhost';
          const videoData: VideoData = {
            videoId: best.videoId,
            title: best.title,
            thumbnailUrl: `https://img.youtube.com/vi/${best.videoId}/hqdefault.jpg`,
            embedUrl: `https://www.youtube-nocookie.com/embed/${best.videoId}?autoplay=1&controls=0&modestbranding=1&rel=0&iv_load_policy=3&playsinline=1&enablejsapi=1&fs=0&disablekb=1&showinfo=0&autohide=1&cc_load_policy=0&vq=hd1080&hd=1&high_res=1&widget_referrer=${encodeURIComponent(origin)}&origin=${encodeURIComponent(origin)}`,
          };

          // Cache verified official video result
          IN_MEMORY_VIDEO_CACHE.set(song.id, videoData);
          try {
            localStorage.setItem(cacheKey, JSON.stringify(videoData));
          } catch {}

          return videoData;
        }
      }
    } catch {}
  }

  // No verified official video found -> return null gracefully
  return null;
}
