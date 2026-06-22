import { useEffect, useRef } from 'react';
import { useGameStore } from '@/store/gameStore';
import { GRID_CONSTANTS } from '@/game/engine';
import type { TerrainType, Bug, Enemy, ResourceNode, GameState, PheromoneMap, Squad } from '@/game/types';

const { GRID_W, GRID_H, CELL } = GRID_CONSTANTS;
const CANVAS_W = GRID_W * CELL;
const CANVAS_H = GRID_H * CELL;

const TERRAIN_COLORS: Record<TerrainType, { base: string; detail: string }> = {
  plain: { base: '#0d1a14', detail: '#12261c' },
  forest: { base: '#0a2418', detail: '#143824' },
  rock: { base: '#1a1f24', detail: '#2a3238' },
  water: { base: '#071824', detail: '#0e2a3c' },
  nest: { base: '#1a1030', detail: '#2a1c4a' },
  resource: { base: '#202010', detail: '#302d18' },
};

const BUG_COLORS = {
  worker: { body: '#34d399', glow: 'rgba(52, 211, 153, 0.45)', eye: '#064e3b' },
  soldier: { body: '#f472b6', glow: 'rgba(244, 114, 182, 0.5)', eye: '#4c0519' },
  scout: { body: '#22d3ee', glow: 'rgba(34, 211, 238, 0.45)', eye: '#083344' },
};

function safeArc(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  s = 0,
  e = Math.PI * 2
) {
  const radius = Math.max(0.1, Math.abs(r));
  ctx.beginPath();
  ctx.arc(x, y, radius, s, e);
}

function heatColor(strength: number): [number, number, number] {
  const t = Math.max(0, Math.min(1, strength));
  if (t < 0.25) {
    const k = t / 0.25;
    return [
      Math.floor(10 + k * 20),
      Math.floor(30 + k * 50),
      Math.floor(80 + k * 120),
    ];
  } else if (t < 0.5) {
    const k = (t - 0.25) / 0.25;
    return [
      Math.floor(30 + k * 40),
      Math.floor(80 + k * 100),
      Math.floor(200 - k * 40),
    ];
  } else if (t < 0.75) {
    const k = (t - 0.5) / 0.25;
    return [
      Math.floor(70 + k * 150),
      Math.floor(180 + k * 50),
      Math.floor(160 - k * 100),
    ];
  } else {
    const k = (t - 0.75) / 0.25;
    return [
      Math.floor(220 + k * 35),
      Math.floor(230 - k * 100),
      Math.floor(60 - k * 40),
    ];
  }
}

