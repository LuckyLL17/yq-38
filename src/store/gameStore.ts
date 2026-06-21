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
import { INSTRUCTION_META } from '../game/types';

let bugIdCounter = 1000;

export const useGameStore = create<GameStore>((set, get) => ({
  state: createInitialState(1),
  instructions: [],

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
}));

export type { InstructionType };
