import { useState, useMemo, useEffect } from 'react';
import { useGameStore } from '@/store/gameStore';
import { INSTRUCTION_META, CONDITION_LABELS } from '@/game/types';
import type { InstructionType, Instruction, ConditionType, Squad, GameState } from '@/game/types';
import { getActiveExecutableInstruction, evaluateCondition } from '@/game/engine';
import {
  GripVertical,
  Trash2,
  ChevronUp,
  ChevronDown,
  Plus,
  X,
  Settings2,
  Repeat,
  GitBranch,
  Layers,
} from 'lucide-react';

interface ExecutionState {
  activeInstructionId: string | null;
  activeStackIds: Set<string>;
  activeElseBranchIds: Set<string>;
  instructionTimer: number;
}

function computeExecutionState(squad: Squad, state: GameState): ExecutionState {
  const result: ExecutionState = {
    activeInstructionId: null,
    activeStackIds: new Set(),
    activeElseBranchIds: new Set(),
    instructionTimer: squad.instructionTimer,
  };

  for (const frame of squad.executionStack) {
    result.activeStackIds.add(frame.instructionId);
  }

  const activeLeaf = getActiveExecutableInstruction(squad, state);
  if (activeLeaf) {
    result.activeInstructionId = activeLeaf.id;
    result.activeStackIds.add(activeLeaf.id);
  }

  let currentList = squad.instructions;
  for (const frame of squad.executionStack) {
    const inst = currentList.find((i) => i.id === frame.instructionId);
    if (!inst) break;
    if (inst.type === 'IF') {
      const condMet = isIfConditionMet(inst, squad, state);
      if (!condMet) {
        result.activeElseBranchIds.add(inst.id);
      }
      currentList = condMet ? inst.children ?? [] : inst.elseChildren ?? [];
    } else if (inst.type === 'LOOP') {
      currentList = inst.children ?? [];
    }
  }

  return result;
}

function isIfConditionMet(inst: Instruction, squad: Squad, state: GameState): boolean {
  if (inst.type !== 'IF' || !inst.condition) return true;
  return evaluateCondition(inst.condition, inst.conditionParam, state, squad);
}

function countFlat(instructions: Instruction[]): number {
  let count = 0;
  for (const inst of instructions) {
    count++;
    if (inst.type === 'IF') {
      count += countFlat(inst.children ?? []);
      count += countFlat(inst.elseChildren ?? []);
    } else if (inst.type === 'LOOP') {
      count += countFlat(inst.children ?? []);
    }
  }
  return count;
}

function findInstructionById(
  list: Instruction[],
  id: string
): Instruction | null {
  for (const inst of list) {
    if (inst.id === id) return inst;
    if (inst.type === 'IF') {
      const r1 = findInstructionById(inst.children ?? [], id);
      if (r1) return r1;
      const r2 = findInstructionById(inst.elseChildren ?? [], id);
      if (r2) return r2;
    } else if (inst.type === 'LOOP') {
      const r = findInstructionById(inst.children ?? [], id);
      if (r) return r;
    }
  }
  return null;
}

interface InstructionNodeProps {
  inst: Instruction;
  depth: number;
  index: number;
  parentId?: string;
  branch?: 'if' | 'else';
  onEdit: (id: string) => void;
  onOpenLogicBlock: (id: string) => void;
  editingId: string | null;
  executionState: ExecutionState;
  squadColor: string;
  activeBranchForParent?: 'if' | 'else' | null;
}

