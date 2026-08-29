import React, { useRef } from 'react';
import { X, Share2, Sparkles, Heart, Music2, Quote } from 'lucide-react';
import { Song } from '../types';

interface RetroCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  song: Song | null;
}

export const RetroCardModal: React.FC<RetroCardModalProps> = ({ isOpen, onClose, song }) => {
  const cardRef = useRef<HTMLDivElement | null>(null);

  if (!isOpen || !song) return null;

  const handleShareWhatsApp = () => {
    const text = `🎶 *${song.title}* - ${song.artist}\n${song.movie ? `🎬 मूवी: ${song.movie}\n` : ''}📻 सुनेहरे गीत (Sunehre Geet) पर सुनें!`;
    const url = `whatsapp://send?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-sm bg-[#160c24] border-2 border-retro-gold/40 rounded-3xl p-5 shadow-2xl shadow-black text-white flex flex-col items-center max-h-[95vh] overflow-y-auto scrollbar-none">
        {/* Header */}
        <div className="w-full flex items-center justify-between pb-3 border-b border-white/10 mb-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-retro-gold" />
            <h3 className="font-bold text-sm text-retro-cream">रेट्रो म्यूज़िक कार्ड (Retro Card)</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-white/10 text-white/60">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Vintage Polaroid Card Preview */}
        <div
          ref={cardRef}
          className="w-full bg-[#faf5e6] text-[#2c1d11] p-4 rounded-2xl shadow-2xl border-4 border-[#e6d8b8] flex flex-col items-center select-none"
        >
          {/* Square Album Cover with Vintage Filter Frame */}
          <div className="relative w-full aspect-square rounded-xl overflow-hidden shadow-inner border-2 border-[#d9c79f] mb-3">
            <img
              src={song.coverUrl}
              alt={song.title}
              className="w-full h-full object-cover sepia-[0.15] contrast-105"
              onError={(e) => {
                (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600&auto=format&fit=crop&q=80';
              }}
            />
            {/* Top Retro Stamp */}
            <div className="absolute top-2 left-2 bg-[#8b261d] text-white px-2 py-0.5 rounded text-[9px] font-extrabold tracking-widest uppercase shadow">
              सुनेहरे गीत
            </div>
            <div className="absolute bottom-2 right-2 bg-black/70 backdrop-blur-sm text-white px-2 py-0.5 rounded text-[9px] font-mono shadow">
              {song.decade} Classics
            </div>
          </div>

          {/* Song Details */}
          <div className="w-full text-center space-y-1 my-1">
            <h2 className="text-base sm:text-lg font-extrabold text-[#1f1208] font-serif truncate">
              {song.title}
            </h2>
            <p className="text-xs font-semibold text-[#8b5a2b] font-serif truncate">
              🎤 {song.artist}
            </p>
            {song.movie && (
              <p className="text-[11px] text-[#6b4724] italic font-serif">
                फ़िल्म: {song.movie} ({song.year || song.decade})
              </p>
            )}
          </div>

          {/* Poetic Quote / Music Note Footer */}
          <div className="w-full mt-3 pt-2 border-t border-[#dfcfad] flex items-center justify-between text-[9px] text-[#8b7355] font-serif">
            <span className="flex items-center gap-1">
              <Quote className="w-3 h-3 text-[#8b261d]" /> सदाबहार धुन
            </span>
            <span className="font-mono font-bold tracking-wider text-[#8b261d]">★ GOLDEN ERA ★</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="w-full grid grid-cols-2 gap-2 mt-4">
          <button
            onClick={handleShareWhatsApp}
            className="py-2.5 px-3 rounded-xl bg-green-600 hover:bg-green-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-md"
          >
            <Share2 className="w-4 h-4" />
            <span>WhatsApp शेयर</span>
          </button>
          <button
            onClick={onClose}
            className="py-2.5 px-3 rounded-xl bg-retro-gold hover:bg-retro-gold/90 text-retro-dark font-extrabold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-md"
          >
            <Heart className="w-4 h-4" />
            <span>पसंद आया</span>
          </button>
        </div>
      </div>
    </div>
  );
};
