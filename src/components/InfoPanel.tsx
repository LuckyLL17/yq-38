import { useGameStore } from '@/store/gameStore';
import { Bug, Skull, Leaf, Gem, Target, TrendingUp } from 'lucide-react';
import { INSTRUCTION_META } from '@/game/types';

export default function InfoPanel() {
  const { state } = useGameStore();
  const { bugs, levelObjective, levelProgress, levelTarget, totalFood, totalCrystal, enemiesKilled, resources } = state;

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

        <div className="grid grid-cols-2 gap-2">
          <StatCard icon={<Bug size={13} />} label="虫群规模" value={bugs.length} sub={`工${roles.worker}·兵${roles.soldier}·侦${roles.scout}`} color="#34d399" />
          <StatCard icon={<Skull size={13} />} label="敌人击杀" value={enemiesKilled} sub={`剩余${state.enemies.length}`} color="#f87171" />
          <StatCard icon={<Leaf size={13} />} label="食物储备" value={totalFood} sub={`资源点${resources.length}`} color="#fbbf24" />
          <StatCard icon={<Gem size={13} />} label="水晶储量" value={totalCrystal} sub={`剩余${remainingResources}`} color="#a78bfa" />
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
            前置 ATTACK 可在接触敌人时切换作战模式。指令以循环方式执行，
            每个虫独立维护程序计数器。
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
