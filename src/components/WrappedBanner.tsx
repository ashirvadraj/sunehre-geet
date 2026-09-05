import React from 'react';
import { Sparkles, Disc3, ChevronRight, Trophy } from 'lucide-react';

interface WrappedBannerProps {
  onOpenWrapped: () => void;
}

export const WrappedBanner: React.FC<WrappedBannerProps> = ({ onOpenWrapped }) => {
  const currentYear = new Date().getFullYear();
  const currentMonthName = new Date().toLocaleString('en-US', { month: 'long' });

  return (
    <section className="relative overflow-hidden rounded-3xl p-5 bg-gradient-to-r from-[#2c1038] via-[#1a0f30] to-[#0d1b2a] border border-amber-500/30 shadow-2xl group hover:border-amber-500/60 transition-all">
      {/* Decorative background blurs */}
      <div className="absolute top-0 right-0 -mr-6 -mt-6 w-36 h-36 bg-rose-500/15 rounded-full blur-2xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 -ml-6 -mb-6 w-36 h-36 bg-amber-500/15 rounded-full blur-2xl pointer-events-none" />

      <div className="relative z-10 flex items-center justify-between gap-4">
        <div className="space-y-1.5 flex-1">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-gradient-to-r from-amber-500/20 to-rose-500/20 text-amber-300 text-[10px] font-bold tracking-wider uppercase border border-amber-500/30">
            <Sparkles className="w-3 h-3 text-amber-400 animate-pulse" />
            <span>SPOTIFY-STYLE WRAPPED</span>
          </div>

          <h3 className="text-lg font-bold text-[#FFF4E0] font-serif leading-snug">
            Your {currentYear} & {currentMonthName} Wrapped
          </h3>

          <p className="text-xs text-amber-100/70 line-clamp-2">
            See your top evergreen songs, favorite singers, total minutes listened, and your musical personality!
          </p>
        </div>

        <button
          onClick={onOpenWrapped}
          className="flex-shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-amber-500 via-rose-500 to-purple-600 text-white font-bold text-xs shadow-lg shadow-rose-500/20 hover:scale-105 active:scale-95 transition-all"
        >
          <Trophy className="w-4 h-4 text-amber-200" />
          <span>Explore</span>
          <ChevronRight className="w-3.5 h-3.5 text-white/80" />
        </button>
      </div>
    </section>
  );
};
