import { useGameStore } from '@/store/gameStore';
import { Play, Pause, SkipForward, RotateCcw, Zap, FastForward } from 'lucide-react';
import PresetManager from './PresetManager';

const SPEEDS = [
  { label: '0.5x', value: 0.5, icon: <Zap size={14} /> },
  { label: '1x', value: 1, icon: <Zap size={14} /> },
  { label: '2x', value: 2, icon: <FastForward size={14} /> },
  { label: '4x', value: 4, icon: <SkipForward size={14} /> },
];

export default function ControlPanel() {
  const { state, setPaused, setSpeed, resetLevel } = useGameStore();

  return (
    <div className="flex items-center gap-3 p-3 rounded-xl border border-emerald-500/30 bg-gradient-to-r from-[#0a1410] via-[#0d1a14] to-[#0a1410] shadow-[0_0_20px_rgba(16,185,129,0.08)]">
      <button
        onClick={() => setPaused(!state.paused)}
        className={`relative flex items-center gap-2 px-5 py-2.5 rounded-lg font-bold tracking-wider text-sm transition-all hover:scale-[1.02] active:scale-[0.98] ${
          state.paused
            ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-black shadow-lg shadow-emerald-500/30'
            : 'bg-gradient-to-r from-amber-500 to-orange-500 text-black shadow-lg shadow-amber-500/30'
        }`}
      >
        {state.paused ? (
          <>
            <Play size={16} fill="currentColor" />
            <span>开始</span>
          </>
        ) : (
          <>
            <Pause size={16} fill="currentColor" />
            <span>暂停</span>
          </>
        )}
      </button>

      <div className="flex items-center gap-1 px-1.5 py-1 rounded-lg border border-white/10 bg-black/30">
        {SPEEDS.map((s) => (
          <button
            key={s.value}
            onClick={() => setSpeed(s.value)}
            className={`relative flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-bold transition-all ${
              state.speed === s.value
                ? 'bg-cyan-500/20 text-cyan-400 shadow-[inset_0_0_8px_rgba(34,211,238,0.3)]'
                : 'text-white/40 hover:text-white/70 hover:bg-white/5'
            }`}
          >
            {s.icon}
            <span>{s.label}</span>
          </button>
        ))}
      </div>

      <div className="w-px h-8 bg-white/10" />

      <PresetManager />

      <div className="flex-1" />

      <div className="flex items-center gap-3 pr-2 border-r border-white/10 mr-1">
        <div className="text-right">
          <div className="text-[10px] font-mono text-emerald-500/50 tracking-widest">TICK</div>
          <div className="font-mono font-bold text-emerald-400 text-sm leading-none">
            {String(state.tick).padStart(6, '0')}
          </div>
        </div>
        <div className="w-px h-8 bg-white/10" />
        <div className="text-right">
          <div className="text-[10px] font-mono text-emerald-500/50 tracking-widest">LEVEL</div>
          <div className="font-mono font-bold text-fuchsia-400 text-sm leading-none">
            {String(state.level).padStart(2, '0')}
          </div>
        </div>
      </div>

      <button
        onClick={resetLevel}
        className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-red-500/30 bg-red-500/10 text-red-400 text-xs font-bold tracking-wide hover:bg-red-500/20 hover:border-red-500/50 transition-all active:scale-[0.97]"
      >
        <RotateCcw size={13} />
        <span>重置</span>
      </button>
    </div>
  );
}
