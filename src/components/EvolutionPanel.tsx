import { useMemo } from 'react';
import { useGameStore } from '@/store/gameStore';
import {
  Sparkles,
  ScrollText,
  BookOpen,
  Crown,
  Flame,
  Shield,
  Eye,
  Droplet,
  Target,
  Zap,
  Leaf,
  Heart,
  Star,
  Trophy,
  TrendingUp,
} from 'lucide-react';
import { MUTATION_LIBRARY, RARITY_LABEL } from '@/game/types';
import type { Mutation, Bug } from '@/game/types';

const ABILITY_ICONS: Record<string, React.ReactNode> = {
  damage_boost: <Flame size={11} />,
  hp_boost: <Shield size={11} />,
  speed_boost: <Zap size={11} />,
  carry_boost: <Leaf size={11} />,
  attack_poison: <Droplet size={11} />,
  vision_range: <Eye size={11} />,
  pheromone_strength: <Target size={11} />,
  hp_regen: <Heart size={11} />,
  swarm_damage: <TrendingUp size={11} />,
  resource_detect: <Star size={11} />,
  glide_terrain: <Sparkles size={11} />,
  no_drop: <Trophy size={11} />,
};

const ABILITY_LABELS: Record<string, string> = {
  damage_boost: '伤害',
  hp_boost: '生命',
  speed_boost: '速度',
  carry_boost: '容量',
  attack_poison: '毒伤',
  vision_range: '侦测',
  pheromone_strength: '信息素',
  hp_regen: '再生',
  swarm_damage: '集群',
  resource_detect: '探知',
  glide_terrain: '滑翔',
  no_drop: '紧握',
};

