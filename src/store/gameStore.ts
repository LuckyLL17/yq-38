import { create } from 'zustand';
import type { GameStore, Instruction, InstructionType, InstructionPreset, Squad } from '../game/types';
import type { Bug, Enemy, PheromoneMap, Mutation } from '../game/types';
import {
  createInitialState,
  simulateStep,
  tryReproduce,
  createBug,
  updateLevelProgress,
  DEFAULT_SQUAD_COLORS,
} from '../game/engine';
import { INSTRUCTION_META } from '../game/types';
import { createEventRecorder } from '../game/eventRecorder';
import type { EventRecorderAPI } from '../game/types';

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

const eventRecorderInstance: EventRecorderAPI = createEventRecorder();

export const useGameStore = create<GameStore>((set, get) => ({
  state: createInitialState(1),
  instructions: [],
  presets: loadPresetsFromStorage(),
  eventRecorder: eventRecorderInstance,
  showPheromoneLayer: false,

  setState: (partial) => set((s) => ({ state: { ...s.state, ...partial } })),

  togglePheromoneLayer: () => set((s) => ({ showPheromoneLayer: !s.showPheromoneLayer })),

  setShowPheromoneLayer: (show) => set({ showPheromoneLayer: show }),

  clearPheromones: () => {
    const { state } = get();
    const emptyMap: PheromoneMap = {
      ...state.pheromoneMap,
      cells: state.pheromoneMap.cells.map(row =>
        row.map(() => ({ strength: 0, age: 0 }))
      ),
    };
    set({ state: { ...state, pheromoneMap: emptyMap } });
  },

  addInstruction: (type, index) => {
    const { state } = get();
    const squadId = state.currentSquadId;
    get().addSquadInstruction(squadId, type, index);
  },

  removeInstruction: (id) => {
    const { state } = get();
    const squadId = state.currentSquadId;
    get().removeSquadInstruction(squadId, id);
  },

  moveInstruction: (from, to) => {
    const { state } = get();
    const squadId = state.currentSquadId;
    get().moveSquadInstruction(squadId, from, to);
  },

  setInstructions: (instructions) => {
    const { state } = get();
    const squadId = state.currentSquadId;
    get().setSquadInstructions(squadId, instructions);
  },

  setPaused: (paused) => set((s) => ({ state: { ...s.state, paused } })),

  setSpeed: (speed) => set((s) => ({ state: { ...s.state, speed } })),

  step: () => {
    const { state, eventRecorder } = get();
    if (state.paused) return;
    if (eventRecorder.history.isRewinding) return;

    let newState = { ...state };
    const newSquads = newState.squads.map(s => ({ ...s, instructions: [...s.instructions] }));

    for (const squad of newSquads) {
      const squadInst = squad.instructions;
      if (squadInst.length > 0) {
        if (squad.instructionTimer <= 0) {
          squad.instructionTimer = squadInst[0].duration;
        }
        squad.instructionTimer--;
        if (squad.instructionTimer <= 0) {
          squadInst.shift();
          if (squadInst.length > 0) {
            eventRecorder.recordEvent('instruction_switch', {
              squadId: squad.id,
              squadName: squad.name,
              nextType: squadInst[0].type,
              remaining: squadInst.length,
            });
          }
        }
      }
    }

    newState.squads = newSquads;

    const currentSquad = newSquads.find(s => s.id === newState.currentSquadId);
    const currentInstructions = currentSquad?.instructions ?? [];

    let totalReproduceCost = 0;
    let totalReproduceCount = 0;
    for (const squad of newSquads) {
      const rCost = squad.instructions
        .filter((i) => i.type === 'REPRODUCE')
        .reduce((sum, i) => sum + (i.param ?? 15), 0);
      const rCount = squad.instructions.filter((i) => i.type === 'REPRODUCE').length;
      totalReproduceCost += rCost;
      totalReproduceCount += rCount;
    }
    const avgCost = totalReproduceCount > 0 ? Math.floor(totalReproduceCost / totalReproduceCount) : 15;

    const addBugQueue: Bug[] = [];

    newState = simulateStep(newState, {
      instructions: currentInstructions,
      squads: newSquads,
      onFoodGained: (n, pos, bugId) => {
        eventRecorder.recordEvent('food_deposited', {
          amount: n,
          pos,
          bugId,
        });
      },
      onCrystalGained: (n, pos, bugId) => {
        eventRecorder.recordEvent('crystal_deposited', {
          amount: n,
          pos,
          bugId,
        });
      },
      onEnemyKilled: (enemy: Enemy, killerBugId) => {
        eventRecorder.recordEvent('enemy_killed', {
          enemyId: enemy.id,
          type: enemy.type,
          hp: enemy.maxHp,
          pos: { ...enemy.pos },
          killerBugId,
        });
      },
      onResourceCollected: (rid, amt, type, pos, bugId) => {
        eventRecorder.recordEvent('resource_collected', {
          resourceId: rid,
          amount: amt,
          resourceType: type,
          pos,
          bugId,
        });
      },
      onBugDied: (bug: Bug) => {
        eventRecorder.recordEvent('bug_death', {
          bugId: bug.id,
          role: bug.role,
          squadId: bug.squadId,
          age: bug.age,
          pos: { ...bug.pos },
          level: bug.level,
          mutations: bug.mutations,
        });
      },
      onBugBorn: (bug: Bug) => {
        eventRecorder.recordEvent('bug_born', {
          bugId: bug.id,
          role: bug.role,
          squadId: bug.squadId,
          pos: { ...bug.pos },
        });
      },
      onBugExp: () => {
        // 可以选择性记录，避免事件过多
      },
      onBugLevelUp: (bugId, level) => {
        eventRecorder.recordEvent('bug_levelup', {
          bugId,
          level,
        });
      },
      onBugMutation: (bugId, mutation: Mutation) => {
        eventRecorder.recordEvent('bug_mutation', {
          bugId,
          mutationId: mutation.id,
          mutationName: mutation.name,
          mutationType: mutation.type,
          rarity: mutation.rarity,
          ability: mutation.ability,
          value: mutation.value,
          description: mutation.description,
        });
      },
      onSwarmEvolution: (newLevel, totalExp) => {
        eventRecorder.recordEvent('swarm_evolution', {
          evolutionLevel: newLevel,
          totalExp,
        });
      },
    });

    if (
      totalReproduceCount > 0 &&
      newState.tick % 90 === 0 &&
      newState.bugs.length < 120
    ) {
      const reproduceSquad = newSquads.find(s => s.instructions.some(i => i.type === 'REPRODUCE')) ?? newSquads[0];
      newState = tryReproduce(newState, avgCost, (bug) => {
        bug.id = ++bugIdCounter;
        bug.squadId = reproduceSquad.id;
        addBugQueue.push(bug);
      }, (bug) => {
        eventRecorder.recordEvent('bug_born', {
          bugId: bug.id,
          role: bug.role,
          squadId: reproduceSquad.id,
          pos: { ...bug.pos },
        });
      });
    }

    if (addBugQueue.length > 0) {
      newState = { ...newState, bugs: [...newState.bugs, ...addBugQueue] };
    }

    newState = updateLevelProgress(newState);
    set({ state: newState, instructions: currentInstructions });

    eventRecorder.takeSnapshot(newState, currentInstructions, newSquads);
  },

  resetLevel: () => {
    bugIdCounter = 1000;
    const s = get();
    const level = s.state.level;
    const newState = createInitialState(level);
    s.eventRecorder.clear();
    const currentSquad = newState.squads.find(sq => sq.id === newState.currentSquadId);
    set({ state: newState, instructions: currentSquad?.instructions ?? [] });
    setTimeout(() => {
      get().spawnInitialSwarm();
      const afterSpawn = get();
      afterSpawn.eventRecorder.takeSnapshot(afterSpawn.state, afterSpawn.instructions, afterSpawn.state.squads);
    }, 0);
  },

  nextLevel: () => {
    bugIdCounter = 1000;
    const s = get();
    const nextLv = s.state.level + 1;
    const newState = createInitialState(nextLv);
    s.eventRecorder.clear();
    const currentSquad = newState.squads.find(sq => sq.id === newState.currentSquadId);
    set({ state: newState, instructions: currentSquad?.instructions ?? [] });
    setTimeout(() => {
      get().spawnInitialSwarm();
      const afterSpawn = get();
      afterSpawn.eventRecorder.takeSnapshot(afterSpawn.state, afterSpawn.instructions, afterSpawn.state.squads);
    }, 0);
  },

  spawnInitialSwarm: () => {
    const s = get();
    const nestPos = s.state.nestPos;
    const squads = s.state.squads;
    const defaultSquad = squads.find(sq => sq.id === 'squad-default') ?? squads[0];
    const alphaSquad = squads.find(sq => sq.id === 'squad-alpha') ?? defaultSquad;
    const betaSquad = squads.find(sq => sq.id === 'squad-beta') ?? defaultSquad;
    const bugs: Bug[] = [];
    for (let i = 0; i < 12; i++) {
      const role: Bug['role'] = i < 7 ? 'worker' : i < 10 ? 'soldier' : 'scout';
      const id = ++bugIdCounter;
      let squadId = defaultSquad.id;
      if (role === 'worker') squadId = alphaSquad.id;
      else if (role === 'soldier') squadId = betaSquad.id;
      else squadId = defaultSquad.id;
      bugs.push(createBug(id, nestPos, role, squadId));
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
    const newSquads = state.squads.map(sq => {
      if (sq.id === state.currentSquadId) {
        return { ...sq, instructions: loadedInstructions, instructionTimer: newTimer };
      }
      return sq;
    });
    set({
      instructions: loadedInstructions,
      state: { ...state, squads: newSquads, instructionTimer: newTimer },
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

  seekToTick: (tick: number) => {
    const { eventRecorder } = get();
    if (!eventRecorder.history.isRewinding) {
      eventRecorder.enterRewindMode();
    }
    const result = eventRecorder.seekToTick(tick);
    if (result) {
      const newState = { ...result.state, squads: result.squads ?? result.state.squads };
      const currentSquad = newState.squads.find(sq => sq.id === newState.currentSquadId);
      set({ state: newState, instructions: currentSquad?.instructions ?? result.instructions });
    }
  },

  stepBackward: () => {
    const { eventRecorder } = get();
    if (!eventRecorder.history.isRewinding) {
      eventRecorder.enterRewindMode();
    }
    const result = eventRecorder.stepBackward();
    if (result) {
      const newState = { ...result.state, squads: result.squads ?? result.state.squads };
      const currentSquad = newState.squads.find(sq => sq.id === newState.currentSquadId);
      set({ state: newState, instructions: currentSquad?.instructions ?? result.instructions });
    }
  },

  stepForward: () => {
    const { eventRecorder } = get();
    const result = eventRecorder.stepForward();
    if (result) {
      const newState = { ...result.state, squads: result.squads ?? result.state.squads };
      const currentSquad = newState.squads.find(sq => sq.id === newState.currentSquadId);
      set({ state: newState, instructions: currentSquad?.instructions ?? result.instructions });
    }
  },

  toggleRewindMode: () => {
    const { eventRecorder, setState } = get();
    if (eventRecorder.history.isRewinding) {
      eventRecorder.exitRewindMode();
      setState({ paused: true });
    } else {
      eventRecorder.enterRewindMode();
      setState({ paused: true });
    }
  },

  createSquad: (name, color) => {
    const { state } = get();
    const usedColors = state.squads.map(s => s.color);
    const availableColor = color ?? DEFAULT_SQUAD_COLORS.find(c => !usedColors.includes(c)) ?? DEFAULT_SQUAD_COLORS[0];
    const newSquad: Squad = {
      id: `squad-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: name.trim() || `编组 ${state.squads.length + 1}`,
      color: availableColor,
      instructions: [],
      instructionTimer: 0,
      createdAt: Date.now(),
    };
    set(prev => ({
      state: { ...prev.state, squads: [...prev.state.squads, newSquad] },
    }));
  },

  deleteSquad: (squadId) => {
    const { state } = get();
    if (state.squads.length <= 1) return;
    const targetSquad = state.squads.find(s => s.id === squadId);
    if (!targetSquad) return;
    const remainingSquads = state.squads.filter(s => s.id !== squadId);
    const fallbackSquad = remainingSquads[0];
    const newCurrentSquadId = state.currentSquadId === squadId ? fallbackSquad.id : state.currentSquadId;
    const newBugs = state.bugs.map(b => b.squadId === squadId ? { ...b, squadId: fallbackSquad.id } : b);
    set(prev => ({
      state: {
        ...prev.state,
        squads: remainingSquads,
        currentSquadId: newCurrentSquadId,
        bugs: newBugs,
      },
      instructions: newCurrentSquadId === fallbackSquad.id ? fallbackSquad.instructions : prev.instructions,
    }));
  },

  renameSquad: (squadId, name) => {
    set(prev => ({
      state: {
        ...prev.state,
        squads: prev.state.squads.map(s =>
          s.id === squadId ? { ...s, name: name.trim() || s.name } : s
        ),
      },
    }));
  },

  setSquadColor: (squadId, color) => {
    set(prev => ({
      state: {
        ...prev.state,
        squads: prev.state.squads.map(s =>
          s.id === squadId ? { ...s, color } : s
        ),
      },
    }));
  },

  setCurrentSquad: (squadId) => {
    const { state } = get();
    const squad = state.squads.find(s => s.id === squadId);
    if (!squad) return;
    set(prev => ({
      state: { ...prev.state, currentSquadId: squadId },
      instructions: squad.instructions,
    }));
  },

  setSquadInstructions: (squadId, instructions) => {
    set(prev => {
      const newSquads = prev.state.squads.map(s => {
        if (s.id !== squadId) return s;
        const newTimer = instructions.length > 0 ? instructions[0].duration : 0;
        return { ...s, instructions, instructionTimer: newTimer };
      });
      const newState = { ...prev.state, squads: newSquads };
      if (prev.state.currentSquadId === squadId) {
        return { state: newState, instructions };
      }
      return { state: newState };
    });
  },

  addSquadInstruction: (squadId, type, index) => {
    const { state } = get();
    const meta = INSTRUCTION_META[type];
    const newInst: Instruction = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type,
      duration: meta.durationDefault,
      ...(meta.hasParam ? { param: meta.paramDefault } : {}),
    };
    const squad = state.squads.find(s => s.id === squadId);
    if (!squad) return;
    const newList = [...squad.instructions];
    if (index !== undefined) {
      newList.splice(index, 0, newInst);
    } else {
      newList.push(newInst);
    }
    let newTimer = squad.instructionTimer;
    if (newList.length > 0 && newTimer <= 0) {
      newTimer = newList[0].duration;
    }
    const newSquads = state.squads.map(s =>
      s.id === squadId ? { ...s, instructions: newList, instructionTimer: newTimer } : s
    );
    const newState = { ...state, squads: newSquads };
    if (state.currentSquadId === squadId) {
      set({ state: newState, instructions: newList });
    } else {
      set({ state: newState });
    }
  },

  removeSquadInstruction: (squadId, instructionId) => {
    const { state } = get();
    const squad = state.squads.find(s => s.id === squadId);
    if (!squad) return;
    const targetIndex = squad.instructions.findIndex((i) => i.id === instructionId);
    const newList = squad.instructions.filter((i) => i.id !== instructionId);
    let newTimer = squad.instructionTimer;
    if (targetIndex === 0) {
      newTimer = newList.length > 0 ? newList[0].duration : 0;
    }
    const newSquads = state.squads.map(s =>
      s.id === squadId ? { ...s, instructions: newList, instructionTimer: newTimer } : s
    );
    const newState = { ...state, squads: newSquads };
    if (state.currentSquadId === squadId) {
      set({ state: newState, instructions: newList });
    } else {
      set({ state: newState });
    }
  },

  moveSquadInstruction: (squadId, from, to) => {
    const { state } = get();
    const squad = state.squads.find(s => s.id === squadId);
    if (!squad) return;
    const newList = [...squad.instructions];
    const [item] = newList.splice(from, 1);
    newList.splice(to, 0, item);
    let newTimer = squad.instructionTimer;
    if (from === 0 || to === 0) {
      newTimer = newList.length > 0 ? newList[0].duration : 0;
    }
    const newSquads = state.squads.map(s =>
      s.id === squadId ? { ...s, instructions: newList, instructionTimer: newTimer } : s
    );
    const newState = { ...state, squads: newSquads };
    if (state.currentSquadId === squadId) {
      set({ state: newState, instructions: newList });
    } else {
      set({ state: newState });
    }
  },

  assignBugToSquad: (bugId, squadId) => {
    const { state } = get();
    if (!state.squads.some(s => s.id === squadId)) return;
    const newBugs = state.bugs.map(b =>
      b.id === bugId ? { ...b, squadId } : b
    );
    set(prev => ({ state: { ...prev.state, bugs: newBugs } }));
  },

  assignBulkToSquad: (bugIds, squadId) => {
    const { state } = get();
    if (!state.squads.some(s => s.id === squadId)) return;
    const idSet = new Set(bugIds);
    const newBugs = state.bugs.map(b =>
      idSet.has(b.id) ? { ...b, squadId } : b
    );
    set(prev => ({ state: { ...prev.state, bugs: newBugs } }));
  },

  assignAllToSquad: (squadId) => {
    const { state } = get();
    if (!state.squads.some(s => s.id === squadId)) return;
    const newBugs = state.bugs.map(b => ({ ...b, squadId }));
    set(prev => ({ state: { ...prev.state, bugs: newBugs } }));
  },

  splitSquadByRole: (sourceSquadId) => {
    const { state } = get();
    const squadBugs = state.bugs.filter(b => b.squadId === sourceSquadId);
    if (squadBugs.length === 0) return;
    const workerSquad = state.squads.find(s => s.id === 'squad-alpha') ?? state.squads[0];
    const soldierSquad = state.squads.find(s => s.id === 'squad-beta') ?? state.squads[state.squads.length - 1];
    const defaultSquad = state.squads.find(s => s.id === 'squad-default') ?? state.squads[0];
    const newBugs = state.bugs.map(b => {
      if (b.squadId !== sourceSquadId) return b;
      if (b.role === 'worker') return { ...b, squadId: workerSquad.id };
      if (b.role === 'soldier') return { ...b, squadId: soldierSquad.id };
      return { ...b, squadId: defaultSquad.id };
    });
    set(prev => ({ state: { ...prev.state, bugs: newBugs } }));
  },
}));

export type { InstructionType };
