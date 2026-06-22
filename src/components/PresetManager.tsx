import { useState, useEffect, useRef } from 'react';
import { useGameStore } from '@/store/gameStore';
import { INSTRUCTION_META } from '@/game/types';
import type { InstructionPreset, Instruction } from '@/game/types';
import {
  Save,
  FolderOpen,
  Trash2,
  Upload,
  X,
  Edit3,
  Check,
  Copy,
  ClipboardPaste,
  ChevronRight,
  Clock,
  AlertCircle,
  CheckCircle2,
  FileJson,
  Archive,
} from 'lucide-react';

export default function PresetManager() {
  const {
    presets,
    instructions,
    savePreset,
    loadPreset,
    deletePreset,
    renamePreset,
    updatePresetDescription,
    exportPreset,
    pastePresetFromClipboard,
  } = useGameStore();

  const [showPanel, setShowPanel] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [presetName, setPresetName] = useState('');
  const [presetDescription, setPresetDescription] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [editingDesc, setEditingDesc] = useState('');
  const [importText, setImportText] = useState('');
  const [importResult, setImportResult] = useState<{ success: boolean; message: string } | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const importTextRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
  };

  const handleSavePreset = () => {
    if (instructions.length === 0) {
      showToast('当前指令序列为空，无法保存', 'error');
      return;
    }
    if (!presetName.trim()) {
      showToast('请输入方案名称', 'error');
      return;
    }
    savePreset(presetName, presetDescription);
    setPresetName('');
    setPresetDescription('');
    setShowSaveDialog(false);
    showToast(`已保存方案：${presetName}`);
  };

  const handleLoadPreset = (preset: InstructionPreset) => {
    loadPreset(preset.id);
    showToast(`已加载方案：${preset.name}`);
  };

  const handleDeletePreset = (preset: InstructionPreset) => {
    if (!confirm(`确定要删除方案「${preset.name}」吗？此操作不可撤销。`)) return;
    deletePreset(preset.id);
    showToast(`已删除方案：${preset.name}`);
  };

  const handleStartEdit = (preset: InstructionPreset) => {
    setEditingId(preset.id);
    setEditingName(preset.name);
    setEditingDesc(preset.description);
  };

  const handleSaveEdit = () => {
    if (!editingId) return;
    if (editingName.trim()) {
      renamePreset(editingId, editingName);
    }
    updatePresetDescription(editingId, editingDesc);
    setEditingId(null);
    showToast('方案信息已更新');
  };

  const handleCancelEdit = () => {
    setEditingId(null);
  };

  const handleExportPreset = async (preset: InstructionPreset) => {
    const data = exportPreset(preset.id);
    if (!data) {
      showToast('导出失败', 'error');
      return;
    }
    try {
      await navigator.clipboard.writeText(data);
      showToast(`方案「${preset.name}」已复制到剪贴板`);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = data;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      showToast(`方案「${preset.name}」已复制到剪贴板`);
    }
  };

  const handlePasteImport = async () => {
    let text = importText;
    if (!text.trim()) {
      try {
        text = await navigator.clipboard.readText();
        setImportText(text);
      } catch {
        showToast('请粘贴方案数据到文本框', 'error');
        return;
      }
    }
    if (!text.trim()) {
      showToast('剪贴板为空', 'error');
      return;
    }
    const result = pastePresetFromClipboard(text);
    if (result) {
      setImportResult({ success: true, message: `成功导入方案：${result.name}（${result.instructions.length} 条指令）` });
      setImportText('');
    } else {
      setImportResult({ success: false, message: '无法识别的方案格式，请检查粘贴内容' });
    }
  };

  const handleDirectPaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      const result = pastePresetFromClipboard(text);
      if (result) {
        showToast(`成功导入方案：${result.name}`);
      } else {
        showToast('剪贴板内容不是有效的方案格式', 'error');
      }
    } catch {
      showToast('无法读取剪贴板，请使用「导入方案」按钮', 'error');
    }
  };

  const formatInstructionsSummary = (instructions: Instruction[]) => {
    const counts: Record<string, number> = {};
    instructions.forEach((inst) => {
      counts[inst.type] = (counts[inst.type] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([type, count]) => {
        const meta = INSTRUCTION_META[type as keyof typeof INSTRUCTION_META];
        return `${meta?.icon || '?'}${count}`;
      })
      .join(' ');
  };

  const formatDate = (ts: number) => {
    const d = new Date(ts);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  return (
    <>
      <div className="flex items-center gap-2">
        <button
          onClick={() => setShowSaveDialog(true)}
          disabled={instructions.length === 0}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-xs font-bold tracking-wide hover:bg-emerald-500/20 hover:border-emerald-500/50 transition-all active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed"
          title={instructions.length === 0 ? '当前没有指令可保存' : '保存当前指令序列为方案'}
        >
          <Save size={13} />
          <span>保存方案</span>
        </button>

        <button
          onClick={() => setShowPanel(true)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-cyan-500/30 bg-cyan-500/10 text-cyan-400 text-xs font-bold tracking-wide hover:bg-cyan-500/20 hover:border-cyan-500/50 transition-all active:scale-[0.97]"
        >
          <FolderOpen size={13} />
          <span>方案库</span>
          {presets.length > 0 && (
            <span className="bg-cyan-500/30 text-cyan-300 px-1.5 py-0.5 rounded text-[10px] font-mono">
              {presets.length}
            </span>
          )}
        </button>

        <button
          onClick={handleDirectPaste}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-fuchsia-500/30 bg-fuchsia-500/10 text-fuchsia-400 text-xs font-bold tracking-wide hover:bg-fuchsia-500/20 hover:border-fuchsia-500/50 transition-all active:scale-[0.97]"
          title="从剪贴板粘贴并识别方案"
        >
          <ClipboardPaste size={13} />
          <span>粘贴导入</span>
        </button>
      </div>

      {showSaveDialog && (
        <Modal onClose={() => setShowSaveDialog(false)} title="保存为预设方案" icon={<Save size={16} />} accentColor="#10b981">
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-emerald-400 tracking-wider mb-1.5">
                方案名称 <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                placeholder="例如：高效采集流、突击作战编队..."
                className="w-full px-3 py-2 rounded-lg bg-black/40 border border-emerald-500/30 text-white/90 text-sm placeholder-white/25 focus:outline-none focus:border-emerald-400/60 focus:bg-black/60 transition-all"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSavePreset();
                }}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-emerald-400/70 tracking-wider mb-1.5">
                方案说明（可选）
              </label>
              <textarea
                value={presetDescription}
                onChange={(e) => setPresetDescription(e.target.value)}
                placeholder="记录这个方案的用途、特点、适用场景..."
                rows={3}
                className="w-full px-3 py-2 rounded-lg bg-black/40 border border-emerald-500/20 text-white/80 text-sm placeholder-white/25 focus:outline-none focus:border-emerald-400/50 focus:bg-black/60 transition-all resize-none"
              />
            </div>
            <div className="p-3 rounded-lg border border-emerald-500/15 bg-emerald-500/5">
              <div className="text-[10px] text-emerald-400/70 font-mono tracking-wider mb-1.5">
                将保存 {instructions.length} 条指令
              </div>
              <div className="flex flex-wrap gap-1">
                {instructions.map((inst, idx) => {
                  const meta = INSTRUCTION_META[inst.type];
                  return (
                    <span
                      key={inst.id}
                      className="text-[10px] px-1.5 py-0.5 rounded font-mono"
                      style={{ backgroundColor: meta.bgColor, color: meta.color }}
                    >
                      {idx + 1}.{meta.icon}{meta.name}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-6">
            <button
              onClick={() => setShowSaveDialog(false)}
              className="px-4 py-2 rounded-lg border border-white/15 text-white/60 text-xs font-bold hover:bg-white/5 hover:text-white/80 transition-all"
            >
              取消
            </button>
            <button
              onClick={handleSavePreset}
              disabled={!presetName.trim()}
              className="px-5 py-2 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 text-black text-xs font-bold tracking-wide hover:shadow-lg hover:shadow-emerald-500/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.97]"
            >
              <Check size={13} className="inline -mt-0.5 mr-1" />
              确认保存
            </button>
          </div>
        </Modal>
      )}

      {showImportDialog && (
        <Modal onClose={() => { setShowImportDialog(false); setImportResult(null); setImportText(''); }} title="导入预设方案" icon={<Upload size={16} />} accentColor="#a855f7">
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-fuchsia-400 tracking-wider mb-1.5">
                粘贴方案数据
              </label>
              <textarea
                ref={importTextRef}
                value={importText}
                onChange={(e) => { setImportText(e.target.value); setImportResult(null); }}
                placeholder="粘贴 SWARM_PRESET:: 开头的方案代码，或 JSON 格式的方案数据..."
                rows={6}
                className="w-full px-3 py-2.5 rounded-lg bg-black/40 border border-fuchsia-500/30 text-white/90 text-xs font-mono placeholder-white/25 focus:outline-none focus:border-fuchsia-400/60 focus:bg-black/60 transition-all resize-none"
              />
            </div>
            {importResult && (
              <div
                className={`p-3 rounded-lg border flex items-start gap-2 ${
                  importResult.success
                    ? 'border-emerald-500/30 bg-emerald-500/10'
                    : 'border-red-500/30 bg-red-500/10'
                }`}
              >
                {importResult.success ? (
                  <CheckCircle2 size={16} className="text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle size={16} className="text-red-400 shrink-0 mt-0.5" />
                )}
                <span className={`text-xs ${importResult.success ? 'text-emerald-300' : 'text-red-300'}`}>
                  {importResult.message}
                </span>
              </div>
            )}
            <div className="p-3 rounded-lg border border-fuchsia-500/15 bg-fuchsia-500/5">
              <div className="flex items-center gap-1.5 text-[10px] text-fuchsia-400/70 font-bold tracking-wider mb-1.5">
                <FileJson size={12} />
                支持的格式
              </div>
              <div className="text-[10px] text-white/40 leading-relaxed space-y-1 font-mono">
                <div>• <span className="text-fuchsia-300/60">SWARM_PRESET::</span> 开头的官方导出代码</div>
                <div>• JSON 格式的完整预设对象 {`{name, instructions[]}`}</div>
                <div>• 纯指令数组 JSON [{`{type, duration, param}`}]</div>
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-6">
            <button
              onClick={() => { setShowImportDialog(false); setImportResult(null); setImportText(''); }}
              className="px-4 py-2 rounded-lg border border-white/15 text-white/60 text-xs font-bold hover:bg-white/5 hover:text-white/80 transition-all"
            >
              关闭
            </button>
            <button
              onClick={handlePasteImport}
              className="px-5 py-2 rounded-lg bg-gradient-to-r from-fuchsia-500 to-purple-500 text-black text-xs font-bold tracking-wide hover:shadow-lg hover:shadow-fuchsia-500/30 transition-all active:scale-[0.97]"
            >
              <Upload size={13} className="inline -mt-0.5 mr-1" />
              解析并导入
            </button>
          </div>
        </Modal>
      )}

      {showPanel && (
        <Modal
          onClose={() => { setShowPanel(false); setEditingId(null); setExpandedId(null); }}
          title="预设方案库"
          icon={<Archive size={16} />}
          accentColor="#06b6d4"
          wide
          extraHeader={
            <button
              onClick={() => { setShowPanel(false); setShowImportDialog(true); }}
              className="flex items-center gap-1 px-3 py-1.5 rounded-md border border-cyan-500/30 bg-cyan-500/10 text-cyan-400 text-[11px] font-bold hover:bg-cyan-500/20 transition-all"
            >
              <Upload size={12} />
              导入方案
            </button>
          }
        >
          {presets.length === 0 ? (
            <div className="text-center py-16 px-8">
              <div className="text-6xl mb-4 opacity-20">⬢</div>
              <div className="text-cyan-400/40 text-sm mb-2">还没有保存任何方案</div>
              <div className="text-white/30 text-xs leading-relaxed mb-6">
                编辑好指令序列后，点击「保存方案」<br />将常用的策略保存起来随时调用
              </div>
              <button
                onClick={() => { setShowPanel(false); setShowSaveDialog(true); }}
                disabled={instructions.length === 0}
                className="px-5 py-2 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 text-black text-xs font-bold tracking-wide hover:shadow-lg hover:shadow-emerald-500/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.97]"
              >
                <Save size={13} className="inline -mt-0.5 mr-1" />
                {instructions.length === 0 ? '先添加一些指令' : '保存当前序列'}
              </button>
            </div>
          ) : (
            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1 custom-scroll">
              {presets.map((preset) => {
                const isExpanded = expandedId === preset.id;
                const isEditing = editingId === preset.id;
                return (
                  <div
                    key={preset.id}
                    className="rounded-xl border border-cyan-500/20 bg-gradient-to-br from-cyan-500/5 to-transparent overflow-hidden transition-all"
                  >
                    <div className="flex items-stretch">
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : preset.id)}
                        className="flex items-center gap-3 py-3 px-4 flex-1 hover:bg-cyan-500/5 transition-all text-left min-w-0"
                      >
                        <ChevronRight
                          size={14}
                          className="text-cyan-400/50 shrink-0 transition-transform"
                          style={{ transform: isExpanded ? 'rotate(90deg)' : 'none' }}
                        />
                        <div className="flex-1 min-w-0">
                          {isEditing ? (
                            <input
                              type="text"
                              value={editingName}
                              onChange={(e) => setEditingName(e.target.value)}
                              onClick={(e) => e.stopPropagation()}
                              className="w-full px-2 py-1 rounded bg-black/40 border border-cyan-500/30 text-cyan-300 text-sm font-bold focus:outline-none focus:border-cyan-400"
                            />
                          ) : (
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-sm font-bold text-cyan-300 truncate">
                                {preset.name}
                              </span>
                              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-400/70 shrink-0">
                                {preset.instructions.length} 指令
                              </span>
                            </div>
                          )}
                          {!isEditing && (
                            <div className="text-[10px] text-white/35 mt-0.5 font-mono flex items-center gap-2">
                              <Clock size={10} />
                              {formatDate(preset.updatedAt)}
                              <span className="opacity-40">·</span>
                              <span className="truncate">{formatInstructionsSummary(preset.instructions)}</span>
                            </div>
                          )}
                        </div>
                      </button>

                      <div className="flex items-stretch border-l border-white/5">
                        {isEditing ? (
                          <>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleSaveEdit(); }}
                              className="px-3 hover:bg-emerald-500/15 text-emerald-400/80 hover:text-emerald-300 transition-all flex items-center"
                              title="保存修改"
                            >
                              <Check size={14} />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleCancelEdit(); }}
                              className="px-3 hover:bg-white/5 text-white/50 hover:text-white/80 transition-all flex items-center border-l border-white/5"
                              title="取消"
                            >
                              <X size={14} />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleLoadPreset(preset); }}
                              className="px-3 hover:bg-emerald-500/15 text-emerald-400/70 hover:text-emerald-300 transition-all flex items-center"
                              title="加载此方案"
                            >
                              <FolderOpen size={14} />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleStartEdit(preset); }}
                              className="px-3 hover:bg-cyan-500/15 text-cyan-400/70 hover:text-cyan-300 transition-all flex items-center border-l border-white/5"
                              title="编辑名称和说明"
                            >
                              <Edit3 size={14} />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleExportPreset(preset); }}
                              className="px-3 hover:bg-fuchsia-500/15 text-fuchsia-400/70 hover:text-fuchsia-300 transition-all flex items-center border-l border-white/5"
                              title="导出并复制到剪贴板"
                            >
                              <Copy size={14} />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDeletePreset(preset); }}
                              className="px-3 hover:bg-red-500/15 text-red-400/70 hover:text-red-300 transition-all flex items-center border-l border-white/5"
                              title="删除此方案"
                            >
                              <Trash2 size={14} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="px-4 pb-4 pt-1 border-t border-cyan-500/10">
                        {isEditing ? (
                          <div className="mt-3">
                            <label className="block text-[10px] font-bold text-cyan-400/70 tracking-wider mb-1">
                              方案说明
                            </label>
                            <textarea
                              value={editingDesc}
                              onChange={(e) => setEditingDesc(e.target.value)}
                              placeholder="记录这个方案的用途和特点..."
                              rows={2}
                              className="w-full px-2.5 py-1.5 rounded-md bg-black/40 border border-cyan-500/20 text-white/80 text-xs placeholder-white/25 focus:outline-none focus:border-cyan-400/50 resize-none"
                            />
                          </div>
                        ) : (
                          preset.description && (
                            <div className="mt-3 p-2.5 rounded-md bg-black/30 border border-white/5">
                              <div className="text-[10px] text-white/30 font-bold tracking-wider mb-1">说明</div>
                              <div className="text-xs text-white/60 leading-relaxed">{preset.description}</div>
                            </div>
                          )
                        )}
                        <div className="mt-3">
                          <div className="text-[10px] text-white/30 font-bold tracking-wider mb-1.5">
                            指令序列
                          </div>
                          <div className="space-y-1.5">
                            {preset.instructions.map((inst, idx) => {
                              const meta = INSTRUCTION_META[inst.type];
                              return (
                                <div
                                  key={inst.id}
                                  className="flex items-center gap-2 p-2 rounded-md"
                                  style={{ backgroundColor: meta.bgColor + '60' }}
                                >
                                  <span
                                    className="w-6 h-6 shrink-0 rounded-md flex items-center justify-center text-sm font-black"
                                    style={{ backgroundColor: meta.color + '30', color: meta.color }}
                                  >
                                    {meta.icon}
                                  </span>
                                  <span className="text-xs font-bold" style={{ color: meta.color }}>
                                    {String(idx + 1).padStart(2, '0')} · {meta.name}
                                  </span>
                                  <span className="text-[10px] font-mono text-white/40 ml-auto">
                                    时长 {inst.duration}
                                    {meta.hasParam && inst.param !== undefined && ` · ${meta.paramLabel} ${inst.param}`}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Modal>
      )}

      {toast && (
        <div
          className={`fixed bottom-8 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl border shadow-2xl backdrop-blur-md flex items-center gap-2 animate-[slideUp_0.3s_ease-out] ${
            toast.type === 'success'
              ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
              : 'bg-red-500/15 border-red-500/40 text-red-300'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 size={16} />
          ) : (
            <AlertCircle size={16} />
          )}
          <span className="text-sm font-bold">{toast.message}</span>
        </div>
      )}
    </>
  );
}

function Modal({
  title,
  icon,
  accentColor,
  onClose,
  children,
  wide,
  extraHeader,
}: {
  title: string;
  icon: React.ReactNode;
  accentColor: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
  extraHeader?: React.ReactNode;
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-[fadeIn_0.2s_ease-out]">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        className={`relative w-full ${wide ? 'max-w-2xl' : 'max-w-md'} rounded-2xl border bg-gradient-to-br from-[#0a1210] to-[#0d0a18] shadow-2xl animate-[scaleIn_0.2s_ease-out] overflow-hidden`}
        style={{ borderColor: accentColor + '35', boxShadow: `0 0 60px ${accentColor}15` }}
      >
        <div
          className="flex items-center justify-between px-5 py-3.5 border-b"
          style={{ borderColor: accentColor + '20', backgroundColor: accentColor + '08' }}
        >
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: accentColor + '25', color: accentColor }}
            >
              {icon}
            </div>
            <div>
              <h3 className="font-bold tracking-wider text-sm" style={{ color: accentColor }}>
                {title}
              </h3>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {extraHeader}
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white/40 hover:text-white/80 hover:bg-white/5 transition-all"
            >
              <X size={16} />
            </button>
          </div>
        </div>
        <div className="p-5">
          {children}
        </div>
      </div>
    </div>
  );
}
