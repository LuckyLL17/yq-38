import { useState, useEffect, useMemo, useRef } from 'react';
import { useGameStore } from '@/store/gameStore';
import type { GameEvent, EventType } from '@/game/types';
import {
  Skull,
  Bug,
  Gem,
  Leaf,
  Swords,
  Sparkles,
  ArrowLeft,
  ArrowRight,
  Play,
  Pause,
  History,
  SkipBack,
  SkipForward,
} from 'lucide-react';

const EVENT_META: Record<EventType, {
  name: string;
  color: string;
  bgColor: string;
  icon: React.ReactNode;
  format: (ev: GameEvent) => string;
}> = {
  bug_death: {
    name: '虫死亡',
    color: '#f87171',
    bgColor: 'rgba(248, 113, 113, 0.15)',
    icon: <Skull size={11} />,
    format: (ev) => {
      const role = (ev.data.role as string) ?? '?';
      const roleName = role === 'worker' ? '工' : role === 'soldier' ? '兵' : '侦';
      const age = ev.data.age as number;
      return `${roleName}虫#${ev.data.bugId} 阵亡 (存活${age ?? '?'}tick)`;
    },
  },
  enemy_killed: {
    name: '敌人消灭',
    color: '#fb923c',
    bgColor: 'rgba(251, 146, 60, 0.15)',
    icon: <Swords size={11} />,
    format: (ev) => {
      const type = (ev.data.type as string) === 'predator' ? '捕食者' : '守卫';
      const hp = ev.data.hp as number;
      return `击杀${type}#${ev.data.enemyId} (HP${hp ?? '?'})`;
    },
  },
  food_deposited: {
    name: '食物入库',
    color: '#fbbf24',
    bgColor: 'rgba(251, 191, 36, 0.15)',
    icon: <Leaf size={11} />,
    format: (ev) => `+${ev.data.amount as number} 食物入库`,
  },
  crystal_deposited: {
    name: '水晶入库',
    color: '#a78bfa',
    bgColor: 'rgba(167, 139, 250, 0.15)',
    icon: <Gem size={11} />,
    format: (ev) => `+${ev.data.amount as number} 水晶入库`,
  },
  resource_collected: {
    name: '资源采集',
    color: '#34d399',
    bgColor: 'rgba(52, 211, 153, 0.15)',
    icon: <Sparkles size={11} />,
    format: (ev) => {
      const type = (ev.data.resourceType as string) === 'crystal' ? '水晶' : '食物';
      return `采集${type}点#${ev.data.resourceId} x${ev.data.amount as number}`;
    },
  },
  bug_born: {
    name: '新个体',
    color: '#c084fc',
    bgColor: 'rgba(192, 132, 252, 0.15)',
    icon: <Bug size={11} />,
    format: (ev) => {
      const role = (ev.data.role as string) ?? '?';
      const roleName = role === 'worker' ? '工' : role === 'soldier' ? '兵' : '侦';
      return `${roleName}虫#${ev.data.bugId} 诞生`;
    },
  },
  instruction_switch: {
    name: '指令切换',
    color: '#22d3ee',
    bgColor: 'rgba(34, 211, 238, 0.15)',
    icon: <SkipForward size={11} />,
    format: (ev) => `切换至 ${ev.data.nextType as string} (剩余${ev.data.remaining as number})`,
  },
};

