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
  Sparkles
} from 'lucide-react';
import { useAudio } from '../context/AudioContext';
import { usePlaylists } from '../context/PlaylistContext';
import { useDownload } from '../context/DownloadContext';
import { fetchLyricsForSong, LyricsData } from '../services/lyricsService';

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
    playNext,
    playPrevious,
    seek,
    toggleShuffle,
    cycleRepeatMode,
    setIsFullPlayerOpen,
  } = useAudio();

  const { isFavorite, toggleFavorite } = usePlaylists();
  const { isDownloaded, downloadSong, deleteDownload, downloadingId } = useDownload();

  const [activeView, setActiveView] = useState<'turntable' | 'lyrics'>('turntable');
  const [lyricsData, setLyricsData] = useState<LyricsData | null>(null);
  const [isLoadingLyrics, setIsLoadingLyrics] = useState(false);
  const [lyricsFontSize, setLyricsFontSize] = useState<'sm' | 'base' | 'lg'>('base');

  const lyricsContainerRef = useRef<HTMLDivElement | null>(null);
  const activeLineRef = useRef<HTMLDivElement | null>(null);

  // Load lyrics whenever current song changes
  useEffect(() => {
    if (currentSong) {
      setLyricsData(null);
      loadLyrics();
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

        {/* View Switcher: Turntable Record vs Lyrics */}
        <div className="flex items-center p-1 rounded-full bg-black/60 border border-retro-gold/30 shadow-lg">
          <button
            onClick={() => setActiveView('turntable')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${
              activeView === 'turntable'
                ? 'bg-gradient-to-r from-retro-gold to-amber-500 text-retro-dark shadow-md'
                : 'text-white/60 hover:text-white'
            }`}
          >
            <Disc className="w-3.5 h-3.5" />
            <span>रिकॉर्ड (Record)</span>
          </button>
          <button
            onClick={() => {
              setActiveView('lyrics');
              if (!lyricsData && !isLoadingLyrics) loadLyrics();
            }}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${
              activeView === 'lyrics'
                ? 'bg-gradient-to-r from-retro-gold to-amber-500 text-retro-dark shadow-md'
                : 'text-retro-gold/90 hover:text-retro-gold hover:bg-white/5'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>गीत के बोल (Lyrics)</span>
            {lyricsData?.isSynced && (
              <Sparkles className="w-3 h-3 text-amber-300 animate-pulse" />
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

      {/* Center View: Turntable OR Real-Time Synced Karaoke Lyrics */}
      {activeView === 'turntable' ? (
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center my-2 animate-fade-in">
          {/* Full Edge-to-Edge Rotating CD Album Disc */}
          <div className="relative w-72 h-72 sm:w-80 sm:h-80 md:w-96 md:h-96 flex items-center justify-center my-3">
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

          {/* Quick Lyrics Banner Button */}
          <button
            onClick={() => {
              setActiveView('lyrics');
              if (!lyricsData && !isLoadingLyrics) loadLyrics();
            }}
            className="mt-6 px-4 py-2 rounded-full bg-[#1e1338]/90 border border-retro-gold/30 hover:border-retro-gold text-retro-gold text-xs font-semibold flex items-center gap-2 shadow-lg backdrop-blur-md active:scale-95 transition-all"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>गीत के बोल देखें (View Live Lyrics)</span>
          </button>
        </div>
      ) : (
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
            max={duration || 100}
            value={currentTime}
            onChange={(e) => seek(parseFloat(e.target.value))}
            className="w-full h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer accent-retro-gold"
          />
          <div className="flex justify-between text-[11px] text-white/50 font-mono">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
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
            onClick={togglePlay}
            className="w-16 h-16 rounded-full bg-gradient-to-tr from-retro-gold via-amber-400 to-amber-600 text-retro-dark flex items-center justify-center shadow-xl shadow-retro-gold/20 active:scale-95 transition-all"
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? (
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