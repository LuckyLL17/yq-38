import type {
  GameState,
  Instruction,
  GameEvent,
  StateSnapshot,
  EventHistory,
  EventRecorderAPI,
  EventType,
} from './types';
import { simulateStep, updateLevelProgress } from './engine';

const SNAPSHOT_INTERVAL = 60;
const MAX_SNAPSHOTS = 200;
const MAX_EVENTS = 3000;

export function createEventRecorder(): EventRecorderAPI {
  let eventIdCounter = 0;

  const history: EventHistory = {
    events: [],
    snapshots: [],
    currentTick: 0,
    isRewinding: false,
    rewindTick: null,
  };

  function deepCloneState(state: GameState): GameState {
    return {
      ...state,
      bugs: state.bugs.map((b) => ({
        ...b,
        pos: { ...b.pos },
        vel: { ...b.vel },
        target: b.target ? { ...b.target } : null,
      })),
      enemies: state.enemies.map((e) => ({
        ...e,
        pos: { ...e.pos },
        vel: { ...e.vel },
      })),
      resources: state.resources.map((r) => ({
        ...r,
        pos: { ...r.pos },
      })),
      terrain: state.terrain.map((row) => row.map((cell) => ({ ...cell }))),
      particles: state.particles.map((p) => ({
        ...p,
        pos: { ...p.pos },
        vel: { ...p.vel },
      })),
      nestPos: { ...state.nestPos },
    };
  }

  function deepCloneInstructions(instructions: Instruction[]): Instruction[] {
    return instructions.map((i) => ({ ...i }));
  }

  function recordEvent(type: EventType, data: Record<string, unknown>) {
    if (history.isRewinding) return;

    const event: GameEvent = {
      id: ++eventIdCounter,
      type,
      tick: history.currentTick,
      timestamp: Date.now(),
      data,
    };

    history.events.push(event);

    if (history.events.length > MAX_EVENTS) {
      const removeCount = history.events.length - MAX_EVENTS;
      history.events.splice(0, removeCount);
    }
  }

  function takeSnapshot(state: GameState, instructions: Instruction[]) {
    if (history.isRewinding) return;

    const snapshot: StateSnapshot = {
      tick: state.tick,
      state: deepCloneState(state),
      instructions: deepCloneInstructions(instructions),
    };

    const lastSnapshot = history.snapshots[history.snapshots.length - 1];
    if (lastSnapshot && snapshot.tick - lastSnapshot.tick < SNAPSHOT_INTERVAL) {
      return;
    }

    history.snapshots.push(snapshot);
    history.currentTick = snapshot.tick;

    if (history.snapshots.length > MAX_SNAPSHOTS) {
      const removeCount = history.snapshots.length - MAX_SNAPSHOTS;
      history.snapshots.splice(0, removeCount);
    }
  }

  function findSnapshotBeforeTick(tick: number): StateSnapshot | null {
    let lo = 0;
    let hi = history.snapshots.length - 1;
    let result: StateSnapshot | null = null;

    while (lo <= hi) {
      const mid = Math.floor((lo + hi) / 2);
      const snap = history.snapshots[mid];
      if (snap.tick <= tick) {
        result = snap;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }

    return result;
  }

  function seekToTick(targetTick: number): { state: GameState; instructions: Instruction[] } | null {
    if (history.snapshots.length === 0) return null;

    const latestTick = history.currentTick;
    const safeTarget = Math.max(0, Math.min(targetTick, latestTick));

    const snapshot = findSnapshotBeforeTick(safeTarget);
    if (!snapshot) return null;

    let curState = deepCloneState(snapshot.state);
    let curInstructions = deepCloneInstructions(snapshot.instructions);

    while (curState.tick < safeTarget) {
      let instructionTimer = curState.instructionTimer;

      if (curInstructions.length > 0) {
        if (instructionTimer <= 0) {
          instructionTimer = curInstructions[0].duration;
        }
        instructionTimer--;
        if (instructionTimer <= 0) {
          curInstructions = curInstructions.slice(1);
        }
      }

      curState.instructionTimer = instructionTimer;
      curState = simulateStep(curState, {
        instructions: curInstructions,
        onFoodGained: () => {},
        onCrystalGained: () => {},
        onEnemyKilled: () => {},
        onResourceCollected: () => {},
        onBugDied: () => {},
        onBugBorn: () => {},
      });
      curState = updateLevelProgress(curState);
    }

    history.rewindTick = safeTarget;
    return { state: curState, instructions: curInstructions };
  }

  function stepBackward(): { state: GameState; instructions: Instruction[] } | null {
    const baseTick = history.rewindTick ?? history.currentTick;
    const stepSize = Math.max(1, Math.floor(baseTick * 0.02));
    return seekToTick(baseTick - stepSize);
  }

  function stepForward(): { state: GameState; instructions: Instruction[] } | null {
    const baseTick = history.rewindTick ?? history.currentTick;
    const stepSize = Math.max(1, Math.floor(history.currentTick * 0.02));
    return seekToTick(Math.min(baseTick + stepSize, history.currentTick));
  }

  function getEventsInRange(startTick: number, endTick: number): GameEvent[] {
    return history.events.filter((e) => e.tick >= startTick && e.tick <= endTick);
  }

  function enterRewindMode() {
    history.isRewinding = true;
    if (history.rewindTick === null) {
      history.rewindTick = history.currentTick;
    }
  }

  function exitRewindMode() {
    history.isRewinding = false;
    history.rewindTick = null;
  }

  function clear() {
    history.events = [];
    history.snapshots = [];
    history.currentTick = 0;
    history.isRewinding = false;
    history.rewindTick = null;
    eventIdCounter = 0;
  }

  function getLatestTick(): number {
    return history.currentTick;
  }

  return {
    history,
    recordEvent,
    takeSnapshot,
    seekToTick,
    stepBackward,
    stepForward,
    getEventsInRange,
    enterRewindMode,
    exitRewindMode,
    clear,
    getLatestTick,
  };
}