function drawPheromoneHeatmap(ctx: CanvasRenderingContext2D, map: PheromoneMap, tick: number) {
  const pulse = 0.92 + Math.sin(tick * 0.04) * 0.08;
  const cs = map.cellSize;

  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      const cell = map.cells[y][x];
      if (cell.strength <= 0.01) continue;

      const normStrength = cell.strength / map.maxStrength;
      if (normStrength < 0.02) continue;

      const [r, g, b] = heatColor(normStrength);
      const alpha = Math.min(0.55, normStrength * 0.85) * pulse;

      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
      ctx.fillRect(x * cs, y * cs, cs + 0.5, cs + 0.5);

      if (normStrength > 0.5) {
        const glowAlpha = Math.min(0.25, (normStrength - 0.5) * 0.7) * pulse;
        const gradient = ctx.createRadialGradient(
          x * cs + cs / 2, y * cs + cs / 2, 0,
          x * cs + cs / 2, y * cs + cs / 2, cs * 2.5
        );
        gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${glowAlpha})`);
        gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
        ctx.fillStyle = gradient;
        ctx.fillRect(x * cs - cs * 2, y * cs - cs * 2, cs * 5, cs * 5);
      }
    }
  }
}

export default function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>();
  const lastStepRef = useRef(0);
  const scaleRef = useRef(1);
  const stateRef = useRef<GameState>(useGameStore.getState().state);
  const pausedRef = useRef(false);
  const levelCompleteRef = useRef(false);
  const isRewindingRef = useRef(false);
  const rewindTickRef = useRef<number | null>(null);
  const latestTickRef = useRef(0);
  const showPheromoneRef = useRef(false);

  useEffect(() => {
    const unsub = useGameStore.subscribe((s) => {
      stateRef.current = s.state;
      pausedRef.current = s.state.paused;
      levelCompleteRef.current = s.state.levelComplete;
      isRewindingRef.current = s.eventRecorder.history.isRewinding;
      rewindTickRef.current = s.eventRecorder.history.rewindTick;
      latestTickRef.current = s.eventRecorder.history.currentTick;
      showPheromoneRef.current = s.showPheromoneLayer;
    });
    return unsub;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const updateScale = () => {
      const maxW = container.clientWidth - 4;
      const scale = Math.max(0.2, maxW / CANVAS_W);
      scaleRef.current = scale;
      canvas.width = CANVAS_W * scale;
      canvas.height = CANVAS_H * scale;
    };
    updateScale();
    window.addEventListener('resize', updateScale);

    const draw = (ctx: CanvasRenderingContext2D) => {
      const state = stateRef.current;
      const { terrain, bugs, enemies, resources, particles, nestPos, tick, squads } = state;
      const squadColorMap = new Map(squads.map(s => [s.id, s.color]));

      ctx.fillStyle = '#050a08';
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

      for (let gy = 0; gy < GRID_H; gy++) {
        for (let gx = 0; gx < GRID_W; gx++) {
          const cell = terrain[gy][gx];
          const colors = TERRAIN_COLORS[cell.type];
          const px = gx * CELL;
          const py = gy * CELL;
          ctx.fillStyle = colors.base;
          ctx.fillRect(px, py, CELL, CELL);

          const noise = ((gx * 31 + gy * 17) % 7) / 7;
          if (noise > 0.55) {
            ctx.fillStyle = colors.detail;
            ctx.fillRect(px + 2, py + 2, CELL - 4, CELL - 4);
          }

          if (cell.type === 'forest') {
            ctx.fillStyle = '#1e5631';
            const tx = px + CELL / 2;
            const ty = py + CELL / 2;
            safeArc(ctx, tx - 2, ty - 1, 3); ctx.fill();
            safeArc(ctx, tx + 2, ty + 2, 2.5); ctx.fill();
          } else if (cell.type === 'rock') {
            ctx.fillStyle = '#3f4550';
            const tx = px + CELL / 2;
            const ty = py + CELL / 2;
            ctx.beginPath();
            ctx.moveTo(tx - 4, ty + 3);
            ctx.lineTo(tx, ty - 4);
            ctx.lineTo(tx + 4, ty + 3);
            ctx.closePath();
            ctx.fill();
          } else if (cell.type === 'water') {
            ctx.fillStyle = 'rgba(56, 189, 248, 0.18)';
            const waveX = Math.sin((gx + gy + tick * 0.02) * 0.5) * 2;
            ctx.fillRect(px + 2 + waveX, py + CELL / 2 - 1, CELL - 4, 2);
          }
        }
      }

      const nestGlow = 0.5 + Math.sin(tick * 0.06) * 0.1;
      const gradient = ctx.createRadialGradient(
        nestPos.x, nestPos.y, 0.1,
        nestPos.x, nestPos.y, 60
      );
      gradient.addColorStop(0, `rgba(168, 85, 247, ${nestGlow * 0.5})`);
      gradient.addColorStop(0.5, 'rgba(168, 85, 247, 0.15)');
      gradient.addColorStop(1, 'rgba(168, 85, 247, 0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(nestPos.x - 60, nestPos.y - 60, 120, 120);

      ctx.strokeStyle = '#a855f7';
      ctx.lineWidth = 2;
      safeArc(ctx, nestPos.x, nestPos.y, 22); ctx.stroke();
      ctx.strokeStyle = 'rgba(168, 85, 247, 0.4)';
      ctx.lineWidth = 1;
      safeArc(ctx, nestPos.x, nestPos.y, 30); ctx.stroke();

      ctx.fillStyle = '#c084fc';
      safeArc(ctx, nestPos.x, nestPos.y, 10); ctx.fill();
      ctx.fillStyle = '#fde68a';
      safeArc(ctx, nestPos.x, nestPos.y, 4); ctx.fill();

      if (showPheromoneRef.current) {
        drawPheromoneHeatmap(ctx, state.pheromoneMap, tick);
      }

      for (const r of resources) drawResource(ctx, r, tick);
      for (const e of enemies) drawEnemy(ctx, e, tick);
      for (const b of bugs) drawBug(ctx, b, tick, squadColorMap);

      for (const p of particles) {
        const alpha = Math.max(0, p.life / Math.max(1, p.maxLife));
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        safeArc(ctx, p.pos.x, p.pos.y, Math.max(0.1, p.size * alpha));
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      ctx.strokeStyle = 'rgba(52, 211, 153, 0.12)';
      ctx.lineWidth = 1;
      for (let x = 0; x <= GRID_W; x += 5) {
        ctx.beginPath();
        ctx.moveTo(x * CELL, 0);
        ctx.lineTo(x * CELL, CANVAS_H);
        ctx.stroke();
      }
      for (let y = 0; y <= GRID_H; y += 5) {
        ctx.beginPath();
        ctx.moveTo(0, y * CELL);
        ctx.lineTo(CANVAS_W, y * CELL);
        ctx.stroke();
      }

      const borderGrad = ctx.createLinearGradient(0, 0, CANVAS_W, 0);
      borderGrad.addColorStop(0, 'rgba(52, 211, 153, 0.4)');
      borderGrad.addColorStop(0.5, 'rgba(168, 85, 247, 0.3)');
      borderGrad.addColorStop(1, 'rgba(52, 211, 153, 0.4)');
      ctx.strokeStyle = borderGrad;
      ctx.lineWidth = 2;
      ctx.strokeRect(1, 1, CANVAS_W - 2, CANVAS_H - 2);
    };

    const loop = (t: number) => {
      rafRef.current = requestAnimationFrame(loop);

      const spd = stateRef.current.speed;
      const interval = Math.max(8, 32 / spd);
      if (t - lastStepRef.current >= interval && !pausedRef.current && !levelCompleteRef.current && !isRewindingRef.current) {
        const maxSteps = Math.min(2, Math.ceil(spd));
        for (let i = 0; i < maxSteps; i++) {
          useGameStore.getState().step();
        }
        lastStepRef.current = t;
      }

      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.save();
      const scale = scaleRef.current;
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      try {
        draw(ctx);
      } finally {
        ctx.restore();
      }
    };

    rafRef.current = requestAnimationFrame(loop);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', updateScale);
    };
  }, []);

  const tick = useGameStore((s) => s.state.tick);
  const paused = useGameStore((s) => s.state.paused);
  const levelComplete = useGameStore((s) => s.state.levelComplete);
  const levelObjective = useGameStore((s) => s.state.levelObjective);
  const isRewinding = useGameStore((s) => s.eventRecorder.history.isRewinding);
  const rewindTick = useGameStore((s) => s.eventRecorder.history.rewindTick);
  const latestTick = useGameStore((s) => s.eventRecorder.history.currentTick);

  const progress = latestTick > 0
    ? Math.round(((rewindTick ?? tick) / latestTick) * 100)
    : 0;

  return (
    <div
      ref={containerRef}
      className="relative w-full rounded-xl overflow-hidden border border-emerald-500/30 bg-[#050a08] shadow-[0_0_40px_rgba(16,185,129,0.1)]"
      style={{ aspectRatio: `${CANVAS_W}/${CANVAS_H}` }}
    >
      <canvas
        ref={canvasRef}
        className="block w-full h-full"
        style={{ imageRendering: 'pixelated' }}
      />
      <div className="absolute top-3 left-3 pointer-events-none">
        <div className="text-[10px] font-mono text-emerald-400/60 tracking-widest">
          {isRewinding ? 'SWARM::REWIND_MODE ◀' : 'SWARM::NETWORK_ACTIVE'}
        </div>
      </div>
      {isRewinding && (
        <div className="absolute top-3 right-3 pointer-events-none">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-amber-500/15 border border-amber-500/40 backdrop-blur-sm">
            <div className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
            <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse absolute ml-0" />
            <span className="text-[11px] font-mono font-bold text-amber-300 tracking-wider ml-3">
              REWIND · TICK {String(rewindTick ?? 0).padStart(6, '0')}
            </span>
            <span className="text-[10px] font-mono text-amber-400/60">
              / {String(latestTick).padStart(6, '0')} · {progress}%
            </span>
          </div>
        </div>
      )}
      {isRewinding && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 pointer-events-none">
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/10 border border-amber-500/30 backdrop-blur-sm">
            <span className="text-[10px] text-amber-400/80 font-mono tracking-widest">
              ◀◀ 使用右侧时间轴滑块或事件列表查看历史帧 ▶▶
            </span>
          </div>
        </div>
      )}
      {paused && !levelComplete && !isRewinding && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center backdrop-blur-sm">
          <div className="text-center">
            <div className="text-5xl font-black text-amber-400 tracking-[0.3em] mb-2"
              style={{ fontFamily: 'monospace', textShadow: '0 0 30px rgba(251,191,36,0.6)' }}>
              ⏸ PAUSED
            </div>
            <div className="text-amber-200/60 text-sm tracking-wider">调整指令序列后继续</div>
          </div>
        </div>
      )}
      {levelComplete && (
        <div className="absolute inset-0 bg-black/70 flex items-center justify-center backdrop-blur-sm z-10">
          <div className="text-center p-8 rounded-2xl border-2 border-emerald-500/50 bg-emerald-500/5"
            style={{ boxShadow: '0 0 60px rgba(52,211,153,0.3)' }}>
            <div className="text-6xl mb-4">✦</div>
            <div className="text-3xl font-black text-emerald-400 tracking-wider mb-3"
              style={{ textShadow: '0 0 20px rgba(52,211,153,0.8)' }}>
              关卡完成！
            </div>
            <div className="text-emerald-200/70 mb-6">{levelObjective} — 达成</div>
            <button
              onClick={() => useGameStore.getState().nextLevel()}
              className="px-8 py-3 bg-gradient-to-r from-emerald-500 to-cyan-500 text-black font-bold rounded-lg hover:from-emerald-400 hover:to-cyan-400 transition-all tracking-wider shadow-lg shadow-emerald-500/30"
            >
              进入下一关卡 →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function drawBug(ctx: CanvasRenderingContext2D, bug: Bug, tick: number, squadColorMap: Map<string, string>) {
  const roleColors = BUG_COLORS[bug.role];
  const squadColor = squadColorMap.get(bug.squadId) ?? roleColors.body;
  const angle = Math.atan2(bug.vel.vy, bug.vel.vx);
  const wobble = Math.sin(tick * 0.3 + bug.id) * 0.1;

  ctx.save();
  ctx.translate(bug.pos.x, bug.pos.y);
  ctx.rotate(angle + wobble);

  ctx.shadowColor = squadColor + '80';
  ctx.shadowBlur = 10;

  const size = bug.role === 'soldier' ? 4.5 : bug.role === 'scout' ? 2.8 : 3.5;

  ctx.fillStyle = squadColor;
  ctx.beginPath();
  ctx.ellipse(0, 0, size * 1.5, size, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.fillStyle = roleColors.eye;
  safeArc(ctx, size * 0.8, -size * 0.35, size * 0.25); ctx.fill();
  safeArc(ctx, size * 0.8, size * 0.35, size * 0.25); ctx.fill();

  if (bug.role === 'soldier') {
    ctx.strokeStyle = squadColor;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(size * 1.3, -size * 0.6);
    ctx.lineTo(size * 2.2, -size * 0.9);
    ctx.moveTo(size * 1.3, size * 0.6);
    ctx.lineTo(size * 2.2, size * 0.9);
    ctx.stroke();
  }

  if (bug.carrying > 0) {
    ctx.fillStyle = bug.carrying >= 5 ? '#a78bfa' : '#fbbf24';
    safeArc(ctx, -size * 0.8, 0, size * 0.5); ctx.fill();
  }

  ctx.restore();

  ctx.fillStyle = squadColor;
  safeArc(ctx, bug.pos.x, bug.pos.y - size - 4, 1.5);
  ctx.fill();

  if (bug.hp < bug.maxHp) {
    const w = 10;
    const hpRatio = bug.hp / bug.maxHp;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(bug.pos.x - w / 2, bug.pos.y - 8, w, 2);
    ctx.fillStyle = hpRatio > 0.5 ? '#34d399' : hpRatio > 0.25 ? '#fbbf24' : '#f87171';
    ctx.fillRect(bug.pos.x - w / 2, bug.pos.y - 8, w * hpRatio, 2);
  }
}

function drawEnemy(ctx: CanvasRenderingContext2D, enemy: Enemy, tick: number) {
  const pulse = 1 + Math.sin(tick * 0.1 + enemy.id) * 0.08;
  ctx.save();
  ctx.translate(enemy.pos.x, enemy.pos.y);

  ctx.shadowColor = enemy.type === 'predator' ? 'rgba(239,68,68,0.5)' : 'rgba(249,115,22,0.5)';
  ctx.shadowBlur = 14;

  const color = enemy.type === 'predator' ? '#ef4444' : '#f97316';
  const size = (enemy.type === 'predator' ? 7 : 5) * pulse;

  ctx.fillStyle = color;
  ctx.beginPath();
  const spikes = enemy.type === 'predator' ? 8 : 6;
  for (let i = 0; i < spikes; i++) {
    const a = (i / spikes) * Math.PI * 2;
    const r = i % 2 === 0 ? size : size * 0.5;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.fillStyle = '#1f0a0a';
  safeArc(ctx, -1, -1, 1.5); ctx.fill();
  safeArc(ctx, 1.5, -0.5, 1.2); ctx.fill();

  ctx.restore();

  const w = 22;
  const hpRatio = enemy.hp / enemy.maxHp;
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(enemy.pos.x - w / 2, enemy.pos.y - 14, w, 3);
  ctx.fillStyle = '#f87171';
  ctx.fillRect(enemy.pos.x - w / 2, enemy.pos.y - 14, w * hpRatio, 3);
}

function drawResource(ctx: CanvasRenderingContext2D, r: ResourceNode, tick: number) {
  const pulse = 1 + Math.sin(tick * 0.08 + r.id) * 0.12;
  ctx.save();
  ctx.translate(r.pos.x, r.pos.y);

  const isCrystal = r.type === 'crystal';
  ctx.shadowColor = isCrystal ? 'rgba(167,139,250,0.7)' : 'rgba(251,191,36,0.7)';
  ctx.shadowBlur = 18;

  const color = isCrystal ? '#a78bfa' : '#fbbf24';
  const darkColor = isCrystal ? '#7c3aed' : '#b45309';
  const size = (5 + (r.amount / Math.max(1, r.maxAmount)) * 4) * pulse;

  ctx.fillStyle = color;
  ctx.strokeStyle = darkColor;
  ctx.lineWidth = 1.5;

  if (isCrystal) {
    ctx.beginPath();
    ctx.moveTo(0, -size);
    ctx.lineTo(size * 0.7, -size * 0.2);
    ctx.lineTo(size * 0.5, size);
    ctx.lineTo(-size * 0.5, size);
    ctx.lineTo(-size * 0.7, -size * 0.2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
      const x = Math.cos(a) * size;
      const y = Math.sin(a) * size;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  ctx.shadowBlur = 0;

  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  safeArc(ctx, -size * 0.3, -size * 0.4, size * 0.2); ctx.fill();

  ctx.restore();

  if (r.amount < r.maxAmount * 0.5) {
    const w = 18;
    const ratio = r.amount / Math.max(1, r.maxAmount);
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(r.pos.x - w / 2, r.pos.y + 10, w, 2);
    ctx.fillStyle = color;
    ctx.fillRect(r.pos.x - w / 2, r.pos.y + 10, w * ratio, 2);
  }
}
