import { create } from 'zustand';
import type { GameStore, Instruction, InstructionType } from '../game/types';
import {
  createInitialState,
  simulateStep,
  tryReproduce,
  createBug,
  updateLevelProgress,
} from '../game/engine';
import type { Bug } from '../game/types';

let bugIdCounter = 1000;

export const useGameStore = create<GameStore>((set, get) => ({
  state: createInitialState(1),
  instructions: [],

  setState: (partial) => set((s) => ({ state: { ...s.state, ...partial } })),

  setInstructions: (instructions) => set({ instructions }),

  addInstruction: (type, index) => {
    const { instructions } = get();
    const meta = {
      MOVE: { param: 60 },
      ATTACK: { param: 50 },
      COLLECT: {},
      REPRODUCE: { param: 15 },
      SPREAD: { param: 5 },
      RETREAT: {},
    }[type];
    const newInst: Instruction = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type,
      ...(meta?.param !== undefined ? { param: meta.param } : {}),
    };
    const newList = [...instructions];
    if (index !== undefined) {
      newList.splice(index, 0, newInst);
    } else {
      newList.push(newInst);
    }
    set({ instructions: newList });
  },

  removeInstruction: (id) => {
    const { instructions } = get();
    set({ instructions: instructions.filter((i) => i.id !== id) });
  },

  moveInstruction: (from, to) => {
    const { instructions } = get();
    const newList = [...instructions];
    const [item] = newList.splice(from, 1);
    newList.splice(to, 0, item);
    set({ instructions: newList });
  },

  setPaused: (paused) => set((s) => ({ state: { ...s.state, paused } })),

  setSpeed: (speed) => set((s) => ({ state: { ...s.state, speed } })),

  step: () => {
    const { state, instructions } = get();
    if (state.paused) return;

    const reproduceCost = instructions
      .filter((i) => i.type === 'REPRODUCE')
      .reduce((sum, i) => sum + (i.param ?? 15), 0);
    const reproduceCount = instructions.filter((i) => i.type === 'REPRODUCE').length;
    const avgCost = reproduceCount > 0 ? Math.floor(reproduceCost / reproduceCount) : 15;

    let newState = state;
    const addBugQueue: Bug[] = [];

    newState = simulateStep(newState, {
      instructions,
      onFoodGained: (n) => {
        newState = { ...newState, totalFood: newState.totalFood + n };
      },
      onCrystalGained: (n) => {
        newState = { ...newState, totalCrystal: newState.totalCrystal + n };
      },
      onEnemyKilled: () => {
        newState = { ...newState, enemiesKilled: newState.enemiesKilled + 1 };
      },
      onResourceCollected: () => {
        newState = { ...newState, resourcesCollected: newState.resourcesCollected + 1 };
      },
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
    set({ state: newState });
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
}));

export type { InstructionType };
