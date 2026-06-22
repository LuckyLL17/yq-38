import { useState } from 'react';
import { useGameStore } from '@/store/gameStore';
import { INSTRUCTION_META, CONDITION_LABELS } from '@/game/types';
import type { InstructionType, Instruction, ConditionType } from '@/game/types';
import {
  GripVertical,
  Trash2,
  ChevronUp,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Plus,
} from 'lucide-react';

interface InstructionNodeProps {
  inst: Instruction;
  depth: number;
  index: number;
  parentId?: string;
  branch?: 'if' | 'else';
  flatIndex: number;
  totalFlat: number;
  onEdit: (id: string) => void;
  editingId: string | null;
  instructionTimer: number;
  squadColor: string;
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

function InstructionNode({
  inst,
  depth,
  index,
  parentId,
  branch,
  flatIndex,
  totalFlat,
  onEdit,
  editingId,
  instructionTimer,
  squadColor,
}: InstructionNodeProps) {
  const {
    state,
    removeInstruction,
    moveInstruction,
    addInstruction,
    updateInstruction,
    toggleInstructionCollapsed,
  } = useGameStore();
  const squadId = state.currentSquadId;

  const meta = INSTRUCTION_META[inst.type];
  const isEditing = editingId === inst.id;
  const isExecuting = flatIndex === 0;
  const isLogicBlock = inst.type === 'IF' || inst.type === 'LOOP' || inst.type === 'ELSE';
  const conditionLabel = inst.condition ? CONDITION_LABELS[inst.condition] : null;

  const childrenToRender: { list: Instruction[] | undefined; label: string; color: string; key: string; branch: 'if' | 'else' }[] = [];
  if (inst.type === 'IF') {
    childrenToRender.push({ list: inst.children, label: 'THEN', color: meta.color, key: 'if', branch: 'if' });
    childrenToRender.push({ list: inst.elseChildren, label: 'ELSE', color: '#a78bfa', key: 'else', branch: 'else' });
  } else if (inst.type === 'LOOP') {
    childrenToRender.push({ list: inst.children, label: 'DO', color: meta.color, key: 'loop', branch: 'if' });
  }

  return (
    <div className="space-y-1">
      <div
        className={`relative group transition-all duration-200 cursor-pointer ${isExecuting ? '' : ''}`}
        style={{ paddingLeft: `${depth * 16}px` }}
      >
        {depth > 0 && (
          <div
            className="absolute left-0 top-0 bottom-0 w-px opacity-30"
            style={{ backgroundColor: branch === 'else' ? '#a78bfa' : meta.color }}
          />
        )}
        <div
          onClick={(e) => {
            e.stopPropagation();
            onEdit(inst.id);
          }}
          className="flex items-stretch gap-2 rounded-lg border backdrop-blur-sm overflow-hidden transition-all"
          style={{
            backgroundColor: meta.bgColor,
            borderColor: meta.borderColor + '50',
            boxShadow: isEditing
              ? `0 0 15px ${meta.color}40, inset 0 0 15px ${meta.color}15`
              : 'none',
            marginLeft: depth > 0 ? '6px' : '0',
          }}
        >
          <div
            className="flex items-center px-2 cursor-grab active:cursor-grabbing"
            style={{ backgroundColor: meta.color + '25' }}
          >
            {isLogicBlock && !inst.collapsed ? (
              <ChevronDown
                size={14}
                style={{ color: meta.color }}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleInstructionCollapsed(inst.id);
                }}
                className="cursor-pointer hover:scale-110 transition-transform"
              />
            ) : isLogicBlock && inst.collapsed ? (
              <ChevronRight
                size={14}
                style={{ color: meta.color }}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleInstructionCollapsed(inst.id);
                }}
                className="cursor-pointer hover:scale-110 transition-transform"
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
              className="w-8 h-8 rounded-md flex items-center justify-center text-lg font-black shrink-0"
              style={{
                backgroundColor: meta.color + '30',
                color: meta.color,
                boxShadow: `inset 0 0 8px ${meta.color}30`,
              }}
            >
              {meta.icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-sm" style={{ color: meta.color }}>
                  {String(flatIndex + 1).padStart(2, '0')} · {meta.name}
                </span>
                <span
                  className="text-[10px] font-mono px-1.5 py-0.5 rounded opacity-60"
                  style={{ backgroundColor: meta.color + '20', color: meta.color }}
                >
                  {inst.type}
                </span>
                {isExecuting && (
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 animate-pulse">
                    执行中
                  </span>
                )}
                {inst.type === 'IF' && conditionLabel && (
                  <span
                    className="text-[10px] font-mono px-1.5 py-0.5 rounded"
                    style={{ backgroundColor: meta.color + '25', color: meta.color }}
                  >
                    {conditionLabel.label}
                    {inst.conditionParam !== undefined && `: ${inst.conditionParam}`}
                  </span>
                )}
                {inst.type === 'LOOP' && inst.param !== undefined && (
                  <span
                    className="text-[10px] font-mono px-1.5 py-0.5 rounded"
                    style={{ backgroundColor: meta.color + '25', color: meta.color }}
                  >
                    {inst.param === 0 ? '∞ 无限' : `×${inst.param}`}
                  </span>
                )}
              </div>

              {isExecuting && inst.type !== 'IF' && inst.type !== 'LOOP' && inst.type !== 'ELSE' && (
                <div className="mt-1.5 mb-1">
                  <div className="relative h-1.5 rounded-full bg-black/40 overflow-hidden">
                    <div
                      className="absolute inset-y-0 left-0 rounded-full transition-all duration-150"
                      style={{
                        width: `${Math.max(0, Math.min(100, (instructionTimer / Math.max(1, inst.duration)) * 100))}%`,
                        background: `linear-gradient(90deg, ${meta.color}, ${meta.color}80)`,
                        boxShadow: `0 0 6px ${meta.color}80`,
                      }}
                    />
                  </div>
                  <div
                    className="flex justify-between text-[9px] font-mono mt-0.5 opacity-70"
                    style={{ color: meta.color }}
                  >
                    <span>剩余 {Math.max(0, instructionTimer)} tick</span>
                    <span>时长 {inst.duration}</span>
                  </div>
                </div>
              )}

              {isEditing && (
                <div className="mt-2 pr-2 space-y-2">
                  {inst.type === 'IF' && (
                    <div>
                      <div
                        className="flex items-center justify-between text-[10px] mb-1"
                        style={{ color: meta.color + 'cc' }}
                      >
                        <span>条件类型</span>
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
                        className="w-full text-xs px-2 py-1.5 rounded bg-black/40 border outline-none"
                        style={{
                          borderColor: meta.color + '40',
                          color: meta.color,
                        }}
                      >
                        {(Object.keys(CONDITION_LABELS) as ConditionType[]).map((c) => (
                          <option key={c} value={c} style={{ backgroundColor: '#0a1410' }}>
                            {CONDITION_LABELS[c].label}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  {inst.type === 'IF' && conditionLabel?.hasParam && inst.conditionParam !== undefined && (
                    <div>
                      <div
                        className="flex items-center justify-between text-[10px] mb-1"
                        style={{ color: meta.color + 'cc' }}
                      >
                        <span>{conditionLabel.paramLabel}</span>
                        <span className="font-mono font-bold">{inst.conditionParam}</span>
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
                        className="w-full h-1 rounded-full appearance-none cursor-pointer"
                        style={{
                          background: `linear-gradient(to right, ${meta.color} 0%, ${meta.color} ${((inst.conditionParam - (conditionLabel.paramMin ?? 0)) / ((conditionLabel.paramMax ?? 100) - (conditionLabel.paramMin ?? 0))) * 100}%, rgba(255,255,255,0.1) ${((inst.conditionParam - (conditionLabel.paramMin ?? 0)) / ((conditionLabel.paramMax ?? 100) - (conditionLabel.paramMin ?? 0))) * 100}%, rgba(255,255,255,0.1) 100%)`,
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
                        <span>{meta.paramLabel}</span>
                        <span className="font-mono font-bold">{inst.param}</span>
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
                        className="w-full h-1 rounded-full appearance-none cursor-pointer"
                        style={{
                          background: `linear-gradient(to right, ${meta.color} 0%, ${meta.color} ${((inst.param - (meta.paramMin ?? 0)) / ((meta.paramMax ?? 100) - (meta.paramMin ?? 0))) * 100}%, rgba(255,255,255,0.1) ${((inst.param - (meta.paramMin ?? 0)) / ((meta.paramMax ?? 100) - (meta.paramMin ?? 0))) * 100}%, rgba(255,255,255,0.1) 100%)`,
                          accentColor: meta.color,
                        }}
                      />
                    </div>
                  )}
                  {inst.type !== 'IF' && inst.type !== 'LOOP' && inst.type !== 'ELSE' && (
                    <div>
                      <div
                        className="flex items-center justify-between text-[10px] mb-1"
                        style={{ color: meta.color + 'cc' }}
                      >
                        <span>{meta.durationLabel}</span>
                        <span className="font-mono font-bold">{inst.duration}</span>
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
                        className="w-full h-1 rounded-full appearance-none cursor-pointer"
                        style={{
                          background: `linear-gradient(to right, ${meta.color} 0%, ${meta.color} ${((inst.duration - meta.durationMin) / (meta.durationMax - meta.durationMin)) * 100}%, rgba(255,255,255,0.1) ${((inst.duration - meta.durationMin) / (meta.durationMax - meta.durationMin)) * 100}%, rgba(255,255,255,0.1) 100%)`,
                          accentColor: meta.color,
                        }}
                      />
                    </div>
                  )}
                </div>
              )}
              {!isEditing && (
                <div className="text-[10px] mt-0.5 font-mono opacity-60" style={{ color: meta.color }}>
                  {inst.type !== 'IF' && inst.type !== 'LOOP' && inst.type !== 'ELSE'
                    ? `时长: ${inst.duration} tick${meta.hasParam && ` · ${meta.paramLabel}: ${inst.param}`}`
                    : inst.type === 'IF'
                    ? conditionLabel?.description ?? ''
                    : inst.type === 'LOOP'
                    ? inst.param === 0 ? '无限循环' : `循环 ${inst.param} 次`
                    : ''}
                </div>
              )}
            </div>
          </div>

          {(inst.type === 'IF' || inst.type === 'LOOP') && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                addInstruction('MOVE', undefined, inst.id, inst.type === 'IF' ? 'if' : 'if');
              }}
              className="px-2 hover:bg-white/10 transition-colors flex items-center justify-center"
              style={{ color: meta.color }}
              title="添加子指令"
            >
              <Plus size={14} />
            </button>
          )}

          <div className="flex flex-col items-stretch opacity-0 group-hover:opacity-100 transition-opacity">
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
            className="px-2.5 hover:bg-red-500/20 text-red-400/50 hover:text-red-400 transition-all flex items-center justify-center"
            title="删除指令"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {!inst.collapsed && childrenToRender.map((group) => (
        <div key={group.key}>
          {group.list && group.list.length > 0 && (
            <div
              className="text-[9px] font-mono tracking-wider px-2 py-0.5 mt-1 mb-0.5 rounded inline-block ml-1"
              style={{
                marginLeft: `${depth * 16 + 12}px`,
                backgroundColor: group.color + '12',
                color: group.color,
                borderLeft: `2px solid ${group.color}60`,
              }}
            >
              {group.label}
            </div>
          )}
          {group.list && group.list.map((child, ci) => {
            const beforeCount = countFlat(group.list!.slice(0, ci));
            return (
              <InstructionNode
                key={child.id}
                inst={child}
                depth={depth + 1}
                index={ci}
                parentId={inst.id}
                branch={group.branch}
                flatIndex={-1}
                totalFlat={-1}
                onEdit={onEdit}
                editingId={editingId}
                instructionTimer={-1}
                squadColor={squadColor}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}

function flattenInstructions(instructions: Instruction[]): Instruction[] {
  const result: Instruction[] = [];
  for (const inst of instructions) {
    result.push(inst);
    if (inst.type === 'IF') {
      result.push(...flattenInstructions(inst.children ?? []));
      result.push(...flattenInstructions(inst.elseChildren ?? []));
    } else if (inst.type === 'LOOP') {
      result.push(...flattenInstructions(inst.children ?? []));
    }
  }
  return result;
}

export default function InstructionEditor() {
  const {
    instructions,
    addInstruction,
    state,
  } = useGameStore();
  const [editingId, setEditingId] = useState<string | null>(null);

  const squads = state.squads;
  const currentSquad = squads.find((s) => s.id === state.currentSquadId);
  const squadColor = currentSquad?.color ?? '#34d399';
  const squadName = currentSquad?.name ?? '主群';
  const instructionTimer = currentSquad?.instructionTimer ?? state.instructionTimer;

  const flatInstructions = flattenInstructions(instructions);
  const totalCount = countFlat(instructions);

  return (
    <div className="h-full flex flex-col rounded-xl border border-emerald-500/30 bg-gradient-to-br from-[#0a1410] to-[#0d1a14] overflow-hidden shadow-[0_0_30px_rgba(16,185,129,0.08)]">
      <div className="px-4 py-3 border-b bg-black/30" style={{ borderColor: `${squadColor}30` }}>
        <div className="flex items-center justify-between">
          <div>
            <h3
              className="font-bold tracking-wider text-sm flex items-center gap-2"
              style={{ color: squadColor }}
            >
              <span
                className="inline-block w-3 h-3 rounded-md"
                style={{ backgroundColor: squadColor, boxShadow: `0 0 6px ${squadColor}` }}
              />
              指令序列 · {squadName}
            </h3>
            <p className="text-[11px] mt-0.5 tracking-wider" style={{ color: `${squadColor}70` }}>
              支持嵌套 · IF/ELSE/LOOP 逻辑块
            </p>
          </div>
          <div
            className="text-xs font-mono px-2 py-1 rounded border"
            style={{ color: `${squadColor}b0`, backgroundColor: `${squadColor}12`, borderColor: `${squadColor}30` }}
          >
            {totalCount} 条指令
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scroll">
        {instructions.length === 0 && (
          <div className="text-center py-12 px-4">
            <div className="text-5xl mb-4 opacity-30">✦</div>
            <div className="text-emerald-400/40 text-sm mb-2">暂无指令</div>
            <div className="text-emerald-500/30 text-xs leading-relaxed">
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
            flatIndex={idx}
            totalFlat={flatInstructions.length}
            onEdit={(id) => setEditingId(editingId === id ? null : id)}
            editingId={editingId}
            instructionTimer={instructionTimer}
            squadColor={squadColor}
          />
        ))}
      </div>

      <div className="p-3 border-t border-emerald-500/20 bg-black/30">
        <p className="text-[10px] text-emerald-500/50 tracking-wider mb-2 px-1">
          点击添加指令到序列末尾 ↓
        </p>
        <div className="grid grid-cols-3 gap-2">
          {(Object.keys(INSTRUCTION_META) as InstructionType[]).map((type) => {
            const meta = INSTRUCTION_META[type];
            return (
              <button
                key={type}
                onClick={() => addInstruction(type)}
                className="group relative p-2.5 rounded-lg border transition-all hover:scale-[1.03] active:scale-[0.97]"
                style={{
                  backgroundColor: meta.bgColor,
                  borderColor: meta.borderColor + '50',
                }}
              >
                <div
                  className="absolute inset-0 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ boxShadow: `inset 0 0 20px ${meta.color}30` }}
                />
                <div className="relative text-center">
                  <div
                    className="text-xl mb-1"
                    style={{ color: meta.color, filter: `drop-shadow(0 0 6px ${meta.color}80)` }}
                  >
                    {meta.icon}
                  </div>
                  <div className="text-[11px] font-bold tracking-wide" style={{ color: meta.color }}>
                    {meta.name}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export type { Instruction };
