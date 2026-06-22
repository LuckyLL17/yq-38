import { create } from 'zustand';
import type { GameStore, Instruction, InstructionType, InstructionPreset } from '../game/types';
import {
  createInitialState,
  simulateStep,
  tryReproduce,
  createBug,
  updateLevelProgress,
} from '../game/engine';
import type { Bug } from '../game/types';
import { INSTRUCTION_META } from '../game/types';

let bugIdCounter = 1000;

const PRESET_STORAGE_KEY = 'swarm_codex_presets';
const PRESET_EXPORT_MAGIC = 'SWARM_PRESET::';

function loadPresetsFromStorage(): InstructionPreset[] {
  try {
    const raw = localStorage.getItem(PRESET_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
    return [];
  } catch {
    return [];
  }
}

function savePresetsToStorage(presets: InstructionPreset[]) {
  try {
    localStorage.setItem(PRESET_STORAGE_KEY, JSON.stringify(presets));
  } catch {
    // ignore
  }
}

function validateInstructions(instructions: unknown): instructions is Instruction[] {
  if (!Array.isArray(instructions)) return false;
  return instructions.every((inst) => {
    if (!inst || typeof inst !== 'object') return false;
    const i = inst as Record<string, unknown>;
    if (typeof i.id !== 'string') return false;
    if (typeof i.type !== 'string') return false;
    if (typeof i.duration !== 'number') return false;
    if (!Object.keys(INSTRUCTION_META).includes(i.type as string)) return false;
    if (i.param !== undefined && typeof i.param !== 'number') return false;
    return true;
  });
}

function regenerateInstructionIds(instructions: Instruction[]): Instruction[] {
  return instructions.map((inst) => ({
    ...inst,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${Math.random().toString(36).slice(2, 6)}`,
  }));
}

export const useGameStore = create<GameStore>((set, get) => ({
  state: createInitialState(1),
  instructions: [],
  presets: loadPresetsFromStorage(),

  setState: (partial) => set((s) => ({ state: { ...s.state, ...partial } })),

  setInstructions: (instructions) => set({ instructions }),

  addInstruction: (type, index) => {
    const { instructions, state } = get();
    const meta = INSTRUCTION_META[type];
    const newInst: Instruction = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type,
      duration: meta.durationDefault,
      ...(meta.hasParam ? { param: meta.paramDefault } : {}),
    };
    const newList = [...instructions];
    if (index !== undefined) {
      newList.splice(index, 0, newInst);
    } else {
      newList.push(newInst);
    }
    let newTimer = state.instructionTimer;
    if (newList.length > 0 && newTimer <= 0) {
      newTimer = newList[0].duration;
    }
    set({ instructions: newList, state: { ...state, instructionTimer: newTimer } });
  },

  removeInstruction: (id) => {
    const { instructions, state } = get();
    const targetIndex = instructions.findIndex((i) => i.id === id);
    const newList = instructions.filter((i) => i.id !== id);
    let newTimer = state.instructionTimer;
    if (targetIndex === 0) {
      newTimer = newList.length > 0 ? newList[0].duration : 0;
    }
    set({ instructions: newList, state: { ...state, instructionTimer: newTimer } });
  },

  moveInstruction: (from, to) => {
    const { instructions, state } = get();
    const newList = [...instructions];
    const [item] = newList.splice(from, 1);
    newList.splice(to, 0, item);
    let newTimer = state.instructionTimer;
    if (from === 0 || to === 0) {
      newTimer = newList.length > 0 ? newList[0].duration : 0;
    }
    set({ instructions: newList, state: { ...state, instructionTimer: newTimer } });
  },

  setPaused: (paused) => set((s) => ({ state: { ...s.state, paused } })),

  setSpeed: (speed) => set((s) => ({ state: { ...s.state, speed } })),

  step: () => {
    const { state, instructions } = get();
    if (state.paused) return;

    let newState = { ...state };
    let workingInstructions = [...instructions];

    if (workingInstructions.length > 0) {
      if (newState.instructionTimer <= 0) {
        newState.instructionTimer = workingInstructions[0].duration;
      }
      newState.instructionTimer--;
      if (newState.instructionTimer <= 0) {
        workingInstructions.shift();
      }
    }

    const reproduceCost = workingInstructions
      .filter((i) => i.type === 'REPRODUCE')
      .reduce((sum, i) => sum + (i.param ?? 15), 0);
    const reproduceCount = workingInstructions.filter((i) => i.type === 'REPRODUCE').length;
    const avgCost = reproduceCount > 0 ? Math.floor(reproduceCost / reproduceCount) : 15;

    const addBugQueue: Bug[] = [];

    newState = simulateStep(newState, {
      instructions: workingInstructions,
      onFoodGained: () => {},
      onCrystalGained: () => {},
      onEnemyKilled: () => {},
      onResourceCollected: () => {},
      onBugDied: () => {},
    });

    if (
      reproduceCount > 0 &&
      newState.tick % 90 === 0 &&
      newState.bugs.length < 120
    ) {
      newState = tryReproduce(newState, avgCost, (bug) => {
        bug.id = ++bugIdCounter;
        addBugQueue.push(bug);
      });
    }

    if (addBugQueue.length > 0) {
      newState = { ...newState, bugs: [...newState.bugs, ...addBugQueue] };
    }

    newState = updateLevelProgress(newState);
    set({ state: newState, instructions: workingInstructions });
  },

  resetLevel: () => {
    bugIdCounter = 1000;
    const s = get();
    const level = s.state.level;
    set({ state: createInitialState(level), instructions: [] });
    setTimeout(() => get().spawnInitialSwarm(), 0);
  },

  nextLevel: () => {
    bugIdCounter = 1000;
    const s = get();
    const nextLv = s.state.level + 1;
    set({ state: createInitialState(nextLv) });
    setTimeout(() => get().spawnInitialSwarm(), 0);
  },

  spawnInitialSwarm: () => {
    const s = get();
    const nestPos = s.state.nestPos;
    const bugs: Bug[] = [];
    for (let i = 0; i < 12; i++) {
      const role: Bug['role'] = i < 7 ? 'worker' : i < 10 ? 'soldier' : 'scout';
      const id = ++bugIdCounter;
      bugs.push(createBug(id, nestPos, role));
    }
    set((prev) => ({ state: { ...prev.state, bugs } }));
  },

  savePreset: (name, description = '') => {
    const { instructions, presets } = get();
    if (instructions.length === 0) return;
    const now = Date.now();
    const newPreset: InstructionPreset = {
      id: `preset-${now}-${Math.random().toString(36).slice(2, 8)}`,
      name: name.trim() || `未命名方案 ${new Date(now).toLocaleString()}`,
      description,
      instructions: JSON.parse(JSON.stringify(instructions)),
      createdAt: now,
      updatedAt: now,
    };
    const newPresets = [newPreset, ...presets];
    set({ presets: newPresets });
    savePresetsToStorage(newPresets);
  },

  loadPreset: (id) => {
    const { presets, state } = get();
    const preset = presets.find((p) => p.id === id);
    if (!preset) return;
    const loadedInstructions = regenerateInstructionIds(preset.instructions);
    const newTimer = loadedInstructions.length > 0 ? loadedInstructions[0].duration : 0;
    set({
      instructions: loadedInstructions,
      state: { ...state, instructionTimer: newTimer },
    });
  },

  deletePreset: (id) => {
    const { presets } = get();
    const newPresets = presets.filter((p) => p.id !== id);
    set({ presets: newPresets });
    savePresetsToStorage(newPresets);
  },

  renamePreset: (id, name) => {
    const { presets } = get();
    const newPresets = presets.map((p) =>
      p.id === id ? { ...p, name: name.trim() || p.name, updatedAt: Date.now() } : p
    );
    set({ presets: newPresets });
    savePresetsToStorage(newPresets);
  },

  updatePresetDescription: (id, description) => {
    const { presets } = get();
    const newPresets = presets.map((p) =>
      p.id === id ? { ...p, description, updatedAt: Date.now() } : p
    );
    set({ presets: newPresets });
    savePresetsToStorage(newPresets);
  },

  exportPreset: (id) => {
    const { presets } = get();
    const preset = presets.find((p) => p.id === id);
    if (!preset) return '';
    const exportData = {
      v: 1,
      n: preset.name,
      d: preset.description,
      i: preset.instructions.map((inst) => ({
        t: inst.type,
        p: inst.param,
        du: inst.duration,
      })),
    };
    const jsonStr = JSON.stringify(exportData);
    try {
      const encoded = btoa(unescape(encodeURIComponent(jsonStr)));
      return `${PRESET_EXPORT_MAGIC}${encoded}`;
    } catch {
      return `${PRESET_EXPORT_MAGIC}${jsonStr}`;
    }
  },

  importPreset: (data) => {
    try {
      let jsonStr = data.trim();
      if (jsonStr.startsWith(PRESET_EXPORT_MAGIC)) {
        jsonStr = jsonStr.slice(PRESET_EXPORT_MAGIC.length);
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(decodeURIComponent(escape(atob(jsonStr))));
      } catch {
        try {
          parsed = JSON.parse(jsonStr);
        } catch {
          return null;
        }
      }
      if (!parsed || typeof parsed !== 'object') return null;
      const p = parsed as Record<string, unknown>;
      if (p.v !== 1) return null;
      if (typeof p.n !== 'string') return null;
      if (typeof p.d !== 'string') return null;
      if (!Array.isArray(p.i)) return null;

      const importedInstructions: Instruction[] = (p.i as Array<Record<string, unknown>>)
        .map((item, idx) => {
          if (!item || typeof item.t !== 'string' || typeof item.du !== 'number') return null;
          if (!Object.keys(INSTRUCTION_META).includes(item.t as string)) return null;
          const meta = INSTRUCTION_META[item.t as InstructionType];
          return {
            id: `imported-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
            type: item.t as InstructionType,
            duration: Math.max(meta.durationMin, Math.min(meta.durationMax, Math.floor(item.du))),
            ...(meta.hasParam && typeof item.p === 'number'
              ? { param: Math.max(meta.paramMin ?? 0, Math.min(meta.paramMax ?? 100, Math.floor(item.p))) }
              : {}),
          } as Instruction;
        })
        .filter((inst): inst is Instruction => inst !== null);

      if (importedInstructions.length === 0) return null;

      const now = Date.now();
      const newPreset: InstructionPreset = {
        id: `preset-import-${now}-${Math.random().toString(36).slice(2, 8)}`,
        name: p.n || `导入方案 ${new Date(now).toLocaleString()}`,
        description: p.d || '',
        instructions: importedInstructions,
        createdAt: now,
        updatedAt: now,
      };
      const { presets } = get();
      const newPresets = [newPreset, ...presets];
      set({ presets: newPresets });
      savePresetsToStorage(newPresets);
      return newPreset;
    } catch {
      return null;
    }
  },

  pastePresetFromClipboard: (text) => {
    const trimmed = text.trim();
    if (!trimmed) return null;
    if (trimmed.startsWith(PRESET_EXPORT_MAGIC)) {
      return get().importPreset(trimmed);
    }
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === 'object' && 'instructions' in parsed) {
        const obj = parsed as Record<string, unknown>;
        if (validateInstructions(obj.instructions)) {
          const now = Date.now();
          const newPreset: InstructionPreset = {
            id: `preset-paste-${now}-${Math.random().toString(36).slice(2, 8)}`,
            name: (typeof obj.name === 'string' && obj.name) || `粘贴方案 ${new Date(now).toLocaleString()}`,
            description: typeof obj.description === 'string' ? obj.description : '',
            instructions: regenerateInstructionIds(obj.instructions as Instruction[]),
            createdAt: now,
            updatedAt: now,
          };
          const { presets } = get();
          const newPresets = [newPreset, ...presets];
          set({ presets: newPresets });
          savePresetsToStorage(newPresets);
          return newPreset;
        }
      }
      if (validateInstructions(parsed)) {
        const now = Date.now();
        const newPreset: InstructionPreset = {
          id: `preset-paste-${now}-${Math.random().toString(36).slice(2, 8)}`,
          name: `粘贴方案 ${new Date(now).toLocaleString()}`,
          description: '',
          instructions: regenerateInstructionIds(parsed as Instruction[]),
          createdAt: now,
          updatedAt: now,
        };
        const { presets } = get();
        const newPresets = [newPreset, ...presets];
        set({ presets: newPresets });
        savePresetsToStorage(newPresets);
        return newPreset;
      }
    } catch {
      // not valid JSON, try direct import format
    }
    return get().importPreset(trimmed);
  },
}));

export type { InstructionType };
