import { useState } from 'react';
import { useGameStore } from '@/store/gameStore';
import { INSTRUCTION_META } from '@/game/types';
import type { InstructionType, Instruction } from '@/game/types';
import { GripVertical, Trash2, ChevronUp, ChevronDown } from 'lucide-react';

export default function InstructionEditor() {
  const {
    instructions,
    addInstruction,
    removeInstruction,
    moveInstruction,
    setInstructions,
  } = useGameStore();
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const handleDragStart = (e: React.DragEvent, idx: number) => {
    setDragIndex(idx);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    setDragOverIndex(idx);
  };

  const handleDrop = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (dragIndex !== null && dragIndex !== idx) {
      moveInstruction(dragIndex, idx);
    }
    setDragIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDragIndex(null);
    setDragOverIndex(null);
  };

  const updateParam = (id: string, param: number) => {
    setInstructions(
      instructions.map((i) => (i.id === id ? { ...i, param } : i))
    );
  };

  return (
    <div className="h-full flex flex-col rounded-xl border border-emerald-500/30 bg-gradient-to-br from-[#0a1410] to-[#0d1a14] overflow-hidden shadow-[0_0_30px_rgba(16,185,129,0.08)]">
      <div className="px-4 py-3 border-b border-emerald-500/20 bg-black/30">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-emerald-400 font-bold tracking-wider text-sm flex items-center gap-2">
              <span className="text-lg">⬢</span>
              指令序列编辑器
            </h3>
            <p className="text-[11px] text-emerald-500/50 mt-0.5 tracking-wider">
              拖拽调整顺序 · 点击指令编辑参数
            </p>
          </div>
          <div className="text-xs font-mono text-emerald-400/70 bg-emerald-500/10 px-2 py-1 rounded border border-emerald-500/20">
            {instructions.length} 条指令
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scroll">
        {instructions.length === 0 && (
          <div className="text-center py-12 px-4">
            <div className="text-5xl mb-4 opacity-30">✦</div>
            <div className="text-emerald-400/40 text-sm mb-2">暂无指令</div>
            <div className="text-emerald-500/30 text-xs leading-relaxed">
              点击下方指令卡片<br />添加到序列中
            </div>
          </div>
        )}

        {instructions.map((inst, idx) => {
          const meta = INSTRUCTION_META[inst.type];
          const isDragging = dragIndex === idx;
          const isDragOver = dragOverIndex === idx && dragIndex !== idx;
          const isEditing = editingId === inst.id;

          return (
            <div
              key={inst.id}
              draggable
              onDragStart={(e) => handleDragStart(e, idx)}
              onDragOver={(e) => handleDragOver(e, idx)}
              onDrop={(e) => handleDrop(e, idx)}
              onDragEnd={handleDragEnd}
              onClick={() => setEditingId(isEditing ? null : inst.id)}
              className={`relative group transition-all duration-200 cursor-pointer ${
                isDragging ? 'opacity-40 scale-95' : ''
              } ${isDragOver ? 'translate-y-1' : ''}`}
            >
              {isDragOver && (
                <div className="absolute -top-1 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent rounded-full" />
              )}
              <div
                className="flex items-stretch gap-2 rounded-lg border backdrop-blur-sm overflow-hidden transition-all"
                style={{
                  backgroundColor: meta.bgColor,
                  borderColor: meta.borderColor + '50',
                  boxShadow: isEditing
                    ? `0 0 15px ${meta.color}40, inset 0 0 15px ${meta.color}15`
                    : 'none',
                }}
              >
                <div
                  className="flex items-center px-2 cursor-grab active:cursor-grabbing"
                  style={{ backgroundColor: meta.color + '25' }}
                >
                  <GripVertical
                    size={14}
                    style={{ color: meta.color }}
                    className="opacity-60 group-hover:opacity-100 transition-opacity"
                  />
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
                    <div className="flex items-center gap-2">
                      <span
                        className="font-bold text-sm"
                        style={{ color: meta.color }}
                      >
                        {String(idx + 1).padStart(2, '0')} · {meta.name}
                      </span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded opacity-60"
                        style={{ backgroundColor: meta.color + '20', color: meta.color }}>
                        {inst.type}
                      </span>
                    </div>
                    {isEditing && meta.hasParam && inst.param !== undefined && (
                      <div className="mt-2 pr-2">
                        <div className="flex items-center justify-between text-[10px] mb-1" style={{ color: meta.color + 'cc' }}>
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
                            updateParam(inst.id, Number(e.target.value));
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
                    {!isEditing && meta.hasParam && (
                      <div className="text-[10px] mt-0.5 font-mono opacity-60" style={{ color: meta.color }}>
                        {meta.paramLabel}: {inst.param}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-col items-stretch opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (idx > 0) moveInstruction(idx, idx - 1);
                    }}
                    disabled={idx === 0}
                    className="flex-1 px-1.5 hover:bg-white/5 disabled:opacity-20 disabled:cursor-not-allowed text-white/40 hover:text-white/70 transition-colors flex items-center justify-center"
                  >
                    <ChevronUp size={13} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (idx < instructions.length - 1) moveInstruction(idx, idx + 1);
                    }}
                    disabled={idx === instructions.length - 1}
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
          );
        })}
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
                  <div
                    className="text-[11px] font-bold tracking-wide"
                    style={{ color: meta.color }}
                  >
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
