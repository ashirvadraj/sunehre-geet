import React from 'react';
import { Song } from '../types';

interface CassetteVisualizerProps {
  song: Song;
  isPlaying: boolean;
}

export const CassetteVisualizer: React.FC<CassetteVisualizerProps> = ({ song, isPlaying }) => {
  return (
    <div className="relative w-80 sm:w-96 h-52 sm:h-60 rounded-2xl bg-gradient-to-b from-[#2a1b10] via-[#1a0f08] to-[#0d0704] border-4 border-[#8b6534] shadow-2xl shadow-black p-3 flex flex-col justify-between overflow-hidden select-none">
      {/* Screw Heads in corners */}
      <div className="absolute top-2 left-2 w-2.5 h-2.5 rounded-full bg-[#5c4320] border border-[#a88242] flex items-center justify-center">
        <div className="w-1.5 h-[1px] bg-black" />
      </div>
      <div className="absolute top-2 right-2 w-2.5 h-2.5 rounded-full bg-[#5c4320] border border-[#a88242] flex items-center justify-center">
        <div className="w-1.5 h-[1px] bg-black" />
      </div>
      <div className="absolute bottom-2 left-2 w-2.5 h-2.5 rounded-full bg-[#5c4320] border border-[#a88242] flex items-center justify-center">
        <div className="w-1.5 h-[1px] bg-black" />
      </div>
      <div className="absolute bottom-2 right-2 w-2.5 h-2.5 rounded-full bg-[#5c4320] border border-[#a88242] flex items-center justify-center">
        <div className="w-1.5 h-[1px] bg-black" />
      </div>

      {/* Top Label & Vintage Header */}
      <div className="relative z-10 bg-[#f4ebd0] text-[#2c1d11] px-3 py-1.5 rounded-lg border-2 border-[#b89355] shadow-inner flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="font-extrabold text-[11px] tracking-wider bg-[#8b261d] text-white px-1.5 py-0.5 rounded">
            SIDE A
          </span>
          <span className="text-[10px] font-bold tracking-widest text-[#5c3e21] uppercase">
            सुनेहरे गीत • Hi-Fi 90
          </span>
        </div>
        <div className="text-[9px] font-bold text-[#8b261d] tracking-tighter">
          STEREO / DOLBY NR
        </div>
      </div>

      {/* Song Handwritten Style Label */}
      <div className="relative z-10 my-1 bg-[#fff8e7] px-3 py-1 rounded border border-[#d4af37]/60 shadow-sm text-center">
        <h4 className="text-xs sm:text-sm font-bold text-[#1f1208] truncate font-serif">
          {song.title}
        </h4>
        <p className="text-[10px] sm:text-[11px] text-[#704820] truncate font-serif">
          {song.artist} {song.movie ? `• ${song.movie}` : ''} ({song.year || song.decade})
        </p>
      </div>

      {/* Center Reel Window & Magnetic Tape Mechanism */}
      <div className="relative z-10 bg-[#120a05] rounded-xl border-2 border-[#5c4320] p-2 flex items-center justify-around shadow-inner my-1">
        {/* Left Tape Spool */}
        <div className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-[#20150d] border-2 border-[#d4af37]/80 flex items-center justify-center shadow-lg">
          {/* Inner Gear Teeth */}
          <div
            className="w-10 h-10 sm:w-12 sm:h-12 rounded-full border-4 border-dashed border-[#e6c66e] flex items-center justify-center"
            style={{ animation: isPlaying ? 'spin 3s linear infinite' : 'none' }}
          >
            <div className="w-4 h-4 rounded-full bg-[#120a05] border border-retro-gold" />
          </div>
        </div>

        {/* Center Transparent Tape Window with Ruler Marks */}
        <div className="relative w-24 sm:w-32 h-9 bg-black/80 rounded-md border border-[#8b6534] flex flex-col items-center justify-center overflow-hidden">
          <div className="flex gap-1 text-[8px] text-[#d4af37]/70 font-mono tracking-widest">
            <span>|</span><span>100</span><span>|</span><span>50</span><span>|</span><span>0</span><span>|</span>
          </div>
          {/* Magnetic Tape Bridge */}
          <div className="w-full h-2 bg-[#4a2e16] border-y border-[#2a1708] mt-1" />
        </div>

        {/* Right Tape Spool */}
        <div className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-[#20150d] border-2 border-[#d4af37]/80 flex items-center justify-center shadow-lg">
          {/* Inner Gear Teeth */}
          <div
            className="w-10 h-10 sm:w-12 sm:h-12 rounded-full border-4 border-dashed border-[#e6c66e] flex items-center justify-center"
            style={{ animation: isPlaying ? 'spin 3s linear infinite' : 'none' }}
          >
            <div className="w-4 h-4 rounded-full bg-[#120a05] border border-retro-gold" />
          </div>
        </div>
      </div>

      {/* Bottom Trapezoid Cutout for Tape Head */}
      <div className="relative z-10 bg-[#24170d] border-t-2 border-[#6b4e28] px-4 py-1 flex items-center justify-between text-[8px] text-[#a88242] font-mono rounded-b-lg">
        <span>TYPE I (NORMAL) BIAS 120µs EQ</span>
        <span className="flex items-center gap-1">
          <span className={`w-1.5 h-1.5 rounded-full ${isPlaying ? 'bg-red-500 animate-pulse' : 'bg-red-950'}`} />
          {isPlaying ? 'PLAYING' : 'PAUSED'}
        </span>
      </div>

      {/* Warm Analog Tube Glow Overlay */}
      <div className="absolute inset-0 bg-gradient-to-tr from-amber-500/10 via-transparent to-amber-600/5 pointer-events-none" />
    </div>
  );
};
