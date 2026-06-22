import { useGameStore } from '@/store/gameStore';
import { Play, Pause, SkipForward, RotateCcw, Zap, FastForward, History, X } from 'lucide-react';
import PresetManager from './PresetManager';

const SPEEDS = [
  { label: '0.5x', value: 0.5, icon: <Zap size={14} /> },
  { label: '1x', value: 1, icon: <Zap size={14} /> },
  { label: '2x', value: 2, icon: <FastForward size={14} /> },
  { label: '4x', value: 4, icon: <SkipForward size={14} /> },
];

export default function ControlPanel() {
  const { state, setPaused, setSpeed, resetLevel, eventRecorder, toggleRewindMode, seekToTick } = useGameStore();
  const isRewinding = eventRecorder.history.isRewinding;
  const latestTick = eventRecorder.history.currentTick;
  const rewindTick = eventRecorder.history.rewindTick ?? state.tick;
  const canRewind = latestTick >= 60;

  const handleToggleRewind = () => {
    if (isRewinding) {
      toggleRewindMode();
      seekToTick(latestTick);
      setPaused(false);
    } else {
      setPaused(true);
      toggleRewindMode();
    }
  };

  return (
    <div className="flex items-center gap-3 p-3 rounded-xl border border-emerald-500/30 bg-gradient-to-r from-[#0a1410] via-[#0d1a14] to-[#0a1410] shadow-[0_0_20px_rgba(16,185,129,0.08)]">
      <button
        onClick={() => setPaused(!state.paused)}
        className={`relative flex items-center gap-2 px-5 py-2.5 rounded-lg font-bold tracking-wider text-sm transition-all hover:scale-[1.02] active:scale-[0.98] ${
          state.paused
            ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-black shadow-lg shadow-emerald-500/30'
            : 'bg-gradient-to-r from-amber-500 to-orange-500 text-black shadow-lg shadow-amber-500/30'
        } ${isRewinding ? 'opacity-60 cursor-not-allowed' : ''}`}
        disabled={isRewinding}
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

      <button
        onClick={handleToggleRewind}
        disabled={!canRewind && !isRewinding}
        className={`relative flex items-center gap-2 px-4 py-2.5 rounded-lg font-bold tracking-wider text-sm transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-30 disabled:cursor-not-allowed ${
          isRewinding
            ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-black shadow-lg shadow-amber-500/30 animate-pulse-slow'
            : 'border border-cyan-500/40 bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 hover:border-cyan-500/60'
        }`}
      >
        {isRewinding ? (
          <>
            <X size={15} />
            <span>退出倒带</span>
          </>
        ) : (
          <>
            <History size={15} />
            <span>倒带回放</span>
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
            } ${isRewinding ? 'opacity-40 cursor-not-allowed' : ''}`}
            disabled={isRewinding}
          >
            {s.icon}
            <span>{s.label}</span>
          </button>
        ))}
      </div>

      <div className="w-px h-8 bg-white/10" />

      <PresetManager />

      <div className="flex-1" />

      {isRewinding && (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 mr-2">
          <div className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
          <div className="text-xs font-mono">
            <span className="text-amber-400/60">REWIND</span>
            <span className="text-amber-300 font-bold ml-2">
              {String(rewindTick).padStart(6, '0')}
            </span>
            <span className="text-amber-400/40 mx-1">/</span>
            <span className="text-amber-400/70">{String(latestTick).padStart(6, '0')}</span>
          </div>
        </div>
      )}

      <div className="flex items-center gap-3 pr-2 border-r border-white/10 mr-1">
        <div className="text-right">
          <div className="text-[10px] font-mono text-emerald-500/50 tracking-widest">TICK</div>
          <div className="font-mono font-bold text-emerald-400 text-sm leading-none">
            {String(isRewinding ? rewindTick : state.tick).padStart(6, '0')}
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
