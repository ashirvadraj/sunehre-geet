import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Repeat1,
  Heart,
  ChevronDown,
  Moon,
  Download,
  Check,
  Disc,
  FileText,
  Loader2,
  RefreshCw,
  Type,
  Music2,
  Sparkles,
  Tv,
  Film,
  Maximize2,
  Minimize2,
  ExternalLink,
  Video,
  Volume2,
  VolumeX,
  RotateCcw,
  RotateCw
} from 'lucide-react';
import { useAudio } from '../context/AudioContext';
import { usePlaylists } from '../context/PlaylistContext';
import { useDownload } from '../context/DownloadContext';
import { fetchLyricsForSong, LyricsData } from '../services/lyricsService';
import { fetchVideoForSong, VideoData } from '../services/videoService';

interface PlayerProps {
  onOpenSleepTimer: () => void;
}

function formatTime(seconds: number): string {
  if (isNaN(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

export const Player: React.FC<PlayerProps> = ({ onOpenSleepTimer }) => {
  const {
    currentSong,
    isPlaying,
    currentTime,
    duration,
    isShuffle,
    repeatMode,
    isFullPlayerOpen,
    sleepTimer,
    togglePlay,
    pause,
    playNext,
    playPrevious,
    seek,
    toggleShuffle,
    cycleRepeatMode,
    setIsFullPlayerOpen,
  } = useAudio();

  const { isFavorite, toggleFavorite } = usePlaylists();
  const { isDownloaded, downloadSong, deleteDownload, downloadingId } = useDownload();

  const [activeView, setActiveView] = useState<'turntable' | 'lyrics' | 'video'>('turntable');
  const [lyricsData, setLyricsData] = useState<LyricsData | null>(null);
  const [isLoadingLyrics, setIsLoadingLyrics] = useState(false);
  const [lyricsFontSize, setLyricsFontSize] = useState<'sm' | 'base' | 'lg'>('base');

  const [videoData, setVideoData] = useState<VideoData | null>(null);
  const [isLoadingVideo, setIsLoadingVideo] = useState(false);
  const [isVideoPlaying, setIsVideoPlaying] = useState(true);
  const [videoCurrentTime, setVideoCurrentTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);

  const videoIframeRef = useRef<HTMLIFrameElement | null>(null);
  const videoContainerRef = useRef<HTMLDivElement | null>(null);
  const controlsTimeoutRef = useRef<any>(null);

  const lyricsContainerRef = useRef<HTMLDivElement | null>(null);
  const activeLineRef = useRef<HTMLDivElement | null>(null);

  // Load lyrics & video whenever current song changes
  useEffect(() => {
    if (currentSong) {
      setLyricsData(null);
      setVideoData(null);
      setVideoCurrentTime(0);
      setVideoDuration(currentSong.duration || 180);
      setIsVideoPlaying(true);
      loadLyrics();
      loadVideo();
    }
  }, [currentSong?.id]);

  const loadLyrics = async () => {
    if (!currentSong) return;
    setIsLoadingLyrics(true);
    try {
      const data = await fetchLyricsForSong(currentSong);
      setLyricsData(data);
    } catch {
      setLyricsData(null);
    }
    setIsLoadingLyrics(false);
  };

  const loadVideo = async () => {
    if (!currentSong) return;
    setIsLoadingVideo(true);
    try {
      const data = await fetchVideoForSong(currentSong);
      setVideoData(data);
    } catch {
      setVideoData(null);
    }
    setIsLoadingVideo(false);
  };

  // Video postMessage commander
  const sendIframeCommand = (command: string, args: any = '') => {
    if (videoIframeRef.current?.contentWindow) {
      videoIframeRef.current.contentWindow.postMessage(
        JSON.stringify({ event: 'command', func: command, args }),
        '*'
      );
    }
  };

  const toggleVideoPlay = () => {
    if (isVideoPlaying) {
      sendIframeCommand('pauseVideo');
      setIsVideoPlaying(false);
    } else {
      sendIframeCommand('playVideo');
      setIsVideoPlaying(true);
    }
    handleUserActivity();
  };

  const seekVideo = (seconds: number) => {
    const clamped = Math.max(0, Math.min(videoDuration || duration || 300, seconds));
    sendIframeCommand('seekTo', [clamped, true]);
    setVideoCurrentTime(clamped);
    handleUserActivity();
  };

  const toggleVideoMute = () => {
    if (isMuted) {
      sendIframeCommand('unMute');
      setIsMuted(false);
    } else {
      sendIframeCommand('mute');
      setIsMuted(true);
    }
    handleUserActivity();
  };

  const toggleVideoFullscreen = () => {
    if (videoContainerRef.current) {
      if (!document.fullscreenElement) {
        videoContainerRef.current.requestFullscreen?.().catch(() => {});
        setIsFullscreen(true);
      } else {
        document.exitFullscreen?.().catch(() => {});
        setIsFullscreen(false);
      }
    }
    handleUserActivity();
  };

  const handleUserActivity = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => setShowControls(false), 3500);
  };

  // Listen to video postMessage status updates
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      try {
        if (typeof event.data === 'string') {
          const data = JSON.parse(event.data);
          if (data.event === 'infoDelivery' && data.info) {
            if (typeof data.info.currentTime === 'number') {
              setVideoCurrentTime(data.info.currentTime);
            }
            if (typeof data.info.duration === 'number' && data.info.duration > 0) {
              setVideoDuration(data.info.duration);
            }
            if (typeof data.info.playerState === 'number') {
              setIsVideoPlaying(data.info.playerState === 1);
            }
          }
        }
      } catch {}
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Find active line index based on current playback timestamp with 350ms anticipation offset (ONLY for genuine synced lyrics)
  let activeLineIndex = -1;
  if (lyricsData?.isSynced && lyricsData.lines.length > 0) {
    const calibratedTime = currentTime + 0.35; // 350ms offset aligns visual highlight precisely with vocal onset
    for (let i = 0; i < lyricsData.lines.length; i++) {
      if (calibratedTime >= lyricsData.lines[i].time) {
        activeLineIndex = i;
      } else {
        break;
      }
    }
  }

  // Smooth Auto-scroll to keep active line centered in view
  useEffect(() => {
    if (activeView === 'lyrics' && activeLineRef.current && lyricsContainerRef.current) {
      activeLineRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [activeLineIndex, activeView]);

  if (!isFullPlayerOpen || !currentSong) return null;

  const isFav = isFavorite(currentSong.id);
  const downloaded = isDownloaded(currentSong.id);
  const isDownloading = downloadingId === currentSong.id;

  const handleDownloadClick = () => {
    if (downloaded) {
      deleteDownload(currentSong.id);
    } else {
      downloadSong(currentSong);
    }
  };

  const toggleFontSize = () => {
    setLyricsFontSize((prev) => (prev === 'sm' ? 'base' : prev === 'base' ? 'lg' : 'sm'));
  };

  return (
    <div className="fixed inset-0 z-50 bg-gradient-to-b from-[#1b1033] via-[#0e071e] to-[#06030c] flex flex-col justify-between p-5 overflow-hidden animate-fade-in">
      {/* Background Ambient Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-retro-gold/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Header Bar */}
      <div className="relative z-10 flex items-center justify-between">
        <button
          onClick={() => setIsFullPlayerOpen(false)}
          className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-retro-cream hover:bg-white/10 active:scale-95 transition-all"
        >
          <ChevronDown className="w-6 h-6" />
        </button>

        {/* View Switcher: Turntable Record vs Lyrics vs Video */}
        <div className="flex items-center p-1 rounded-full bg-black/60 border border-retro-gold/30 shadow-lg">
          <button
            onClick={() => setActiveView('turntable')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
              activeView === 'turntable'
                ? 'bg-gradient-to-r from-retro-gold to-amber-500 text-retro-dark shadow-md'
                : 'text-white/60 hover:text-white'
            }`}
          >
            <Disc className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">रिकॉर्ड</span>
            <span>Record</span>
          </button>
          <button
            onClick={() => {
              setActiveView('lyrics');
              if (!lyricsData && !isLoadingLyrics) loadLyrics();
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
              activeView === 'lyrics'
                ? 'bg-gradient-to-r from-retro-gold to-amber-500 text-retro-dark shadow-md'
                : 'text-retro-gold/90 hover:text-retro-gold hover:bg-white/5'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">बोल</span>
            <span>Lyrics</span>
            {lyricsData?.isSynced && (
              <Sparkles className="w-3 h-3 text-amber-300 animate-pulse" />
            )}
          </button>
          <button
            onClick={() => {
              setActiveView('video');
              if (isPlaying) pause();
              if (!videoData && !isLoadingVideo) loadVideo();
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
              activeView === 'video'
                ? 'bg-gradient-to-r from-rose-500 via-amber-500 to-retro-gold text-retro-dark shadow-md'
                : 'text-rose-300/90 hover:text-rose-300 hover:bg-white/5'
            }`}
          >
            <Tv className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">वीडियो</span>
            <span>Video</span>
            {videoData && (
              <span className="text-[9px] px-1 py-0.2 rounded bg-rose-400/30 text-rose-200 font-black">HD</span>
            )}
          </button>
        </div>

        <button
          onClick={onOpenSleepTimer}
          className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
            sleepTimer !== null
              ? 'bg-retro-gold text-retro-dark'
              : 'bg-white/5 text-retro-cream hover:bg-white/10'
          }`}
          title="Sleep Timer"
        >
          <Moon className="w-5 h-5" />
        </button>
      </div>

      {/* Center View: Turntable OR Synced Lyrics OR HD Music Video */}
      {activeView === 'turntable' ? (
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center my-2 animate-fade-in">
          {/* Full Edge-to-Edge Rotating CD Album Disc */}
          <div className="relative w-64 h-64 sm:w-80 sm:h-80 md:w-96 md:h-96 flex items-center justify-center my-2 sm:my-3">
            {/* Ambient Dynamic Glow */}
            <div className="absolute inset-0 rounded-full bg-retro-gold/25 blur-3xl pointer-events-none" />

            {/* Rotating Full Album Art CD Disc */}
            <div
              className="relative w-full h-full rounded-full overflow-hidden border-4 border-retro-gold shadow-2xl shadow-black flex items-center justify-center"
              style={{
                animation: isPlaying ? 'spin 16s linear infinite' : 'none',
              }}
            >
              <img
                src={currentSong.coverUrl}
                alt={currentSong.title}
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600&auto=format&fit=crop&q=80';
                }}
              />

              {/* Holographic Radial Sheen & CD Rings */}
              <div className="absolute inset-0 rounded-full border-2 border-white/30 pointer-events-none" />
              <div className="absolute inset-8 rounded-full border border-white/20 pointer-events-none" />
              <div className="absolute inset-16 rounded-full border border-retro-gold/35 pointer-events-none" />
              <div className="absolute inset-24 rounded-full border border-white/10 pointer-events-none" />

              {/* Delicate Golden Center Spindle Hole */}
              <div className="absolute inset-0 m-auto w-12 h-12 rounded-full bg-[#120a22] border-2 border-retro-gold shadow-xl flex items-center justify-center">
                <div className="w-4 h-4 rounded-full bg-[#06030c] border border-white/60 shadow-inner" />
              </div>
            </div>
          </div>

          {/* Quick Switch Action Pills */}
          <div className="mt-4 flex items-center gap-2.5">
            <button
              onClick={() => {
                setActiveView('lyrics');
                if (!lyricsData && !isLoadingLyrics) loadLyrics();
              }}
              className="px-3.5 py-1.5 rounded-full bg-[#1e1338]/90 border border-retro-gold/30 hover:border-retro-gold text-retro-gold text-xs font-semibold flex items-center gap-1.5 shadow-lg backdrop-blur-md active:scale-95 transition-all"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>गीत के बोल (Lyrics)</span>
            </button>

            <button
              onClick={() => {
                setActiveView('video');
                if (isPlaying) pause();
                if (!videoData && !isLoadingVideo) loadVideo();
              }}
              className="px-3.5 py-1.5 rounded-full bg-gradient-to-r from-rose-900/60 to-purple-900/60 border border-rose-500/40 hover:border-rose-400 text-rose-200 text-xs font-semibold flex items-center gap-1.5 shadow-lg backdrop-blur-md active:scale-95 transition-all"
            >
              <Tv className="w-3.5 h-3.5 text-rose-400" />
              <span>वीडियो देखें (Watch Video)</span>
              {videoData && (
                <span className="text-[9px] px-1 py-0.2 rounded bg-rose-400/30 text-rose-200 font-extrabold">HD</span>
              )}
            </button>
          </div>
        </div>
      ) : activeView === 'lyrics' ? (
        /* REAL-TIME SYNCED KARAOKE LYRICS VIEW */
        <div className="relative z-10 flex-1 flex flex-col my-2 overflow-hidden animate-fade-in bg-black/30 rounded-3xl border border-white/10 p-4 backdrop-blur-md">
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <div className="flex items-center gap-2">
              <Music2 className="w-4 h-4 text-retro-gold" />
              <span className="text-xs font-bold text-retro-cream">
                {lyricsData?.isSynced ? 'लाइव सिंक बोल (Live Synced Lyrics)' : 'गीत के बोल (Lyrics)'}
              </span>
              {lyricsData?.isSynced && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                  Karaoke
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={toggleFontSize}
                className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-all text-xs font-bold"
                title="Change Font Size"
              >
                <Type className="w-4 h-4" />
              </button>
              <button
                onClick={loadLyrics}
                disabled={isLoadingLyrics}
                className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-all"
                title="Refresh Lyrics"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingLyrics ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          <div
            ref={lyricsContainerRef}
            className="flex-1 overflow-y-auto py-6 space-y-4 text-center scrollbar-none"
          >
            {isLoadingLyrics ? (
              <div className="h-full flex flex-col items-center justify-center space-y-3">
                <Loader2 className="w-8 h-8 text-retro-gold animate-spin" />
                <p className="text-xs text-white/60">गीत के बोल लोड हो रहे हैं...</p>
              </div>
            ) : lyricsData && lyricsData.lines.length > 0 ? (
              lyricsData.lines.map((line, idx) => {
                const isSynced = lyricsData.isSynced;
                const isActive = isSynced && idx === activeLineIndex;
                const isPast = isSynced && idx < activeLineIndex;

                const sizeClass =
                  lyricsFontSize === 'sm'
                    ? 'text-sm'
                    : lyricsFontSize === 'lg'
                    ? 'text-xl'
                    : 'text-base sm:text-lg';

                return (
                  <div
                    key={idx}
                    ref={isActive ? activeLineRef : null}
                    onClick={() => {
                      if (isSynced) {
                        seek(line.time);
                      }
                    }}
                    className={`transition-all duration-300 ${isSynced ? 'cursor-pointer' : ''} px-3 py-1.5 rounded-2xl ${
                      isActive
                        ? `${sizeClass} font-bold text-amber-300 scale-105 bg-retro-gold/15 shadow-md shadow-retro-gold/10`
                        : isPast
                        ? `${sizeClass} font-medium text-white/40 hover:text-white/60`
                        : `${sizeClass} font-medium text-white/80 hover:text-white`
                    }`}
                  >
                    {line.text}
                  </div>
                );
              })
            ) : (
              <div className="h-full flex flex-col items-center justify-center space-y-2.5 py-12 text-center px-4">
                <div className="w-14 h-14 rounded-full bg-retro-gold/15 border border-retro-gold/30 flex items-center justify-center text-retro-gold mb-1">
                  <Sparkles className="w-7 h-7 text-amber-300 animate-pulse" />
                </div>
                <h4 className="font-serif font-bold text-base text-retro-gold">
                  यह एक दुर्लभ और अनमोल गीत है
                </h4>
                <p className="text-xs text-white/70 max-w-xs leading-relaxed">
                  इस दुर्लभ क्लासिक के बोल डिजिटाइज़ किए जा रहे हैं।
                </p>
                <div className="pt-2.5 border-t border-white/10 w-52 mt-1">
                  <p className="text-[11px] font-semibold text-amber-200/80 italic">
                    "This is a Rare Vintage Masterpiece"
                  </p>
                  <p className="text-[10px] text-white/50 mt-0.5">
                    Lyrics are currently being archived. Enjoy the music!
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* HIGH DEFINITION OFFICIAL MUSIC VIDEO VIEW */
        <div
          ref={videoContainerRef}
          onMouseMove={handleUserActivity}
          onTouchStart={handleUserActivity}
          className={`relative z-10 flex-1 flex flex-col my-2 overflow-hidden animate-fade-in bg-black/80 rounded-3xl border border-retro-gold/40 p-3 sm:p-4 backdrop-blur-md shadow-2xl justify-between ${
            isFullscreen ? 'fixed inset-0 z-[100] m-0 rounded-none border-0 p-2' : ''
          }`}
        >
          {/* Cinema Header */}
          <div className="flex items-center justify-between pb-2 border-b border-white/10 z-30">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-300 flex-shrink-0">
                <Film className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-retro-cream truncate block font-serif">
                    सुनहरे गीत सिनेमा
                  </span>
                  <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-gradient-to-r from-amber-500/30 to-rose-500/30 text-amber-300 border border-amber-500/40 font-black">
                    HD CINEMA
                  </span>
                </div>
                <span className="text-[10px] text-white/60 font-medium truncate block">
                  {currentSong.title} • {currentSong.artist}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 flex-shrink-0">
              <button
                onClick={toggleVideoFullscreen}
                className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-all"
                title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
              >
                {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
              <button
                onClick={loadVideo}
                disabled={isLoadingVideo}
                className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-all"
                title="Refresh Video Stream"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingVideo ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Video Player Display Container */}
          <div className="flex-1 flex flex-col items-center justify-center my-2 relative rounded-2xl overflow-hidden bg-black border border-white/10 shadow-2xl group">
            {isLoadingVideo ? (
              <div className="flex flex-col items-center justify-center space-y-3 p-6 text-center">
                <div className="relative">
                  <div className="w-12 h-12 rounded-full border-2 border-retro-gold/30 border-t-retro-gold animate-spin" />
                  <Tv className="w-5 h-5 text-retro-gold absolute inset-0 m-auto" />
                </div>
                <p className="text-xs font-semibold text-retro-cream">सिनेमा वीडियो लोड हो रहा है...</p>
                <p className="text-[10px] text-white/50">Streaming High-Definition Classic...</p>
              </div>
            ) : videoData ? (
              <div className="w-full h-full relative aspect-video max-h-[58vh] flex items-center justify-center bg-black">
                {/* 1. Sandboxed Iframe with NO top navigation or popups */}
                <iframe
                  ref={videoIframeRef}
                  src={`${videoData.embedUrl}&start=${Math.max(0, Math.floor(currentTime))}`}
                  title="Sunehre Geet Cinema Video"
                  sandbox="allow-scripts allow-same-origin allow-presentation"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="w-full h-full rounded-2xl border-0 shadow-2xl pointer-events-auto"
                />

                {/* 2. Top Redirection Shield: Blocks and absorbs any clicks on top YouTube title/avatar links */}
                <div
                  className="absolute top-0 left-0 right-0 h-16 z-30 cursor-pointer"
                  onClick={handleUserActivity}
                  title="Sunehre Geet HD Stream"
                />

                {/* 3. Bottom Brand Shield: Blocks bottom-right YouTube logo/links */}
                <div
                  className="absolute bottom-0 right-0 w-36 h-12 z-30 cursor-pointer"
                  onClick={handleUserActivity}
                />

                {/* 4. Custom Cinema Floating Control Overlay (Auto-hiding) */}
                <div
                  className={`absolute inset-0 z-20 flex flex-col justify-between p-3 bg-gradient-to-t from-black/85 via-transparent to-black/60 transition-opacity duration-300 pointer-events-none ${
                    showControls ? 'opacity-100' : 'opacity-0'
                  }`}
                >
                  {/* Top Bar Title */}
                  <div className="flex items-center justify-between text-retro-cream">
                    <span className="text-xs font-bold drop-shadow-md truncate max-w-[80%]">
                      {currentSong.title}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-black/60 text-retro-gold border border-retro-gold/30 font-bold backdrop-blur-md">
                      HD Stream
                    </span>
                  </div>

                  {/* Center Playback & Skip Controls */}
                  <div className="flex items-center justify-center gap-6 pointer-events-auto">
                    <button
                      onClick={() => seekVideo(videoCurrentTime - 10)}
                      className="w-10 h-10 rounded-full bg-black/60 border border-white/20 text-white hover:text-retro-gold hover:scale-110 active:scale-95 transition-all flex items-center justify-center backdrop-blur-md shadow-lg"
                      title="Rewind 10s"
                    >
                      <RotateCcw className="w-5 h-5" />
                    </button>

                    <button
                      onClick={toggleVideoPlay}
                      className="w-14 h-14 rounded-full bg-gradient-to-tr from-retro-gold via-amber-400 to-amber-600 text-retro-dark flex items-center justify-center shadow-2xl shadow-retro-gold/40 hover:scale-105 active:scale-95 transition-all"
                      title={isVideoPlaying ? 'Pause' : 'Play'}
                    >
                      {isVideoPlaying ? (
                        <Pause className="w-6 h-6 fill-current" />
                      ) : (
                        <Play className="w-6 h-6 fill-current ml-0.5" />
                      )}
                    </button>

                    <button
                      onClick={() => seekVideo(videoCurrentTime + 10)}
                      className="w-10 h-10 rounded-full bg-black/60 border border-white/20 text-white hover:text-retro-gold hover:scale-110 active:scale-95 transition-all flex items-center justify-center backdrop-blur-md shadow-lg"
                      title="Forward 10s"
                    >
                      <RotateCw className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Bottom Cinema Scrub Bar & Audio/Fullscreen Buttons */}
                  <div className="space-y-1.5 pointer-events-auto bg-black/60 p-2.5 rounded-2xl border border-white/10 backdrop-blur-md">
                    {/* Scrub Slider */}
                    <input
                      type="range"
                      min="0"
                      max={videoDuration || duration || 300}
                      value={videoCurrentTime}
                      onChange={(e) => seekVideo(parseFloat(e.target.value))}
                      className="w-full h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-retro-gold"
                    />

                    <div className="flex items-center justify-between text-[11px] text-white/80">
                      <div className="font-mono text-retro-gold font-bold">
                        <span>{formatTime(videoCurrentTime)}</span>
                        <span className="text-white/40 mx-1">/</span>
                        <span className="text-white/60">{formatTime(videoDuration || duration || 0)}</span>
                      </div>

                      <div className="flex items-center gap-3">
                        <button
                          onClick={toggleVideoMute}
                          className="text-white/80 hover:text-retro-gold transition-colors"
                          title={isMuted ? 'Unmute' : 'Mute'}
                        >
                          {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={toggleVideoFullscreen}
                          className="text-white/80 hover:text-retro-gold transition-colors"
                          title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                        >
                          {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center space-y-2.5 p-6 text-center max-w-sm">
                <div className="w-14 h-14 rounded-full bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 mb-1">
                  <Tv className="w-7 h-7" />
                </div>
                <h4 className="font-serif font-bold text-sm text-retro-gold">
                  इस गीत का वीडियो उपलब्ध नहीं है
                </h4>
                <p className="text-xs text-white/70 leading-relaxed">
                  यह एक दुर्लभ स्टूडियो रिकॉर्डिंग है। मूल उच्च-गुणवत्ता ऑडियो का आनंद लें।
                </p>
                <button
                  onClick={() => setActiveView('turntable')}
                  className="mt-2 px-4 py-1.5 rounded-full bg-retro-gold/20 text-retro-gold text-xs font-bold border border-retro-gold/30 hover:bg-retro-gold/30 transition-all"
                >
                  रिकॉर्ड मोड पर लौटें (Back to Record)
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Song Details & Actions */}
      <div className="relative z-10 space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <div className="min-w-0 flex-1 mr-3">
            <h2 className="text-lg sm:text-xl font-bold font-serif text-retro-cream truncate leading-tight">
              {currentSong.title}
            </h2>
            <p className="text-xs text-retro-gold font-medium truncate mt-0.5">
              {currentSong.artist} • {currentSong.movie} ({currentSong.year})
            </p>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Download Button */}
            <button
              onClick={handleDownloadClick}
              className={`p-2.5 rounded-full transition-all ${
                downloaded
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : 'bg-white/5 text-white/60 hover:text-white'
              }`}
              title={downloaded ? 'Downloaded' : 'Download Song'}
            >
              {isDownloading ? (
                <div className="w-4 h-4 border-2 border-retro-gold border-t-transparent rounded-full animate-spin" />
              ) : downloaded ? (
                <Check className="w-4 h-4" />
              ) : (
                <Download className="w-4 h-4" />
              )}
            </button>

            {/* Favorite Button */}
            <button
              onClick={() => toggleFavorite(currentSong.id, currentSong)}
              className={`p-2.5 rounded-full transition-all ${
                isFav
                  ? 'bg-red-500/20 text-red-400'
                  : 'bg-white/5 text-white/60 hover:text-white'
              }`}
              title="Add to Favorites"
            >
              <Heart className={`w-4 h-4 ${isFav ? 'fill-current' : ''}`} />
            </button>
          </div>
        </div>

        {/* Progress Slider */}
        <div className="space-y-1">
          <input
            type="range"
            min="0"
            max={(activeView === 'video' ? videoDuration : duration) || currentSong.duration || 100}
            value={activeView === 'video' ? videoCurrentTime : currentTime}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              if (activeView === 'video') {
                seekVideo(val);
              } else {
                seek(val);
              }
            }}
            className="w-full h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer accent-retro-gold"
          />
          <div className="flex justify-between text-[11px] text-white/50 font-mono">
            <span>{formatTime(activeView === 'video' ? videoCurrentTime : currentTime)}</span>
            <span>{formatTime((activeView === 'video' ? videoDuration : duration) || currentSong.duration || 0)}</span>
          </div>
        </div>

        {/* Playback Controls */}
        <div className="flex items-center justify-between pt-1">
          {/* Shuffle */}
          <button
            onClick={toggleShuffle}
            className={`p-2.5 rounded-full transition-all ${
              isShuffle ? 'text-retro-gold' : 'text-white/40 hover:text-white'
            }`}
            title="Shuffle"
          >
            <Shuffle className="w-5 h-5" />
          </button>

          {/* Previous Track */}
          <button
            onClick={playPrevious}
            className="p-3 text-retro-cream hover:text-retro-gold active:scale-95 transition-all"
            title="Previous Track"
          >
            <SkipBack className="w-6 h-6 fill-current" />
          </button>

          {/* Main Play / Pause Button */}
          <button
            onClick={activeView === 'video' ? toggleVideoPlay : togglePlay}
            className="w-16 h-16 rounded-full bg-gradient-to-tr from-retro-gold via-amber-400 to-amber-600 text-retro-dark flex items-center justify-center shadow-xl shadow-retro-gold/20 active:scale-95 transition-all"
            title={
              activeView === 'video'
                ? isVideoPlaying ? 'Pause Video' : 'Play Video'
                : isPlaying ? 'Pause' : 'Play'
            }
          >
            {(activeView === 'video' ? isVideoPlaying : isPlaying) ? (
              <Pause className="w-7 h-7 fill-current" />
            ) : (
              <Play className="w-7 h-7 fill-current ml-1" />
            )}
          </button>

          {/* Next Track */}
          <button
            onClick={playNext}
            className="p-3 text-retro-cream hover:text-retro-gold active:scale-95 transition-all"
            title="Next Track"
          >
            <SkipForward className="w-6 h-6 fill-current" />
          </button>

          {/* Repeat Mode */}
          <button
            onClick={cycleRepeatMode}
            className={`p-2.5 rounded-full transition-all ${
              repeatMode !== 'off' ? 'text-retro-gold' : 'text-white/40 hover:text-white'
            }`}
            title={`Repeat: ${repeatMode}`}
          >
            {repeatMode === 'one' ? (
              <Repeat1 className="w-5 h-5" />
            ) : (
              <Repeat className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
};