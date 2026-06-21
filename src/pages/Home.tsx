import { useEffect } from 'react';
import { useGameStore } from '@/store/gameStore';
import GameCanvas from '@/components/GameCanvas';
import InstructionEditor from '@/components/InstructionEditor';
import ControlPanel from '@/components/ControlPanel';
import InfoPanel from '@/components/InfoPanel';

export default function Home() {
  const spawnInitialSwarm = useGameStore((s) => s.spawnInitialSwarm);
  const bugs = useGameStore((s) => s.state.bugs);

  useEffect(() => {
    if (bugs.length === 0) {
      const t = setTimeout(() => spawnInitialSwarm(), 100);
      return () => clearTimeout(t);
    }
  }, [bugs.length, spawnInitialSwarm]);

  return (
    <div className="min-h-screen bg-[#040807] relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_20%_50%,rgba(16,185,129,0.07),transparent_50%),radial-gradient(ellipse_at_80%_50%,rgba(168,85,247,0.06),transparent_50%),radial-gradient(ellipse_at_50%_0%,rgba(6,182,212,0.04),transparent_40%)]" />
      <div className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage: 'linear-gradient(rgba(52,211,153,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(52,211,153,0.5) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-emerald-500/40 to-transparent pointer-events-none" />
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-fuchsia-500/30 to-transparent pointer-events-none" />

      <div className="relative z-10 max-w-[1600px] mx-auto px-6 py-4">
        <header className="mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="text-4xl animate-pulse-slow" style={{ filter: 'drop-shadow(0 0 12px rgba(52,211,153,0.7))' }}>
                  ⬢
                </div>
                <div className="absolute inset-0 text-4xl opacity-30 blur-sm">⬢</div>
              </div>
              <div>
                <h1 className="text-2xl font-black tracking-[0.2em] bg-gradient-to-r from-emerald-400 via-cyan-400 to-fuchsia-400 bg-clip-text text-transparent">
                  SWARM :: CODEX
                </h1>
                <p className="text-[11px] tracking-[0.3em] text-emerald-500/60 font-mono -mt-0.5">
                  虫群意识 · 群体涌现编程模拟
                </p>
              </div>
            </div>
            <div className="flex items-center gap-5">
              <LegendItem color="#34d399" label="工虫" desc="采集主力" />
              <LegendItem color="#f472b6" label="兵虫" desc="战斗单位" />
              <LegendItem color="#22d3ee" label="侦虫" desc="快速侦察" />
              <div className="w-px h-10 bg-white/10" />
              <div className="text-right">
                <div className="text-[9px] font-mono text-emerald-500/40 tracking-widest">
                  NEURAL_LINK
                </div>
                <div className="flex items-center gap-1 justify-end">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-xs font-mono font-bold text-emerald-400 ml-0.5">
                    ONLINE
                  </span>
                </div>
              </div>
            </div>
          </div>
        </header>

        <div className="mb-4">
          <ControlPanel />
        </div>

        <div className="grid grid-cols-[280px_1fr_300px] gap-4" style={{ height: 'calc(100vh - 170px)' }}>
          <aside className="min-h-0">
            <InstructionEditor />
          </aside>
          <main className="min-h-0 flex items-center justify-center">
            <div className="w-full max-h-full">
              <GameCanvas />
            </div>
          </main>
          <aside className="min-h-0">
            <InfoPanel />
          </aside>
        </div>

        <footer className="mt-4 flex items-center justify-between text-[10px] font-mono text-white/20 tracking-wider">
          <span>
            ◈ INDIVIDUALS: {bugs.length} &nbsp;·&nbsp; INSTRUCTIONS:{' '}
            {useGameStore.getState().instructions.length} &nbsp;·&nbsp;
            FRAME: {String(useGameStore.getState().state.tick).padStart(6, '0')}
          </span>
          <span className="tracking-[0.2em]">
            THE HIVE THINK AS ONE · 蜂群即思想 · 个体即细胞
          </span>
          <span>v1.0.0 ╱ BUILD_{String(Date.now()).slice(-6)}</span>
        </footer>
      </div>
    </div>
  );
}

function LegendItem({ color, label, desc }: { color: string; label: string; desc: string }) {
  return (
    <div className="flex items-center gap-2">
      <div
        className="w-3 h-3 rounded-full"
        style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}` }}
      />
      <div className="leading-tight">
        <div className="text-xs font-bold" style={{ color }}>
          {label}
        </div>
        <div className="text-[9px] text-white/30 -mt-0.5">{desc}</div>
      </div>
    </div>
  );
}
