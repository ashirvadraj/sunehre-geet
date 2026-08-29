import React, { useState } from 'react';
import { X, Sliders, Volume2, Sparkles, Radio, Music, Disc } from 'lucide-react';

export type EqPreset = 'warm_vinyl' | 'vocal_clarity' | 'bass_boost' | 'vintage_radio' | 'flat';

interface EqualizerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const EqualizerModal: React.FC<EqualizerModalProps> = ({ isOpen, onClose }) => {
  const [activePreset, setActivePreset] = useState<EqPreset>(() => {
    return (localStorage.getItem('sunehre_eq_preset') as EqPreset) || 'warm_vinyl';
  });

  const [bassLevel, setBassLevel] = useState<number>(4);
  const [trebleLevel, setTrebleLevel] = useState<number>(2);

  if (!isOpen) return null;

  const handleSelectPreset = (preset: EqPreset) => {
    setActivePreset(preset);
    localStorage.setItem('sunehre_eq_preset', preset);
    if (preset === 'warm_vinyl') {
      setBassLevel(4);
      setTrebleLevel(1);
    } else if (preset === 'vocal_clarity') {
      setBassLevel(1);
      setTrebleLevel(5);
    } else if (preset === 'bass_boost') {
      setBassLevel(8);
      setTrebleLevel(2);
    } else if (preset === 'vintage_radio') {
      setBassLevel(-2);
      setTrebleLevel(4);
    } else {
      setBassLevel(0);
      setTrebleLevel(0);
    }
  };

  const presets = [
    {
      id: 'warm_vinyl' as EqPreset,
      name: '70s Warm Vinyl',
      desc: 'विंटेज विनाइल रिकॉर्ड का गर्म और मीठा साउंड (Warm Tube Sound)',
      icon: Disc,
      color: 'from-amber-700 to-amber-900',
    },
    {
      id: 'vocal_clarity' as EqPreset,
      name: 'Golden Voices (आवाज स्पष्टता)',
      desc: 'लता, किशोर, रफ़ी, मुकेश की आवाज को क्रिस्टल स्पष्ट बनाए',
      icon: Sparkles,
      color: 'from-yellow-600 to-amber-700',
    },
    {
      id: 'bass_boost' as EqPreset,
      name: 'Deep Retro Bass',
      desc: 'आर.डी. बर्मन और 80s के क्लासिक ड्रम और बास को बूस्ट करें',
      icon: Volume2,
      color: 'from-red-800 to-amber-900',
    },
    {
      id: 'vintage_radio' as EqPreset,
      name: 'Vividh Bharati Radio',
      desc: '80s के ट्रांजिस्टर रेडियो की पुरानी यादों वाला सुर',
      icon: Radio,
      color: 'from-orange-800 to-amber-950',
    },
    {
      id: 'flat' as EqPreset,
      name: 'Studio Flat / Original',
      desc: 'ओरिजिनल मास्टर रिकॉर्डिंग जैसा साउंड',
      icon: Music,
      color: 'from-zinc-800 to-zinc-950',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-md bg-[#160c24] border-2 border-retro-gold/40 rounded-3xl p-5 shadow-2xl shadow-black text-white flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-retro-gold/20 text-retro-gold border border-retro-gold/30">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-retro-cream">विंटेज साउंड इक्वलाइज़र (Equalizer)</h3>
              <p className="text-[11px] text-white/50">एनालॉग ऑडियो मोड्स और साउंड ट्यूनिंग</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-white/10 text-white/60 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Preset Cards */}
        <div className="flex-1 overflow-y-auto py-3 space-y-2.5 scrollbar-none">
          <p className="text-xs font-bold text-retro-gold uppercase tracking-wider">साउंड प्रीसेट्स (Sound Presets)</p>
          {presets.map((p) => {
            const Icon = p.icon;
            const isSelected = activePreset === p.id;
            return (
              <div
                key={p.id}
                onClick={() => handleSelectPreset(p.id)}
                className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center gap-3.5 ${
                  isSelected
                    ? 'bg-gradient-to-r ' + p.color + ' border-retro-gold shadow-lg shadow-retro-gold/20 scale-[1.02]'
                    : 'bg-white/5 border-white/10 hover:border-retro-gold/30 hover:bg-white/10'
                }`}
              >
                <div className={`p-2.5 rounded-xl ${isSelected ? 'bg-white/20 text-white' : 'bg-black/30 text-retro-gold'}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-xs sm:text-sm text-retro-cream truncate">{p.name}</h4>
                    {isSelected && (
                      <span className="text-[9px] font-extrabold bg-retro-gold text-retro-dark px-2 py-0.5 rounded-full">
                        ACTIVE
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-white/60 line-clamp-1 mt-0.5">{p.desc}</p>
                </div>
              </div>
            );
          })}

          {/* Quick Tone Sliders */}
          <div className="mt-4 p-3.5 rounded-2xl bg-black/30 border border-white/10 space-y-3">
            <div className="flex justify-between items-center text-xs">
              <span className="text-retro-gold font-bold">Bass (बास)</span>
              <span className="text-white/60 font-mono">{bassLevel > 0 ? `+${bassLevel}` : bassLevel} dB</span>
            </div>
            <input
              type="range"
              min="-4"
              max="10"
              value={bassLevel}
              onChange={(e) => setBassLevel(Number(e.target.value))}
              className="w-full accent-retro-gold cursor-pointer"
            />

            <div className="flex justify-between items-center text-xs pt-1">
              <span className="text-retro-gold font-bold">Treble (खराश/स्पष्टता)</span>
              <span className="text-white/60 font-mono">{trebleLevel > 0 ? `+${trebleLevel}` : trebleLevel} dB</span>
            </div>
            <input
              type="range"
              min="-4"
              max="10"
              value={trebleLevel}
              onChange={(e) => setTrebleLevel(Number(e.target.value))}
              className="w-full accent-retro-gold cursor-pointer"
            />
          </div>
        </div>

        {/* Done Button */}
        <button
          onClick={onClose}
          className="w-full py-3 rounded-xl bg-retro-gold text-retro-dark font-extrabold text-sm active:scale-95 transition-all shadow-lg hover:brightness-110"
        >
          लागू करें (Apply Sound Preset)
        </button>
      </div>
    </div>
  );
};
