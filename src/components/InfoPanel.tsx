import { useGameStore } from '@/store/gameStore';
import { Bug, Skull, Leaf, Gem, Target, TrendingUp, Sparkles, Zap } from 'lucide-react';
import { INSTRUCTION_META, MUTATION_LIBRARY, RARITY_LABEL } from '@/game/types';

export default function InfoPanel() {
  const { state } = useGameStore();
  const { bugs, levelObjective, levelProgress, levelTarget, totalFood, totalCrystal, enemiesKilled, resources, squads, evolution } = state;

  const roles = {
    worker: bugs.filter((b) => b.role === 'worker').length,
    soldier: bugs.filter((b) => b.role === 'soldier').length,
    scout: bugs.filter((b) => b.role === 'scout').length,
  };

  const remainingResources = resources.reduce((sum, r) => sum + r.amount, 0);
  const progress = Math.min(100, (levelProgress / levelTarget) * 100);

  return (
    <div className="h-full flex flex-col rounded-xl border border-fuchsia-500/20 bg-gradient-to-br from-[#0f0a18] to-[#0d1410] overflow-hidden shadow-[0_0_25px_rgba(168,85,247,0.06)]">
      <div className="px-4 py-3 border-b border-fuchsia-500/15 bg-black/30">
        <h3 className="text-fuchsia-400 font-bold tracking-wider text-sm flex items-center gap-2">
          <span className="text-lg">⬡</span>
          虫群意识 · 状态监测
        </h3>
        <p className="text-[11px] text-fuchsia-500/50 mt-0.5 tracking-wider">
          SWARM_CONSCIOUSNESS / v2.3.1
        </p>
      </div>

      <div className="p-3 space-y-3 flex-1 overflow-y-auto custom-scroll">
        <div className="p-3 rounded-lg border border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 to-transparent">
          <div className="flex items-center gap-2 mb-2">
            <Target size={14} className="text-emerald-400" />
            <span className="text-xs font-bold text-emerald-400 tracking-wider">当前任务</span>
          </div>
          <div className="text-sm text-white/80 mb-2.5 font-medium">{levelObjective}</div>
          <div className="relative h-2.5 rounded-full bg-black/50 border border-white/10 overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
              style={{
                width: `${progress}%`,
                background: 'linear-gradient(90deg, #10b981, #06b6d4, #a855f7)',
                boxShadow: `0 0 12px ${progress >= 100 ? '#a855f7' : '#10b981'}80`,
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent pointer-events-none" />
          </div>
          <div className="flex justify-between mt-1.5 text-[10px] font-mono">
            <span className="text-emerald-400/70">{levelProgress} / {levelTarget}</span>
            <span className="text-cyan-400/70">{progress.toFixed(0)}%</span>
          </div>
        </div>

        <EvolutionCard evolution={evolution} bugs={bugs} />

        <div className="grid grid-cols-2 gap-2">
          <StatCard icon={<Bug size={13} />} label="虫群规模" value={bugs.length} sub={`工${roles.worker}·兵${roles.soldier}·侦${roles.scout}`} color="#34d399" />
          <StatCard icon={<Skull size={13} />} label="敌人击杀" value={enemiesKilled} sub={`剩余${state.enemies.length}`} color="#f87171" />
          <StatCard icon={<Leaf size={13} />} label="食物储备" value={totalFood} sub={`资源点${resources.length}`} color="#fbbf24" />
          <StatCard icon={<Gem size={13} />} label="水晶储量" value={totalCrystal} sub={`剩余${remainingResources}`} color="#a78bfa" />
        </div>

        <div className="p-2.5 rounded-lg border border-cyan-500/15 bg-cyan-500/5">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-bold tracking-wider text-cyan-400">编组分布 · {squads.length} SQUADS</span>
          </div>
          <div className="space-y-1">
            {squads.map((squad) => {
              const count = bugs.filter(b => b.squadId === squad.id).length;
              const pct = bugs.length > 0 ? (count / bugs.length) * 100 : 0;
              return (
                <div key={squad.id} className="flex items-center gap-1.5">
                  <span
                    className="w-2 h-2 rounded-sm shrink-0"
                    style={{ backgroundColor: squad.color, boxShadow: `0 0 4px ${squad.color}` }}
                  />
                  <span className="text-[9px] text-white/60 w-14 truncate">{squad.name}</span>
                  <div className="flex-1 h-1 rounded-full bg-black/40 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${pct}%`, backgroundColor: squad.color }}
                    />
                  </div>
                  <span className="text-[9px] font-mono text-white/50 w-4 text-right">{count}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="p-3 rounded-lg border border-white/10 bg-black/25">
          <div className="flex items-center gap-2 mb-2.5">
            <TrendingUp size={14} className="text-cyan-400" />
            <span className="text-xs font-bold text-cyan-400 tracking-wider">地形影响</span>
          </div>
          <div className="space-y-1.5 text-[11px]">
            <TerrainRow name="平原" speed="100%" atk="100%" color="#1a3328" dotColor="#34d39950" />
            <TerrainRow name="森林" speed="70%" atk="130%" color="#0f3d26" dotColor="#22c55e" />
            <TerrainRow name="岩石" speed="50%" atk="150%" color="#374151" dotColor="#94a3b8" />
            <TerrainRow name="水域" speed="25%" atk="100%" color="#0c4a6e" dotColor="#38bdf8" />
            <TerrainRow name="巢穴" speed="110%" atk="100%" color="#4c1d95" dotColor="#a855f7" />
          </div>
        </div>

        <div className="p-3 rounded-lg border border-white/10 bg-black/25">
          <div className="text-xs font-bold text-amber-400 tracking-wider mb-2.5">指令说明</div>
          <div className="space-y-2">
            {Object.entries(INSTRUCTION_META).map(([key, meta]) => (
              <div key={key} className="flex items-start gap-2">
                <span
                  className="w-6 h-6 shrink-0 rounded-md flex items-center justify-center text-sm font-black mt-0.5"
                  style={{
                    backgroundColor: meta.bgColor,
                    color: meta.color,
                    border: `1px solid ${meta.borderColor}40`,
                  }}
                >
                  {meta.icon}
                </span>
                <div>
                  <div className="text-[11px] font-bold" style={{ color: meta.color }}>
                    {meta.name} · {key}
                  </div>
                  <div className="text-[10px] text-white/40 leading-snug">{meta.description}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="p-3 rounded-lg border border-amber-500/15 bg-gradient-to-br from-amber-500/5 to-transparent">
          <div className="text-xs font-bold text-amber-400 tracking-wider mb-1.5">✦ 涌现提示</div>
          <div className="text-[10px] text-amber-200/50 leading-relaxed">
            个体无智能，群体生智慧。组合 MOVE → SPREAD → COLLECT → RETREAT 可形成高效采集回路；
            前置 ATTACK 可在接触敌人时切换作战模式。指令按顺序执行，
            每条指令有独立执行时长，执行完毕自动消除，下一条指令开始执行。
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  sub,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  sub: string;
  color: string;
}) {
  return (
    <div
      className="p-2.5 rounded-lg border bg-black/25"
      style={{ borderColor: color + '30' }}
    >
      <div className="flex items-center gap-1.5 mb-1" style={{ color }}>
        {icon}
        <span className="text-[10px] font-bold tracking-wider text-white/50">{label}</span>
      </div>
      <div className="text-xl font-black font-mono leading-none" style={{ color, textShadow: `0 0 8px ${color}40` }}>
        {value}
      </div>
      <div className="text-[9px] text-white/30 mt-1 font-mono">{sub}</div>
    </div>
  );
}

function TerrainRow({
  name,
  speed,
  atk,
  color,
  dotColor,
}: {
  name: string;
  speed: string;
  atk: string;
  color: string;
  dotColor: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-4 h-4 rounded shrink-0" style={{ backgroundColor: color, boxShadow: `inset 0 0 4px ${dotColor}` }} />
      <span className="text-white/60 w-10">{name}</span>
      <div className="flex-1 flex gap-2 font-mono text-[10px]">
        <span className="text-cyan-400/70">移{speed}</span>
        <span className="text-rose-400/70">攻{atk}</span>
      </div>
    </div>
  );
}

function EvolutionCard({
  evolution,
  bugs,
}: {
  evolution: import('@/game/types').SwarmEvolution;
  bugs: import('@/game/types').Bug[];
}) {
  const evoThresholds = [0, 500, 1500, 4000, 10000, 25000, 60000, 150000, 400000];
  const curMin = evoThresholds[evolution.evolutionLevel - 1] ?? 0;
  const curMax = evoThresholds[evolution.evolutionLevel] ?? 400000;
  const progressInLevel = Math.min(100, ((evolution.totalExp - curMin) / Math.max(1, curMax - curMin)) * 100);

  const avgLevel = bugs.length > 0
    ? (bugs.reduce((s, b) => s + b.level, 0) / bugs.length).toFixed(1)
    : '0.0';
  const maxLevel = bugs.length > 0 ? Math.max(...bugs.map(b => b.level)) : 0;
  const mutatedBugs = bugs.filter(b => b.mutations.length > 0).length;
  const totalMutationCount = bugs.reduce((s, b) => s + b.mutations.length, 0);

  const rarityStats = { common: 0, rare: 0, epic: 0, legendary: 0 };
  for (const b of bugs) {
    for (const mid of b.mutations) {
      const m = Object.values(MUTATION_LIBRARY).find(mu => mu.id === mid);
      if (m) rarityStats[m.rarity]++;
    }
  }

  return (
    <div className="p-3 rounded-lg border border-fuchsia-500/25 bg-gradient-to-br from-fuchsia-500/10 via-purple-500/5 to-transparent">
      <div className="flex items-center gap-2 mb-2.5">
        <Sparkles size={14} className="text-fuchsia-400" />
        <span className="text-xs font-bold text-fuchsia-400 tracking-wider">虫群进化</span>
        <span className="ml-auto px-2 py-0.5 rounded bg-fuchsia-500/20 text-[10px] font-mono font-bold text-fuchsia-300 border border-fuchsia-500/30">
          Lv.{evolution.evolutionLevel}
        </span>
      </div>

      <div className="mb-2.5">
        <div className="relative h-2 rounded-full bg-black/50 border border-fuchsia-500/20 overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
            style={{
              width: `${progressInLevel}%`,
              background: 'linear-gradient(90deg, #a855f7, #ec4899, #f59e0b)',
              boxShadow: '0 0 8px rgba(168,85,247,0.6)',
            }}
          />
        </div>
        <div className="flex justify-between mt-1 text-[9px] font-mono">
          <span className="text-fuchsia-400/60">总经验 {evolution.totalExp.toLocaleString()}</span>
          <span className="text-pink-400/60">{progressInLevel.toFixed(0)}%</span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-1.5 mb-2.5">
        <MiniStat label="平均Lv" value={avgLevel} color="#fde047" />
        <MiniStat label="最高Lv" value={String(maxLevel)} color="#fb923c" />
        <MiniStat label="变异体" value={`${mutatedBugs}`} color="#c084fc" />
      </div>

      {totalMutationCount > 0 && (
        <div className="pt-2 border-t border-fuchsia-500/15">
          <div className="text-[9px] text-fuchsia-400/60 mb-1.5 font-bold tracking-wider flex items-center gap-1">
            <Zap size={10} /> 变异分布 · {totalMutationCount}
          </div>
          <div className="flex gap-1">
            {(['common', 'rare', 'epic', 'legendary'] as const).map(r => {
              const info = RARITY_LABEL[r];
              const count = rarityStats[r];
              const pct = totalMutationCount > 0 ? (count / totalMutationCount) * 100 : 0;
              return (
                <div key={r} className="flex-1 flex flex-col items-center" title={`${info.label}: ${count}`}>
                  <div className="w-full h-1.5 rounded-full bg-black/40 overflow-hidden mb-0.5">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${pct}%`, backgroundColor: info.color }}
                    />
                  </div>
                  <span className="text-[8px] font-mono" style={{ color: info.color + '90' }}>
                    {count}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {evolution.legendaryMutations > 0 && (
        <div className="mt-2 pt-2 border-t border-amber-500/20 flex items-center gap-1.5">
          <span className="text-amber-400 animate-pulse">✦</span>
          <span className="text-[9px] text-amber-400/80 font-bold tracking-wider">
            传说变异 x{evolution.legendaryMutations}
          </span>
        </div>
      )}
    </div>
  );
}

function MiniStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="p-1.5 rounded bg-black/30 border border-white/5 text-center">
      <div className="text-[8px] text-white/40 mb-0.5 tracking-wider">{label}</div>
      <div className="text-sm font-black font-mono leading-none" style={{ color, textShadow: `0 0 6px ${color}50` }}>
        {value}
      </div>
    </div>
  );
}