export default function EvolutionPanel() {
  const { state } = useGameStore();
  const { bugs, evolution } = state;

  const recentMutations = useMemo(
    () => [...evolution.mutationHistory].reverse().slice(0, 20),
    [evolution.mutationHistory]
  );

  const unlockedSet = useMemo(
    () => new Set(evolution.unlockedMutations),
    [evolution.unlockedMutations]
  );

  const topMutatedBugs = useMemo(() => {
    return [...bugs]
      .filter(b => b.mutations.length > 0 || b.level > 1)
      .sort((a, b) => {
        const score = (x: Bug) => x.level * 10 + x.mutations.length * 5;
        return score(b) - score(a);
      })
      .slice(0, 8);
  }, [bugs]);

  const mutationsByRarity = useMemo(() => {
    const result = { common: 0, rare: 0, epic: 0, legendary: 0 } as Record<Mutation['rarity'], number>;
    for (const h of evolution.mutationHistory) {
      result[h.mutation.rarity]++;
    }
    return result;
  }, [evolution.mutationHistory]);

  const allMutations = Object.values(MUTATION_LIBRARY);
  const unlockedCount = evolution.unlockedMutations.length;
  const totalCount = allMutations.length;
  const collectionProgress = Math.round((unlockedCount / totalCount) * 100);

  return (
    <div className="h-full flex flex-col rounded-xl border border-purple-500/20 bg-gradient-to-br from-[#0c0814] to-[#100a18] overflow-hidden shadow-[0_0_25px_rgba(168,85,247,0.08)]">
      <div className="px-4 py-3 border-b border-purple-500/15 bg-black/30">
        <h3 className="text-purple-400 font-bold tracking-wider text-sm flex items-center gap-2">
          <Sparkles size={16} className="text-purple-400" />
          虫群进化档案
        </h3>
        <p className="text-[11px] text-purple-500/50 mt-0.5 tracking-wider">
          SWARM_EVOLUTION_ARCHIVE
        </p>
      </div>

      <div className="p-3 space-y-3 flex-1 overflow-y-auto custom-scroll">
        <div className="p-3 rounded-lg border border-amber-500/20 bg-gradient-to-br from-amber-500/8 to-transparent">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <Trophy size={13} className="text-amber-400" />
              <span className="text-xs font-bold text-amber-400 tracking-wider">收集进度</span>
            </div>
            <span className="text-[10px] font-mono text-amber-300/80">
              {unlockedCount} / {totalCount}
            </span>
          </div>
          <div className="relative h-2.5 rounded-full bg-black/50 border border-amber-500/20 overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 rounded-full transition-all duration-700"
              style={{
                width: `${collectionProgress}%`,
                background: 'linear-gradient(90deg, #f59e0b, #ef4444, #ec4899)',
                boxShadow: '0 0 10px rgba(245,158,11,0.5)',
              }}
            />
          </div>
          <div className="flex justify-between mt-1 text-[9px] font-mono">
            <span className="text-amber-400/60">{collectionProgress}% 已解锁</span>
            <span className="text-rose-400/60">传说 x{evolution.legendaryMutations}</span>
          </div>

          <div className="mt-2.5 grid grid-cols-4 gap-1">
            {(['common', 'rare', 'epic', 'legendary'] as const).map(r => {
              const info = RARITY_LABEL[r];
              const count = mutationsByRarity[r];
              return (
                <div
                  key={r}
                  className="p-1.5 rounded bg-black/30 border text-center"
                  style={{ borderColor: info.color + '25' }}
                >
                  <div className="text-[8px] font-bold mb-0.5 tracking-wider" style={{ color: info.color }}>
                    {info.label}
                  </div>
                  <div className="text-sm font-black font-mono" style={{ color: info.color, textShadow: `0 0 4px ${info.color}40` }}>
                    {count}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="p-3 rounded-lg border border-cyan-500/20 bg-gradient-to-br from-cyan-500/5 to-transparent">
          <div className="flex items-center gap-1.5 mb-2.5">
            <BookOpen size={13} className="text-cyan-400" />
            <span className="text-xs font-bold text-cyan-400 tracking-wider">变异图鉴</span>
          </div>
          <div className="space-y-1.5 max-h-52 overflow-y-auto custom-scroll pr-0.5">
            {allMutations.map(m => {
              const unlocked = unlockedSet.has(m.id);
              const info = RARITY_LABEL[m.rarity];
              return (
                <div
                  key={m.id}
                  className={`p-2 rounded border transition-all ${
                    unlocked ? '' : 'opacity-40 grayscale'
                  }`}
                  style={{
                    backgroundColor: unlocked ? m.bgColor : 'rgba(0,0,0,0.2)',
                    borderColor: unlocked ? info.color + '35' : 'rgba(255,255,255,0.05)',
                  }}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="w-7 h-7 shrink-0 rounded-md flex items-center justify-center text-base font-bold"
                      style={{
                        backgroundColor: unlocked ? m.color + '25' : 'rgba(255,255,255,0.05)',
                        color: unlocked ? m.color : '#64748b',
                        border: `1px solid ${unlocked ? m.color + '50' : 'rgba(255,255,255,0.08)'}`,
                      }}
                    >
                      {unlocked ? m.icon : '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="text-[11px] font-bold" style={{ color: unlocked ? m.color : '#64748b' }}>
                          {unlocked ? m.name : '未解锁'}
                        </span>
                        <span
                          className="px-1 py-0.5 rounded text-[8px] font-bold"
                          style={{
                            backgroundColor: info.color + '20',
                            color: info.color,
                          }}
                        >
                          {info.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-[9px]" style={{ color: unlocked ? 'rgba(255,255,255,0.45)' : '#475569' }}>
                        <span style={{ color: m.color + '90' }}>
                          {ABILITY_ICONS[m.ability]}
                        </span>
                        <span className="text-white/30">·</span>
                        <span>{unlocked ? m.description : '???'}</span>
                      </div>
                      {unlocked && (
                        <div className="mt-0.5 text-[9px] font-mono" style={{ color: m.color + '70' }}>
                          +{(m.value * 100).toFixed(0)}% {ABILITY_LABELS[m.ability]}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="p-3 rounded-lg border border-fuchsia-500/20 bg-gradient-to-br from-fuchsia-500/5 to-transparent">
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-1.5">
              <Crown size={13} className="text-fuchsia-400" />
              <span className="text-xs font-bold text-fuchsia-400 tracking-wider">进化精英</span>
            </div>
          </div>
          {topMutatedBugs.length === 0 ? (
            <div className="text-[11px] text-white/30 text-center py-4">
              暂无进化个体 · 采集与战斗获得经验
            </div>
          ) : (
            <div className="space-y-1.5 max-h-40 overflow-y-auto custom-scroll">
              {topMutatedBugs.map(bug => {
                const expPct = Math.min(100, (bug.exp / Math.max(1, bug.expToNext)) * 100);
                const roleColors: Record<Bug['role'], string> = {
                  worker: '#34d399',
                  soldier: '#f472b6',
                  scout: '#22d3ee',
                };
                const roleLabels: Record<Bug['role'], string> = {
                  worker: '工',
                  soldier: '兵',
                  scout: '侦',
                };
                let highest: Mutation['rarity'] | null = null;
                const order: Mutation['rarity'][] = ['common', 'rare', 'epic', 'legendary'];
                for (const mid of bug.mutations) {
                  const m = Object.values(MUTATION_LIBRARY).find(mu => mu.id === mid);
                  if (m && (!highest || order.indexOf(m.rarity) > order.indexOf(highest))) {
                    highest = m.rarity;
                  }
                }
                return (
                  <div
                    key={bug.id}
                    className="p-2 rounded bg-black/25 border border-white/5 hover:border-white/10 transition-colors"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <div
                        className="w-5 h-5 shrink-0 rounded flex items-center justify-center text-[9px] font-black"
                        style={{
                          backgroundColor: roleColors[bug.role] + '25',
                          color: roleColors[bug.role],
                          border: `1px solid ${roleColors[bug.role]}40`,
                        }}
                      >
                        {roleLabels[bug.role]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-mono text-white/40">#{bug.id}</span>
                          <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-[9px] font-black text-amber-300 border border-amber-500/30">
                            Lv.{bug.level}
                          </span>
                          {highest && (
                            <span
                              className="px-1 py-0.5 rounded text-[8px] font-bold"
                              style={{
                                backgroundColor: RARITY_LABEL[highest].color + '15',
                                color: RARITY_LABEL[highest].color,
                                border: `1px solid ${RARITY_LABEL[highest].color}30`,
                              }}
                            >
                              {RARITY_LABEL[highest].label}
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="text-[9px] font-mono text-fuchsia-400/80">
                        {bug.mutations.length}m
                      </span>
                    </div>
                    <div className="relative h-1 rounded-full bg-black/40 overflow-hidden">
                      <div
                        className="absolute inset-y-0 left-0 rounded-full"
                        style={{
                          width: `${expPct}%`,
                          background: 'linear-gradient(90deg, #a78bfa, #22d3ee)',
                        }}
                      />
                    </div>
                    {bug.mutations.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-0.5">
                        {bug.mutations.slice(0, 6).map((mid, i) => {
                          const m = Object.values(MUTATION_LIBRARY).find(mu => mu.id === mid);
                          if (!m) return null;
                          return (
                            <span
                              key={i}
                              title={m.name}
                              className="w-4 h-4 rounded flex items-center justify-center text-[9px]"
                              style={{
                                backgroundColor: m.color + '20',
                                color: m.color,
                                border: `1px solid ${m.color}35`,
                              }}
                            >
                              {m.icon}
                            </span>
                          );
                        })}
                        {bug.mutations.length > 6 && (
                          <span className="w-4 h-4 rounded flex items-center justify-center text-[8px] font-bold text-white/40 bg-white/5 border border-white/10">
                            +{bug.mutations.length - 6}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="p-3 rounded-lg border border-rose-500/15 bg-gradient-to-br from-rose-500/5 to-transparent">
          <div className="flex items-center gap-1.5 mb-2.5">
            <ScrollText size={13} className="text-rose-400" />
            <span className="text-xs font-bold text-rose-400 tracking-wider">变异日志</span>
            <span className="ml-auto text-[9px] font-mono text-rose-400/50">
              {evolution.totalMutations} 次
            </span>
          </div>
          {recentMutations.length === 0 ? (
            <div className="text-[11px] text-white/30 text-center py-4">
              尚无变异记录 · 升级触发变异
            </div>
          ) : (
            <div className="space-y-1 max-h-48 overflow-y-auto custom-scroll">
              {recentMutations.map((entry, idx) => {
                const info = RARITY_LABEL[entry.mutation.rarity];
                return (
                  <div
                    key={`${entry.tick}-${entry.bugId}-${idx}`}
                    className="p-1.5 rounded bg-black/20 border-l-2 flex items-center gap-1.5"
                    style={{ borderLeftColor: info.color + '80' }}
                  >
                    <span className="text-[8px] font-mono text-white/30 w-10 shrink-0">
                      T{entry.tick}
                    </span>
                    <span
                      className="w-5 h-5 shrink-0 rounded flex items-center justify-center text-sm"
                      style={{
                        backgroundColor: entry.mutation.color + '20',
                        color: entry.mutation.color,
                      }}
                    >
                      {entry.mutation.icon}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] font-bold" style={{ color: entry.mutation.color }}>
                          {entry.mutation.name}
                        </span>
                        <span
                          className="px-0.5 py-0 rounded text-[8px] font-bold"
                          style={{ backgroundColor: info.color + '20', color: info.color }}
                        >
                          {info.label}
                        </span>
                      </div>
                      <div className="text-[8px] text-white/30 font-mono">
                        Bug #{entry.bugId}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="p-3 rounded-lg border border-emerald-500/15 bg-gradient-to-br from-emerald-500/5 to-transparent">
          <div className="flex items-center gap-1.5 mb-2.5">
            <TrendingUp size={13} className="text-emerald-400" />
            <span className="text-xs font-bold text-emerald-400 tracking-wider">升级提示</span>
          </div>
          <div className="space-y-1.5 text-[10px] text-emerald-200/50 leading-relaxed">
            <p>• 采集资源 · 击杀敌人 · 储存物资获得经验</p>
            <p>• 经验积累自动升级，属性获得 +8%HP +12%攻击</p>
            <p>• 每次升级 70% 概率触发随机变异</p>
            <p>• 变异稀有度：普通60% · 稀有28% · 史诗10% · 传说2%</p>
            <p>• 虫群总经验累积，解锁整体进化等级</p>
          </div>
        </div>
      </div>
    </div>
  );
}

