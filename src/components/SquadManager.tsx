import { useState } from 'react';
import { useGameStore } from '@/store/gameStore';
import { DEFAULT_SQUAD_COLORS } from '@/game/engine';
import { Users, Plus, Trash2, Edit3, Check, X, Shuffle, UserCheck, Layers } from 'lucide-react';

export default function SquadManager() {
  const {
    state,
    setCurrentSquad,
    createSquad,
    deleteSquad,
    renameSquad,
    setSquadColor,
    splitSquadByRole,
    assignAllToSquad,
  } = useGameStore();

  const { squads, currentSquadId, bugs } = state;
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [showNewSquad, setShowNewSquad] = useState(false);
  const [newSquadName, setNewSquadName] = useState('');
  const [showColorPicker, setShowColorPicker] = useState<string | null>(null);

  const squadCounts = squads.reduce((acc, s) => {
    acc[s.id] = bugs.filter(b => b.squadId === s.id).length;
    return acc;
  }, {} as Record<string, number>);

  const squadRoleCounts = squads.reduce((acc, s) => {
    const squadBugs = bugs.filter(b => b.squadId === s.id);
    acc[s.id] = {
      worker: squadBugs.filter(b => b.role === 'worker').length,
      soldier: squadBugs.filter(b => b.role === 'soldier').length,
      scout: squadBugs.filter(b => b.role === 'scout').length,
    };
    return acc;
  }, {} as Record<string, { worker: number; soldier: number; scout: number }>);

  const handleCreateSquad = () => {
    if (newSquadName.trim()) {
      createSquad(newSquadName);
      setNewSquadName('');
      setShowNewSquad(false);
    }
  };

  const handleStartRename = (id: string, name: string) => {
    setEditingId(id);
    setEditingName(name);
  };

  const handleConfirmRename = () => {
    if (editingId && editingName.trim()) {
      renameSquad(editingId, editingName);
    }
    setEditingId(null);
    setEditingName('');
  };

  return (
    <div className="h-full flex flex-col rounded-xl border border-cyan-500/25 bg-gradient-to-br from-[#081218] to-[#0a1a14] overflow-hidden shadow-[0_0_25px_rgba(34,211,238,0.08)]">
      <div className="px-4 py-3 border-b border-cyan-500/20 bg-black/30">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-cyan-400 font-bold tracking-wider text-sm flex items-center gap-2">
              <span className="text-lg">◈</span>
              虫群编组系统
            </h3>
            <p className="text-[11px] text-cyan-500/50 mt-0.5 tracking-wider">
              SQUAD_DIVISION / v1.0
            </p>
          </div>
          <button
            onClick={() => setShowNewSquad(true)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-cyan-500/40 bg-cyan-500/10 text-cyan-400 text-[11px] font-bold hover:bg-cyan-500/20 hover:border-cyan-500/60 transition-all"
          >
            <Plus size={12} />
            新建
          </button>
        </div>
      </div>

      {showNewSquad && (
        <div className="px-3 py-2.5 border-b border-cyan-500/10 bg-cyan-500/5">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newSquadName}
              onChange={(e) => setNewSquadName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateSquad()}
              placeholder="编组名称..."
              className="flex-1 px-2.5 py-1.5 rounded-md bg-black/40 border border-white/10 text-white/80 text-xs focus:outline-none focus:border-cyan-500/50 placeholder-white/20"
              autoFocus
            />
            <button
              onClick={handleCreateSquad}
              className="p-1.5 rounded-md bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 transition-colors"
            >
              <Check size={14} />
            </button>
            <button
              onClick={() => { setShowNewSquad(false); setNewSquadName(''); }}
              className="p-1.5 rounded-md bg-white/5 text-white/50 hover:bg-white/10 transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      <div className="p-2.5 border-b border-white/5 bg-black/20">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => splitSquadByRole(currentSquadId)}
            className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-md border border-amber-500/30 bg-amber-500/8 text-amber-400 text-[10px] font-bold hover:bg-amber-500/15 transition-all"
            title="按角色分配当前编组：工虫→A队，兵虫→B队，侦虫→主群"
          >
            <Shuffle size={11} />
            按角色分编
          </button>
          <button
            onClick={() => assignAllToSquad(currentSquadId)}
            className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-md border border-fuchsia-500/30 bg-fuchsia-500/8 text-fuchsia-400 text-[10px] font-bold hover:bg-fuchsia-500/15 transition-all"
            title="将所有虫子移入当前编组"
          >
            <UserCheck size={11} />
            全员集中
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scroll">
        {squads.map((squad) => {
          const isActive = currentSquadId === squad.id;
          const count = squadCounts[squad.id] ?? 0;
          const roles = squadRoleCounts[squad.id] ?? { worker: 0, soldier: 0, scout: 0 };
          const isEditing = editingId === squad.id;
          const showColors = showColorPicker === squad.id;

          return (
            <div key={squad.id} className="relative">
              {showColors && (
                <div className="absolute right-10 top-0 z-10 p-2 rounded-lg border border-white/10 bg-[#0a1210] shadow-2xl">
                  <div className="grid grid-cols-4 gap-1">
                    {DEFAULT_SQUAD_COLORS.map((color) => (
                      <button
                        key={color}
                        onClick={() => {
                          setSquadColor(squad.id, color);
                          setShowColorPicker(null);
                        }}
                        className="w-5 h-5 rounded-md border border-white/20 hover:scale-110 transition-transform"
                        style={{
                          backgroundColor: color,
                          boxShadow: `0 0 6px ${color}60`,
                          outline: squad.color === color ? `2px solid white` : 'none',
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}

              <div
                onClick={() => !isEditing && setCurrentSquad(squad.id)}
                className={`relative rounded-lg border transition-all cursor-pointer overflow-hidden ${
                  isActive
                    ? 'border-cyan-400/60 bg-cyan-500/10 shadow-[0_0_12px_rgba(34,211,238,0.15)]'
                    : 'border-white/8 bg-white/3 hover:border-white/15 hover:bg-white/5'
                }`}
              >
                {isActive && (
                  <div
                    className="absolute left-0 top-0 bottom-0 w-0.5"
                    style={{
                      backgroundColor: squad.color,
                      boxShadow: `0 0 8px ${squad.color}`,
                    }}
                  />
                )}

                <div className="p-2.5 pl-3">
                  <div className="flex items-center gap-2 mb-1.5">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowColorPicker(showColors ? null : squad.id);
                      }}
                      className="w-5 h-5 rounded-md shrink-0 border border-white/20 hover:scale-110 transition-transform"
                      style={{
                        backgroundColor: squad.color,
                        boxShadow: `0 0 6px ${squad.color}60`,
                      }}
                    />

                    {isEditing ? (
                      <input
                        type="text"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleConfirmRename()}
                        onClick={(e) => e.stopPropagation()}
                        className="flex-1 px-1.5 py-0.5 rounded bg-black/40 border border-white/20 text-white text-xs font-bold focus:outline-none focus:border-cyan-500/50"
                        autoFocus
                      />
                    ) : (
                      <span
                        className="flex-1 text-xs font-bold truncate"
                        style={{ color: squad.color }}
                      >
                        {squad.name}
                      </span>
                    )}

                    <div className="flex items-center gap-0.5 shrink-0">
                      {isEditing ? (
                        <>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleConfirmRename();
                            }}
                            className="p-1 rounded text-emerald-400 hover:bg-emerald-500/15 transition-colors"
                          >
                            <Check size={12} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingId(null);
                              setEditingName('');
                            }}
                            className="p-1 rounded text-white/40 hover:bg-white/10 transition-colors"
                          >
                            <X size={12} />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStartRename(squad.id, squad.name);
                            }}
                            className="p-1 rounded text-white/30 hover:text-white/60 hover:bg-white/10 transition-colors"
                            title="重命名"
                          >
                            <Edit3 size={11} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (squads.length > 1) deleteSquad(squad.id);
                            }}
                            disabled={squads.length <= 1}
                            className="p-1 rounded text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-20 disabled:cursor-not-allowed"
                            title={squads.length <= 1 ? '至少保留一个编组' : '删除编组'}
                          >
                            <Trash2 size={11} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <Users size={10} style={{ color: squad.color, opacity: 0.7 }} />
                      <span className="text-[10px] font-mono font-bold text-white/70">
                        {count}
                      </span>
                      <span className="text-[9px] text-white/30">个体</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Layers size={10} className="text-cyan-400/60" />
                      <span className="text-[9px] font-mono text-cyan-400/70">
                        {squad.instructions.length} 指令
                      </span>
                    </div>
                  </div>

                  {count > 0 && (
                    <div className="mt-1.5 flex items-center gap-2 pt-1.5 border-t border-white/5">
                      <div className="flex items-center gap-1 flex-1">
                        <span
                          className="inline-block w-1.5 h-1.5 rounded-full"
                          style={{ backgroundColor: '#34d399' }}
                        />
                        <span className="text-[9px] font-mono text-emerald-400/70">
                          {roles.worker}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 flex-1">
                        <span
                          className="inline-block w-1.5 h-1.5 rounded-full"
                          style={{ backgroundColor: '#f472b6' }}
                        />
                        <span className="text-[9px] font-mono text-pink-400/70">
                          {roles.soldier}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 flex-1">
                        <span
                          className="inline-block w-1.5 h-1.5 rounded-full"
                          style={{ backgroundColor: '#22d3ee' }}
                        />
                        <span className="text-[9px] font-mono text-cyan-400/70">
                          {roles.scout}
                        </span>
                      </div>
                    </div>
                  )}

                  {isActive && squad.instructions.length > 0 && (
                    <div className="mt-2 pt-1.5 border-t border-cyan-500/10">
                      <div className="relative h-1 rounded-full bg-black/40 overflow-hidden">
                        <div
                          className="absolute inset-y-0 left-0 rounded-full transition-all"
                          style={{
                            width: `${Math.max(0, Math.min(100, (squad.instructionTimer / Math.max(1, squad.instructions[0]?.duration ?? 1)) * 100))}%`,
                            background: `linear-gradient(90deg, ${squad.color}, ${squad.color}60)`,
                          }}
                        />
                      </div>
                      <div className="flex justify-between mt-0.5">
                        <span className="text-[8px] font-mono text-white/30">
                          {squad.instructions[0]?.type}
                        </span>
                        <span className="text-[8px] font-mono text-white/30">
                          {Math.max(0, squad.instructionTimer)} / {squad.instructions[0]?.duration}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="px-3 py-2 border-t border-cyan-500/15 bg-black/30">
        <div className="flex items-center justify-between text-[9px] font-mono">
          <span className="text-white/30">总计 {bugs.length} 个体</span>
          <span className="text-cyan-400/50">{squads.length} 支编组</span>
        </div>
      </div>
    </div>
  );
}