export default function EventTimeline() {
  const {
    state,
    eventRecorder,
    seekToTick,
    stepBackward,
    stepForward,
    toggleRewindMode,
    setPaused,
  } = useGameStore();

  const [, forceRender] = useState(0);
  const sliderRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  const { history } = eventRecorder;
  const isRewinding = history.isRewinding;
  const latestTick = history.currentTick;
  const displayTick = isRewinding ? (history.rewindTick ?? latestTick) : state.tick;

  useEffect(() => {
    const interval = setInterval(() => {
      forceRender((v) => v + 1);
    }, 120);
    return () => clearInterval(interval);
  }, []);

  const recentEvents = useMemo(() => {
    return [...history.events].slice(-60).reverse();
  }, [history.events.length, history.events[history.events.length - 1]?.id]);

  const eventCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const ev of history.events) {
      counts[ev.type] = (counts[ev.type] ?? 0) + 1;
    }
    return counts;
  }, [history.events.length]);

  const handleSliderDown = (e: React.MouseEvent) => {
    if (latestTick < 10) return;
    isDragging.current = true;
    handleSliderMove(e);
  };

  const handleSliderMove = (e: React.MouseEvent | MouseEvent) => {
    if (!isDragging.current || !sliderRef.current) return;
    const rect = sliderRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const targetTick = Math.floor(ratio * latestTick);
    seekToTick(targetTick);
  };

  useEffect(() => {
    const onUp = () => { isDragging.current = false; };
    const onMove = (e: MouseEvent) => handleSliderMove(e);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('mousemove', onMove);
    return () => {
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('mousemove', onMove);
    };
  }, [latestTick]);

  const handleExitRewind = () => {
    if (isRewinding) {
      toggleRewindMode();
      seekToTick(latestTick);
    }
    setPaused(false);
  };

  const handleEnterRewind = () => {
    setPaused(true);
    if (!isRewinding) {
      toggleRewindMode();
    }
  };

  const progress = latestTick > 0 ? (displayTick / latestTick) * 100 : 0;

  return (
    <div className="rounded-xl border border-cyan-500/25 bg-gradient-to-br from-[#06121a] via-[#0a1620] to-[#060f14] shadow-[0_0_25px_rgba(34,211,238,0.07)] overflow-hidden flex flex-col"
      style={{ height: 'calc(100vh - 170px)' }}
    >
      <div className="px-4 py-3 border-b border-cyan-500/15 bg-black/30 flex items-center justify-between">
        <div>
          <h3 className="text-cyan-400 font-bold tracking-wider text-sm flex items-center gap-2">
            <History size={14} />
            事件时间轴 · 倒带模式
          </h3>
          <p className="text-[11px] text-cyan-500/50 mt-0.5 tracking-wider font-mono">
            {isRewinding
              ? `◉ REWIND_ACTIVE :: TICK ${displayTick}/${latestTick}`
              : `◎ RECORDING :: TICK ${latestTick}`}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          {isRewinding ? (
            <button
              onClick={handleExitRewind}
              className="flex items-center gap-1 px-3 py-1.5 rounded-md text-[11px] font-bold tracking-wider bg-gradient-to-r from-emerald-500 to-teal-500 text-black hover:from-emerald-400 hover:to-teal-400 transition-all shadow-[0_0_10px_rgba(16,185,129,0.3)]"
            >
              <Play size={11} fill="currentColor" />
              回到实时
            </button>
          ) : (
            <button
              onClick={handleEnterRewind}
              disabled={latestTick < 30}
              className="flex items-center gap-1 px-3 py-1.5 rounded-md text-[11px] font-bold tracking-wider bg-amber-500/20 text-amber-400 border border-amber-500/40 hover:bg-amber-500/30 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <Pause size={11} />
              暂停倒带
            </button>
          )}
        </div>
      </div>

      <div className="px-4 py-3 border-b border-white/5 bg-black/10">
        <div className="flex items-center gap-2 mb-2.5">
          <button
            onClick={stepBackward}
            disabled={!isRewinding || displayTick <= 0}
            className="w-8 h-8 flex items-center justify-center rounded-md bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/80 transition-all disabled:opacity-20 disabled:cursor-not-allowed border border-white/5"
          >
            <SkipBack size={13} />
          </button>
          <button
            onClick={() => isRewinding ? seekToTick(Math.max(0, displayTick - 60)) : null}
            disabled={!isRewinding}
            className="w-8 h-8 flex items-center justify-center rounded-md bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/80 transition-all disabled:opacity-20 disabled:cursor-not-allowed border border-white/5"
          >
            <ArrowLeft size={13} />
          </button>
          <div
            ref={sliderRef}
            onMouseDown={handleSliderDown}
            className="flex-1 relative h-3 rounded-full bg-black/50 border border-white/10 cursor-pointer group"
          >
            <div
              className="absolute inset-y-0 left-0 rounded-full transition-all"
              style={{
                width: `${progress}%`,
                background: isRewinding
                  ? 'linear-gradient(90deg, #f59e0b, #fbbf24, #22d3ee)'
                  : 'linear-gradient(90deg, #10b981, #06b6d4, #a855f7)',
                boxShadow: isRewinding
                  ? '0 0 10px rgba(251, 191, 36, 0.5)'
                  : '0 0 10px rgba(6, 182, 212, 0.4)',
              }}
            />
            <div
              className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-white border-2 transition-all group-hover:scale-110 shadow-lg"
              style={{
                left: `calc(${progress}% - 8px)`,
                borderColor: isRewinding ? '#fbbf24' : '#22d3ee',
                boxShadow: `0 0 12px ${isRewinding ? '#fbbf2480' : '#22d3ee80'}`,
              }}
            />
          </div>
          <button
            onClick={() => isRewinding ? seekToTick(Math.min(latestTick, displayTick + 60)) : null}
            disabled={!isRewinding}
            className="w-8 h-8 flex items-center justify-center rounded-md bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/80 transition-all disabled:opacity-20 disabled:cursor-not-allowed border border-white/5"
          >
            <ArrowRight size={13} />
          </button>
          <button
            onClick={stepForward}
            disabled={!isRewinding || displayTick >= latestTick}
            className="w-8 h-8 flex items-center justify-center rounded-md bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/80 transition-all disabled:opacity-20 disabled:cursor-not-allowed border border-white/5"
          >
            <SkipForward size={13} />
          </button>
        </div>

        <div className="flex justify-between text-[10px] font-mono text-white/40">
          <span>TICK 000000</span>
          <span className={isRewinding ? 'text-amber-400 font-bold' : 'text-cyan-400'}>
            ◆ {String(displayTick).padStart(6, '0')} / {String(latestTick).padStart(6, '0')}
          </span>
          <span>TICK {String(latestTick).padStart(6, '0')}</span>
        </div>
      </div>

      <div className="px-4 py-2.5 border-b border-white/5 bg-black/10">
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(EVENT_META) as EventType[]).map((type) => {
            const meta = EVENT_META[type];
            const count = eventCounts[type] ?? 0;
            return (
              <div
                key={type}
                className="flex items-center gap-1 px-2 py-1 rounded-md border text-[10px]"
                style={{
                  backgroundColor: meta.bgColor,
                  borderColor: meta.color + '30',
                  color: meta.color,
                }}
              >
                {meta.icon}
                <span className="font-bold">{meta.name}</span>
                <span className="font-mono opacity-70">×{count}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scroll p-2">
        {recentEvents.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-white/20">
            <History size={32} strokeWidth={1} />
            <div className="mt-2 text-xs tracking-wider">尚无事件记录</div>
            <div className="mt-1 text-[10px] text-white/10 font-mono">开始游戏后事件将在此显示</div>
          </div>
        ) : (
          <div className="space-y-1">
            {recentEvents.map((ev) => {
              const meta = EVENT_META[ev.type];
              const isCurrentView = isRewinding && Math.abs(ev.tick - displayTick) < 15;
              return (
                <div
                  key={ev.id}
                  onClick={() => seekToTick(ev.tick)}
                  className={`group flex items-start gap-2 px-2.5 py-1.5 rounded-md cursor-pointer transition-all border ${
                    isCurrentView
                      ? 'bg-amber-500/15 border-amber-500/40'
                      : 'bg-white/[0.02] border-transparent hover:bg-white/[0.05] hover:border-white/10'
                  }`}
                >
                  <div
                    className="w-5 h-5 shrink-0 rounded flex items-center justify-center mt-0.5"
                    style={{ backgroundColor: meta.bgColor, color: meta.color }}
                  >
                    {meta.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono text-white/30">#{ev.tick}</span>
                      <span className="text-[10px] font-bold" style={{ color: meta.color }}>
                        {meta.name}
                      </span>
                    </div>
                    <div className="text-[11px] text-white/60 truncate group-hover:text-white/80 transition-colors">
                      {meta.format(ev)}
                    </div>
                  </div>
                  <div className="opacity-0 group-hover:opacity-60 text-[9px] font-mono text-white/40 shrink-0 pt-1 transition-opacity">
                    点击跳转
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="px-3 py-2 border-t border-white/5 bg-black/30 text-[9px] font-mono text-white/25 flex items-center justify-between">
        <span>快照: {history.snapshots.length} × 60tick</span>
        <span>事件: {history.events.length} / 3000</span>
      </div>
    </div>
  );
}