function InstructionNode({
  inst,
  depth,
  index,
  parentId,
  branch,
  onEdit,
  onOpenLogicBlock,
  editingId,
  executionState,
  squadColor,
}: InstructionNodeProps) {
  const { state, removeInstruction, moveInstruction, addInstruction, updateInstruction } =
    useGameStore();

  const meta = INSTRUCTION_META[inst.type];
  const isEditing = editingId === inst.id;
  const isActiveLeaf = executionState.activeInstructionId === inst.id;
  const isOnStack = executionState.activeStackIds.has(inst.id);
  const isLogicBlock = inst.type === 'IF' || inst.type === 'LOOP';
  const conditionLabel = inst.condition ? CONDITION_LABELS[inst.condition] : null;

  const thenCount = inst.type === 'IF' ? countFlat(inst.children ?? []) : 0;
  const elseCount = inst.type === 'IF' ? countFlat(inst.elseChildren ?? []) : 0;
  const loopCount = inst.type === 'LOOP' ? countFlat(inst.children ?? []) : 0;
  const ifUsesElseBranch = inst.type === 'IF' && executionState.activeElseBranchIds.has(inst.id);

  const BlockIcon = inst.type === 'IF' ? GitBranch : Repeat;

  return (
    <div
      className={`relative group transition-all duration-200 cursor-pointer`}
      style={{ paddingLeft: `${depth * 16}px` }}
    >
      {depth > 0 && (
        <div
          className="absolute left-0 top-0 bottom-0 w-px opacity-40"
          style={{
            backgroundColor: branch === 'else' ? '#a78bfa' : meta.color,
            boxShadow: `0 0 4px ${branch === 'else' ? '#a78bfa' : meta.color}60`,
          }}
        />
      )}
      <div
        onClick={(e) => {
          e.stopPropagation();
          onEdit(inst.id);
        }}
        className="flex items-stretch gap-2 rounded-xl border backdrop-blur-sm overflow-hidden transition-all"
        style={{
          backgroundColor: meta.bgColor,
          borderColor: isActiveLeaf
            ? meta.color + 'b0'
            : isOnStack
            ? meta.color + '70'
            : meta.borderColor + '50',
          boxShadow: isEditing
            ? `0 0 18px ${meta.color}40, inset 0 0 15px ${meta.color}15`
            : isActiveLeaf
            ? `0 0 14px ${meta.color}45`
            : isOnStack
            ? `0 0 8px ${meta.color}25`
            : `0 1px 3px rgba(0,0,0,0.3)`,
          marginLeft: depth > 0 ? '6px' : '0',
        }}
      >
        <div
          className="flex items-center px-2 cursor-grab active:cursor-grabbing shrink-0"
          style={{
            backgroundColor: meta.color + '25',
            backgroundImage: `linear-gradient(135deg, ${meta.color}20 0%, transparent 100%)`,
          }}
        >
          {isLogicBlock ? (
            <BlockIcon
              size={14}
              style={{ color: meta.color }}
              strokeWidth={2.5}
            />
          ) : (
            <GripVertical
              size={14}
              style={{ color: meta.color }}
              className="opacity-60 group-hover:opacity-100 transition-opacity"
            />
          )}
        </div>

        <div className="flex items-center gap-3 py-2.5 px-3 flex-1 min-w-0">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center text-lg font-black shrink-0"
            style={{
              backgroundColor: meta.color + '30',
              color: meta.color,
              boxShadow: `inset 0 0 10px ${meta.color}30, 0 0 8px ${meta.color}15`,
              border: `1px solid ${meta.color}40`,
            }}
          >
            {meta.icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className="font-bold text-[13px] tracking-wide"
                style={{ color: meta.color }}
              >
                {meta.name}
              </span>
              <span
                className="text-[10px] font-mono px-1.5 py-0.5 rounded-md"
                style={{
                  backgroundColor: meta.color + '18',
                  color: meta.color,
                  border: `1px dashed ${meta.color}40`,
                }}
              >
                {inst.type}
              </span>
              {isActiveLeaf && !isLogicBlock && (
                <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 animate-pulse border border-emerald-400/40">
                  ● 执行中
                </span>
              )}
              {isOnStack && isLogicBlock && (
                <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 animate-pulse border border-emerald-400/40">
                  ● 执行中
                </span>
              )}
              {inst.type === 'IF' && conditionLabel && (
                <span
                  className="text-[10px] font-mono px-2 py-0.5 rounded-md"
                  style={{
                    backgroundColor: meta.color + '25',
                    color: meta.color,
                    border: `1px solid ${meta.color}50`,
                  }}
                >
                  <span className="opacity-70">条件:</span>{' '}
                  <b>{conditionLabel.label}</b>
                  {inst.conditionParam !== undefined && (
                    <span className="opacity-80">
                      {' '}
                      = {inst.conditionParam}
                    </span>
                  )}
                </span>
              )}
              {inst.type === 'LOOP' && inst.param !== undefined && (
                <span
                  className="text-[10px] font-mono px-2 py-0.5 rounded-md"
                  style={{
                    backgroundColor: meta.color + '25',
                    color: meta.color,
                    border: `1px solid ${meta.color}50`,
                  }}
                >
                  <span className="opacity-70">次数:</span>{' '}
                  <b>{inst.param === 0 ? '∞ 无限' : `×${inst.param}`}</b>
                </span>
              )}
            </div>

            {isLogicBlock && (
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {inst.type === 'IF' && (
                  <>
                    <span
                      className="text-[9px] font-mono px-2 py-0.5 rounded-md inline-flex items-center gap-1"
                      style={{
                        backgroundColor:
                          isOnStack && !ifUsesElseBranch
                            ? meta.color + '30'
                            : meta.color + '14',
                        color: meta.color,
                        border: `1px solid ${meta.color}${
                          isOnStack && !ifUsesElseBranch ? '60' : '30'
                        }`,
                      }}
                    >
                      <Layers size={9} /> THEN · {thenCount} 条
                    </span>
                    <span
                      className="text-[9px] font-mono px-2 py-0.5 rounded-md inline-flex items-center gap-1"
                      style={{
                        backgroundColor:
                          isOnStack && ifUsesElseBranch
                            ? '#a78bfa30'
                            : '#a78bfa14',
                        color: '#c4b5fd',
                        border: `1px solid #a78bfa${
                          isOnStack && ifUsesElseBranch ? '60' : '30'
                        }`,
                      }}
                    >
                      <Layers size={9} /> ELSE · {elseCount} 条
                    </span>
                  </>
                )}
                {inst.type === 'LOOP' && (
                  <span
                    className="text-[9px] font-mono px-2 py-0.5 rounded-md inline-flex items-center gap-1"
                    style={{
                      backgroundColor: isOnStack ? meta.color + '30' : meta.color + '14',
                      color: meta.color,
                      border: `1px solid ${meta.color}${isOnStack ? '60' : '30'}`,
                    }}
                  >
                    <Repeat size={9} /> DO · {loopCount} 条
                  </span>
                )}
              </div>
            )}

            {isActiveLeaf && !isLogicBlock && (
              <div className="mt-1.5 mb-0.5">
                <div className="relative h-1.5 rounded-full bg-black/40 overflow-hidden">
                  <div
                    className="absolute inset-y-0 left-0 rounded-full transition-all duration-150"
                    style={{
                      width: `${Math.max(
                        0,
                        Math.min(
                          100,
                          (executionState.instructionTimer / Math.max(1, inst.duration)) * 100
                        )
                      )}%`,
                      background: `linear-gradient(90deg, ${meta.color}, ${meta.color}80)`,
                      boxShadow: `0 0 8px ${meta.color}80`,
                    }}
                  />
                </div>
                <div
                  className="flex justify-between text-[9px] font-mono mt-0.5 opacity-80"
                  style={{ color: meta.color }}
                >
                  <span>剩余 {Math.max(0, executionState.instructionTimer)} tick</span>
                  <span>
                    总时长 {inst.duration}
                  </span>
                </div>
              </div>
            )}

            {isEditing && (
              <div className="mt-2.5 pr-1 space-y-2.5">
                {inst.type === 'IF' && (
                  <div>
                    <div
                      className="flex items-center justify-between text-[10px] mb-1"
                      style={{ color: meta.color + 'cc' }}
                    >
                      <span className="tracking-wide">📌 条件类型</span>
                    </div>
                    <select
                      value={inst.condition ?? 'ENEMY_NEARBY'}
                      onChange={(e) => {
                        e.stopPropagation();
                        const cond = e.target.value as ConditionType;
                        const condMeta = CONDITION_LABELS[cond];
                        updateInstruction(inst.id, {
                          condition: cond,
                          conditionParam: condMeta.paramDefault,
                        });
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="w-full text-xs px-2.5 py-2 rounded-lg bg-black/40 border outline-none appearance-none cursor-pointer hover:bg-black/50 transition-colors"
                      style={{
                        borderColor: meta.color + '50',
                        color: meta.color,
                      }}
                    >
                      {(Object.keys(CONDITION_LABELS) as ConditionType[]).map((c) => (
                        <option key={c} value={c} style={{ backgroundColor: '#0a1410' }}>
                          {CONDITION_LABELS[c].label} — {CONDITION_LABELS[c].description}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                {inst.type === 'IF' &&
                  conditionLabel?.hasParam &&
                  inst.conditionParam !== undefined && (
                    <div>
                      <div
                        className="flex items-center justify-between text-[10px] mb-1"
                        style={{ color: meta.color + 'cc' }}
                      >
                        <span className="tracking-wide">🎯 {conditionLabel.paramLabel}</span>
                        <span className="font-mono font-bold px-1.5 py-0.5 rounded bg-black/40 border"
                          style={{ borderColor: meta.color + '40' }}
                        >
                          {inst.conditionParam}
                        </span>
                      </div>
                      <input
                        type="range"
                        min={conditionLabel.paramMin}
                        max={conditionLabel.paramMax}
                        value={inst.conditionParam}
                        onChange={(e) => {
                          e.stopPropagation();
                          updateInstruction(inst.id, {
                            conditionParam: Number(e.target.value),
                          });
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                        style={{
                          background: `linear-gradient(to right, ${meta.color} 0%, ${meta.color} ${
                            ((inst.conditionParam - (conditionLabel.paramMin ?? 0)) /
                              ((conditionLabel.paramMax ?? 100) -
                                (conditionLabel.paramMin ?? 0))) *
                            100
                          }%, rgba(255,255,255,0.08) ${
                            ((inst.conditionParam - (conditionLabel.paramMin ?? 0)) /
                              ((conditionLabel.paramMax ?? 100) -
                                (conditionLabel.paramMin ?? 0))) *
                            100
                          }%, rgba(255,255,255,0.08) 100%)`,
                          accentColor: meta.color,
                        }}
                      />
                    </div>
                  )}
                {meta.hasParam && inst.param !== undefined && (
                  <div>
                    <div
                      className="flex items-center justify-between text-[10px] mb-1"
                      style={{ color: meta.color + 'cc' }}
                    >
                      <span className="tracking-wide">🎯 {meta.paramLabel}</span>
                      <span className="font-mono font-bold px-1.5 py-0.5 rounded bg-black/40 border"
                        style={{ borderColor: meta.color + '40' }}
                      >
                        {inst.param}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={meta.paramMin}
                      max={meta.paramMax}
                      value={inst.param}
                      onChange={(e) => {
                        e.stopPropagation();
                        updateInstruction(inst.id, { param: Number(e.target.value) });
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                      style={{
                        background: `linear-gradient(to right, ${meta.color} 0%, ${meta.color} ${
                          ((inst.param - (meta.paramMin ?? 0)) /
                            ((meta.paramMax ?? 100) - (meta.paramMin ?? 0))) *
                          100
                        }%, rgba(255,255,255,0.08) ${
                          ((inst.param - (meta.paramMin ?? 0)) /
                            ((meta.paramMax ?? 100) - (meta.paramMin ?? 0))) *
                          100
                        }%, rgba(255,255,255,0.08) 100%)`,
                        accentColor: meta.color,
                      }}
                    />
                  </div>
                )}
                {!isLogicBlock && inst.type !== 'ELSE' && (
                  <div>
                    <div
                      className="flex items-center justify-between text-[10px] mb-1"
                      style={{ color: meta.color + 'cc' }}
                    >
                      <span className="tracking-wide">⏱️ {meta.durationLabel}</span>
                      <span className="font-mono font-bold px-1.5 py-0.5 rounded bg-black/40 border"
                        style={{ borderColor: meta.color + '40' }}
                      >
                        {inst.duration}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={meta.durationMin}
                      max={meta.durationMax}
                      step={10}
                      value={inst.duration}
                      onChange={(e) => {
                        e.stopPropagation();
                        updateInstruction(inst.id, { duration: Number(e.target.value) });
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                      style={{
                        background: `linear-gradient(to right, ${meta.color} 0%, ${meta.color} ${
                          ((inst.duration - meta.durationMin) /
                            (meta.durationMax - meta.durationMin)) *
                          100
                        }%, rgba(255,255,255,0.08) ${
                          ((inst.duration - meta.durationMin) /
                            (meta.durationMax - meta.durationMin)) *
                          100
                        }%, rgba(255,255,255,0.08) 100%)`,
                        accentColor: meta.color,
                      }}
                    />
                  </div>
                )}
              </div>
            )}
            {!isEditing && (
              <div
                className="text-[10px] mt-1 font-mono opacity-70 leading-snug"
                style={{ color: meta.color }}
              >
                {!isLogicBlock && inst.type !== 'ELSE'
                  ? `⏱ ${inst.duration} tick${
                      meta.hasParam ? ` · 🎯 ${meta.paramLabel}: ${inst.param}` : ''
                    }`
                  : inst.type === 'IF'
                  ? conditionLabel?.description ?? ''
                  : inst.type === 'LOOP'
                  ? inst.param === 0
                    ? '♾️ 无限循环执行 DO 块'
                    : `🔁 循环执行 DO 块 ${inst.param} 次`
                  : ''}
              </div>
            )}
          </div>
        </div>

        {isLogicBlock && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onOpenLogicBlock(inst.id);
            }}
            className="px-2.5 hover:bg-white/10 transition-colors flex items-center justify-center gap-1 font-mono text-[10px] border-l"
            style={{
              color: meta.color,
              borderColor: meta.color + '30',
              backgroundColor: meta.color + '08',
            }}
            title="配置子指令块"
          >
            <Settings2 size={14} className="animate-[spin_8s_linear_infinite]" />
            <span className="hidden sm:inline">配置</span>
          </button>
        )}

        <div className="flex flex-col items-stretch opacity-0 group-hover:opacity-100 transition-opacity border-l border-white/5">
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (index > 0) moveInstruction(index, index - 1);
            }}
            disabled={index === 0}
            className="flex-1 px-1.5 hover:bg-white/5 disabled:opacity-20 disabled:cursor-not-allowed text-white/40 hover:text-white/70 transition-colors flex items-center justify-center"
          >
            <ChevronUp size={13} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
            }}
            disabled
            className="flex-1 px-1.5 hover:bg-white/5 disabled:opacity-20 disabled:cursor-not-allowed text-white/40 hover:text-white/70 transition-colors flex items-center justify-center border-t border-white/5"
          >
            <ChevronDown size={13} />
          </button>
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            removeInstruction(inst.id);
          }}
          className="px-3 hover:bg-red-500/20 text-red-400/50 hover:text-red-400 transition-all flex items-center justify-center border-l border-red-500/10"
          title="删除指令"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

interface SubBlockListProps {
  instructions: Instruction[];
  parentId: string;
  branch: 'if' | 'else';
  depth: number;
  label: string;
  color: string;
  onEdit: (id: string) => void;
  onOpenLogicBlock: (id: string) => void;
  editingId: string | null;
  executionState: ExecutionState;
  squadColor: string;
}

function SubBlockList({
  instructions,
  parentId,
  branch,
  depth,
  label,
  color,
  onEdit,
  onOpenLogicBlock,
  editingId,
  executionState,
  squadColor,
}: SubBlockListProps) {
  const { addInstruction } = useGameStore();

  const quickAdd = (type: InstructionType) => {
    addInstruction(type, undefined, parentId, branch);
  };

  return (
    <div
      className="rounded-xl overflow-hidden border"
      style={{
        backgroundColor: `${color}08`,
        borderColor: `${color}30`,
        boxShadow: `inset 0 0 30px ${color}0a`,
      }}
    >
      <div
        className="px-3 py-2 flex items-center justify-between"
        style={{
          backgroundColor: `${color}18`,
          borderBottom: `1px solid ${color}30`,
        }}
      >
        <div
          className="font-mono text-[11px] tracking-[0.2em] flex items-center gap-1.5"
          style={{ color }}
        >
          <Layers size={12} /> {label} · {instructions.length} 条
        </div>
      </div>
      <div className="p-2 space-y-1.5">
        {instructions.length === 0 ? (
          <div className="py-6 text-center text-[11px] font-mono opacity-50" style={{ color }}>
            ⬜ {label} 块为空 · 点击下方快捷按钮添加
          </div>
        ) : (
          instructions.map((inst, idx) => (
            <InstructionNode
              key={inst.id}
              inst={inst}
              depth={depth + 1}
              index={idx}
              parentId={parentId}
              branch={branch}
              onEdit={onEdit}
              onOpenLogicBlock={onOpenLogicBlock}
              editingId={editingId}
              executionState={executionState}
              squadColor={squadColor}
            />
          ))
        )}
        <div className="pt-1 mt-2 border-t border-dashed" style={{ borderColor: `${color}25` }}>
          <p className="text-[9px] font-mono mb-1.5 px-0.5" style={{ color: `${color}80` }}>
            快捷添加到 {label} ↓
          </p>
          <div className="grid grid-cols-4 gap-1">
            {(
              ['MOVE', 'ATTACK', 'COLLECT', 'RETREAT'] as InstructionType[]
            ).map((type) => {
              const m = INSTRUCTION_META[type];
              return (
                <button
                  key={type}
                  onClick={() => quickAdd(type)}
                  className="px-1.5 py-1.5 rounded-md text-[9px] font-bold flex flex-col items-center gap-0.5 hover:scale-[1.05] active:scale-95 transition-transform border"
                  style={{
                    backgroundColor: m.bgColor,
                    borderColor: `${m.color}40`,
                    color: m.color,
                  }}
                >
                  <span className="text-sm">{m.icon}</span>
                  <span>{m.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

interface LogicBlockEditorProps {
  instructionId: string;
  onClose: () => void;
  executionState: ExecutionState;
  squadColor: string;
  onEdit: (id: string) => void;
  editingId: string | null;
}

function LogicBlockEditor({
  instructionId,
  onClose,
  executionState,
  squadColor,
  onEdit,
  editingId,
}: LogicBlockEditorProps) {
  const { instructions, addInstruction } = useGameStore();
  const blockInst = findInstructionById(instructions, instructionId);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  if (!blockInst || (blockInst.type !== 'IF' && blockInst.type !== 'LOOP')) {
    return null;
  }

  const meta = INSTRUCTION_META[blockInst.type];
  const BlockIcon = blockInst.type === 'IF' ? GitBranch : Repeat;
  const conditionLabel = blockInst.condition ? CONDITION_LABELS[blockInst.condition] : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="absolute inset-0 backdrop-blur-md bg-black/60"
        style={{
          background: `radial-gradient(circle at 50% 0%, ${squadColor}15 0%, transparent 60%), rgba(0,0,0,0.65)`,
        }}
      />
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-4xl max-h-[85vh] rounded-2xl overflow-hidden flex flex-col animate-[fadeIn_0.15s_ease-out]"
        style={{
          background: `linear-gradient(145deg, #0f1d16 0%, #0a1410 50%, #0c1712 100%)`,
          border: `1.5px solid ${meta.color}50`,
          boxShadow: `0 0 60px ${meta.color}25, 0 25px 80px rgba(0,0,0,0.6), inset 0 0 40px ${meta.color}08`,
        }}
      >
        <div
          className="px-5 py-4 flex items-center justify-between shrink-0"
          style={{
            background: `linear-gradient(90deg, ${meta.color}20 0%, transparent 60%)`,
            borderBottom: `1px solid ${meta.color}35`,
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
              style={{
                backgroundColor: meta.color + '30',
                color: meta.color,
                boxShadow: `0 0 20px ${meta.color}40, inset 0 0 15px ${meta.color}20`,
                border: `1.5px solid ${meta.color}60`,
              }}
            >
              <BlockIcon size={22} strokeWidth={2.5} />
            </div>
            <div>
              <h2
                className="font-bold text-lg tracking-wider flex items-center gap-2"
                style={{ color: meta.color }}
              >
                {meta.name} 配置面板
              </h2>
              <p className="text-[11px] mt-0.5 opacity-70" style={{ color: meta.color }}>
                {blockInst.type === 'IF'
                  ? '设置判断条件，然后分别配置 THEN 和 ELSE 两个分支的子指令序列'
                  : '设置循环次数，然后配置 DO 循环块中的子指令序列'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors"
            style={{ color: meta.color + 'b0' }}
            title="关闭 (Esc)"
          >
            <X size={20} strokeWidth={2.5} />
          </button>
        </div>

        {blockInst.type === 'IF' && conditionLabel && (
          <div
            className="px-5 py-3 flex flex-wrap items-center gap-4 shrink-0"
            style={{
              borderBottom: `1px dashed ${meta.color}25`,
              backgroundColor: `${meta.color}0a`,
            }}
          >
            <div
              className="text-[10px] font-mono px-2 py-1 rounded-md tracking-wider"
              style={{ backgroundColor: meta.color + '20', color: meta.color }}
            >
              IF · 条件
            </div>
            <div className="text-sm" style={{ color: meta.color }}>
              <b className="font-mono">{conditionLabel.label}</b>
              {blockInst.conditionParam !== undefined && (
                <span className="opacity-80">
                  {' '}= <span className="font-bold">{blockInst.conditionParam}</span>
                </span>
              )}
            </div>
            <div className="text-[11px] opacity-70" style={{ color: meta.color }}>
              {conditionLabel.description}
            </div>
          </div>
        )}
        {blockInst.type === 'LOOP' && (
          <div
            className="px-5 py-3 flex flex-wrap items-center gap-4 shrink-0"
            style={{
              borderBottom: `1px dashed ${meta.color}25`,
              backgroundColor: `${meta.color}0a`,
            }}
          >
            <div
              className="text-[10px] font-mono px-2 py-1 rounded-md tracking-wider"
              style={{ backgroundColor: meta.color + '20', color: meta.color }}
            >
              LOOP · 循环
            </div>
            <div className="text-sm" style={{ color: meta.color }}>
              <b className="font-mono">
                {blockInst.param === 0 ? '♾️ 无限循环' : `×${blockInst.param} 次`}
              </b>
            </div>
            <div className="text-[11px] opacity-70" style={{ color: meta.color }}>
              {blockInst.param === 0
                ? 'DO 块中的指令将一直循环执行直到游戏结束'
                : `DO 块中的指令将被重复执行 ${blockInst.param} 次`}
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4 custom-scroll">
          {blockInst.type === 'IF' ? (
            <div className="grid md:grid-cols-2 gap-4 h-full">
              <SubBlockList
                instructions={blockInst.children ?? []}
                parentId={blockInst.id}
                branch="if"
                depth={0}
                label="THEN"
                color={meta.color}
                onEdit={onEdit}
                onOpenLogicBlock={(id) => {
                  onClose();
                  setTimeout(() => onEdit(id), 0);
                  setTimeout(() => {
                    const ev = new CustomEvent('open-logic-block', { detail: id });
                    window.dispatchEvent(ev);
                  }, 10);
                }}
                editingId={editingId}
                executionState={executionState}
                squadColor={squadColor}
              />
              <SubBlockList
                instructions={blockInst.elseChildren ?? []}
                parentId={blockInst.id}
                branch="else"
                depth={0}
                label="ELSE"
                color="#a78bfa"
                onEdit={onEdit}
                onOpenLogicBlock={(id) => {
                  onClose();
                  setTimeout(() => onEdit(id), 0);
                  setTimeout(() => {
                    const ev = new CustomEvent('open-logic-block', { detail: id });
                    window.dispatchEvent(ev);
                  }, 10);
                }}
                editingId={editingId}
                executionState={executionState}
                squadColor={squadColor}
              />
            </div>
          ) : (
            <SubBlockList
              instructions={blockInst.children ?? []}
              parentId={blockInst.id}
              branch="if"
              depth={0}
              label="DO"
              color={meta.color}
              onEdit={onEdit}
              onOpenLogicBlock={(id) => {
                onClose();
                setTimeout(() => onEdit(id), 0);
                setTimeout(() => {
                  const ev = new CustomEvent('open-logic-block', { detail: id });
                  window.dispatchEvent(ev);
                }, 10);
              }}
              editingId={editingId}
              executionState={executionState}
              squadColor={squadColor}
            />
          )}
        </div>

        <div
          className="px-5 py-3 flex items-center justify-between gap-3 shrink-0"
          style={{
            borderTop: `1px solid ${meta.color}25`,
            backgroundColor: `${meta.color}08`,
          }}
        >
          <div className="text-[10px] font-mono opacity-70" style={{ color: meta.color }}>
            💡 提示：按 Esc 键关闭 · 支持在子块中继续嵌套 IF/LOOP
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg text-xs font-bold transition-all hover:scale-[1.03] active:scale-95"
              style={{
                backgroundColor: `${meta.color}25`,
                color: meta.color,
                border: `1px solid ${meta.color}50`,
              }}
            >
              完成 ✓
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function InstructionEditor() {
  const { instructions, addInstruction, state } = useGameStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [logicBlockEditorId, setLogicBlockEditorId] = useState<string | null>(null);

  const squads = state.squads;
  const currentSquad = squads.find((s) => s.id === state.currentSquadId);
  const squadColor = currentSquad?.color ?? '#34d399';
  const squadName = currentSquad?.name ?? '主群';

  const executionState = useMemo<ExecutionState>(() => {
    if (!currentSquad) {
      return {
        activeInstructionId: null,
        activeStackIds: new Set(),
        activeElseBranchIds: new Set(),
        instructionTimer: 0,
      };
    }
    return computeExecutionState(currentSquad, state);
  }, [currentSquad, state]);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as string;
      setLogicBlockEditorId(detail);
    };
    window.addEventListener('open-logic-block', handler);
    return () => window.removeEventListener('open-logic-block', handler);
  }, []);

  const totalCount = countFlat(instructions);

  const handleOpenLogicBlock = (id: string) => {
    setLogicBlockEditorId(id);
    if (editingId === id) setEditingId(null);
  };

  return (
    <div
      className="h-full flex flex-col rounded-xl border overflow-hidden"
      style={{
        borderColor: `${squadColor}30`,
        background: `linear-gradient(145deg, #0a1410 0%, #0d1a14 50%, #0b1711 100%)`,
        boxShadow: `0 0 30px ${squadColor}08, 0 4px 20px rgba(0,0,0,0.4)`,
      }}
    >
      <div
        className="px-4 py-3 border-b"
        style={{
          borderColor: `${squadColor}30`,
          background: `linear-gradient(90deg, ${squadColor}15 0%, transparent 60%), rgba(0,0,0,0.3)`,
        }}
      >
        <div className="flex items-center justify-between">
          <div>
            <h3
              className="font-bold tracking-wider text-sm flex items-center gap-2"
              style={{ color: squadColor }}
            >
              <span
                className="inline-block w-3 h-3 rounded-md"
                style={{
                  backgroundColor: squadColor,
                  boxShadow: `0 0 6px ${squadColor}, 0 0 12px ${squadColor}60`,
                }}
              />
              指令序列 · {squadName}
            </h3>
            <p
              className="text-[11px] mt-0.5 tracking-wider"
              style={{ color: `${squadColor}70` }}
            >
              支持嵌套 · IF/ELSE/LOOP 逻辑块 · 点击 ⚙ 配置子块
            </p>
          </div>
          <div
            className="text-xs font-mono px-2.5 py-1 rounded-lg border"
            style={{
              color: `${squadColor}b0`,
              backgroundColor: `${squadColor}12`,
              borderColor: `${squadColor}30`,
            }}
          >
            {totalCount} 条指令
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scroll">
        {instructions.length === 0 && (
          <div className="text-center py-16 px-4 rounded-xl border-2 border-dashed"
            style={{ borderColor: `${squadColor}25` }}
          >
            <div className="text-6xl mb-4 opacity-30">✦</div>
            <div className="text-sm mb-2" style={{ color: `${squadColor}60` }}>
              暂无指令
            </div>
            <div className="text-xs leading-relaxed" style={{ color: `${squadColor}40` }}>
              点击下方指令卡片
              <br />
              添加到序列中
            </div>
          </div>
        )}

        {instructions.map((inst, idx) => (
          <InstructionNode
            key={inst.id}
            inst={inst}
            depth={0}
            index={idx}
            onEdit={(id) => setEditingId(editingId === id ? null : id)}
            onOpenLogicBlock={handleOpenLogicBlock}
            editingId={editingId}
            executionState={executionState}
            squadColor={squadColor}
          />
        ))}
      </div>

      <div
        className="p-3 border-t bg-black/30"
        style={{ borderColor: `${squadColor}20` }}
      >
        <p className="text-[10px] tracking-wider mb-2 px-1" style={{ color: `${squadColor}50` }}>
          点击添加指令到序列末尾 ↓
        </p>
        <div className="grid grid-cols-3 gap-2">
          {(Object.keys(INSTRUCTION_META) as InstructionType[]).map((type) => {
            const meta = INSTRUCTION_META[type];
            const isLogic = type === 'IF' || type === 'ELSE' || type === 'LOOP';
            return (
              <button
                key={type}
                onClick={() => addInstruction(type)}
                className="group relative p-2.5 rounded-xl border transition-all hover:scale-[1.03] active:scale-[0.97]"
                style={{
                  backgroundColor: meta.bgColor,
                  borderColor: meta.borderColor + '50',
                }}
              >
                <div
                  className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{
                    boxShadow: `inset 0 0 25px ${meta.color}30, 0 0 12px ${meta.color}20`,
                  }}
                />
                <div className="relative text-center">
                  <div
                    className="text-xl mb-1 mx-auto w-9 h-9 rounded-lg flex items-center justify-center"
                    style={{
                      backgroundColor: meta.color + '18',
                      color: meta.color,
                      filter: `drop-shadow(0 0 6px ${meta.color}80)`,
                      border: `1px solid ${meta.color}40`,
                    }}
                  >
                    {meta.icon}
                  </div>
                  <div
                    className="text-[11px] font-bold tracking-wide"
                    style={{ color: meta.color }}
                  >
                    {meta.name}
                  </div>
                  {isLogic && (
                    <div
                      className="text-[8px] font-mono mt-0.5 opacity-70"
                      style={{ color: meta.color }}
                    >
                      逻辑块
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {logicBlockEditorId && (
        <LogicBlockEditor
          instructionId={logicBlockEditorId}
          onClose={() => setLogicBlockEditorId(null)}
          executionState={executionState}
          squadColor={squadColor}
          onEdit={(id) => setEditingId((prev) => (prev === id ? null : id))}
          editingId={editingId}
        />
      )}
    </div>
  );
}

export type { Instruction };
