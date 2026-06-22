export type TerrainType = 'plain' | 'forest' | 'rock' | 'water' | 'nest' | 'resource';

export type InstructionType = 'MOVE' | 'ATTACK' | 'COLLECT' | 'REPRODUCE' | 'SPREAD' | 'RETREAT';

export interface Instruction {
  id: string;
  type: InstructionType;
  param?: number;
  duration: number;
}

export interface Position {
  x: number;
  y: number;
}

export interface Velocity {
  vx: number;
  vy: number;
}

export interface Bug {
  id: number;
  pos: Position;
  vel: Velocity;
  target: Position | null;
  hp: number;
  maxHp: number;
  attackPower: number;
  carryCapacity: number;
  carrying: number;
  role: 'worker' | 'soldier' | 'scout';
  instructionPointer: number;
  cooldown: number;
  wanderAngle: number;
  age: number;
}

export interface Enemy {
  id: number;
  pos: Position;
  vel: Velocity;
  hp: number;
  maxHp: number;
  attackPower: number;
  type: 'predator' | 'guard';
  range: number;
}

export interface ResourceNode {
  id: number;
  pos: Position;
  amount: number;
  maxAmount: number;
  type: 'food' | 'crystal';
}

export interface TerrainCell {
  type: TerrainType;
}

export interface Particle {
  id: number;
  pos: Position;
  vel: Velocity;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

export interface GameState {
  bugs: Bug[];
  enemies: Enemy[];
  resources: ResourceNode[];
  terrain: TerrainCell[][];
  particles: Particle[];
  nestPos: Position;
  gridWidth: number;
  gridHeight: number;
  cellSize: number;
  tick: number;
  paused: boolean;
  speed: number;
  gameTime: number;
  totalFood: number;
  totalCrystal: number;
  totalFoodGained: number;
  totalCrystalGained: number;
  enemiesKilled: number;
  resourcesCollected: number;
  instructionTimer: number;
  level: number;
  levelObjective: string;
  levelTarget: number;
  levelProgress: number;
  levelComplete: boolean;
}

export interface InstructionPreset {
  id: string;
  name: string;
  description: string;
  instructions: Instruction[];
  createdAt: number;
  updatedAt: number;
}

export type EventType =
  | 'bug_death'
  | 'enemy_killed'
  | 'food_deposited'
  | 'crystal_deposited'
  | 'resource_collected'
  | 'bug_born'
  | 'instruction_switch';

export interface GameEvent {
  id: number;
  type: EventType;
  tick: number;
  timestamp: number;
  data: Record<string, unknown>;
}

export interface StateSnapshot {
  tick: number;
  state: GameState;
  instructions: Instruction[];
}

export interface EventHistory {
  events: GameEvent[];
  snapshots: StateSnapshot[];
  currentTick: number;
  isRewinding: boolean;
  rewindTick: number | null;
}

export interface EventRecorderAPI {
  history: EventHistory;
  recordEvent: (type: EventType, data: Record<string, unknown>) => void;
  takeSnapshot: (state: GameState, instructions: Instruction[]) => void;
  seekToTick: (targetTick: number) => { state: GameState; instructions: Instruction[] } | null;
  stepForward: () => { state: GameState; instructions: Instruction[] } | null;
  stepBackward: () => { state: GameState; instructions: Instruction[] } | null;
  getEventsInRange: (startTick: number, endTick: number) => GameEvent[];
  enterRewindMode: () => void;
  exitRewindMode: () => void;
  clear: () => void;
  getLatestTick: () => number;
}

export interface GameStore {
  state: GameState;
  instructions: Instruction[];
  presets: InstructionPreset[];
  eventRecorder: EventRecorderAPI;
  setState: (state: Partial<GameState>) => void;
  setInstructions: (instructions: Instruction[]) => void;
  addInstruction: (type: InstructionType, index?: number) => void;
  removeInstruction: (id: string) => void;
  moveInstruction: (from: number, to: number) => void;
  setPaused: (paused: boolean) => void;
  setSpeed: (speed: number) => void;
  step: () => void;
  resetLevel: () => void;
  nextLevel: () => void;
  spawnInitialSwarm: () => void;
  savePreset: (name: string, description?: string) => void;
  loadPreset: (id: string) => void;
  deletePreset: (id: string) => void;
  renamePreset: (id: string, name: string) => void;
  updatePresetDescription: (id: string, description: string) => void;
  exportPreset: (id: string) => string;
  importPreset: (data: string) => InstructionPreset | null;
  pastePresetFromClipboard: (text: string) => InstructionPreset | null;
  seekToTick: (tick: number) => void;
  stepBackward: () => void;
  stepForward: () => void;
  toggleRewindMode: () => void;
}

export const INSTRUCTION_META: Record<InstructionType, {
  name: string;
  color: string;
  bgColor: string;
  borderColor: string;
  icon: string;
  description: string;
  hasParam?: boolean;
  paramLabel?: string;
  paramMin?: number;
  paramMax?: number;
  paramDefault?: number;
  durationDefault: number;
  durationMin: number;
  durationMax: number;
  durationLabel: string;
}> = {
  MOVE: {
    name: '移动',
    color: '#34d399',
    bgColor: 'rgba(52, 211, 153, 0.15)',
    borderColor: '#34d399',
    icon: '➤',
    description: '虫群向目标方向移动，寻找资源或敌人',
    hasParam: true,
    paramLabel: '扩散角度',
    paramMin: 10,
    paramMax: 180,
    paramDefault: 60,
    durationDefault: 300,
    durationMin: 60,
    durationMax: 900,
    durationLabel: '执行时长(tick)',
  },
  ATTACK: {
    name: '攻击',
    color: '#f87171',
    bgColor: 'rgba(248, 113, 113, 0.15)',
    borderColor: '#f87171',
    icon: '⚔',
    description: '攻击附近的敌人，士兵虫效率更高',
    hasParam: true,
    paramLabel: '攻击范围',
    paramMin: 20,
    paramMax: 120,
    paramDefault: 50,
    durationDefault: 400,
    durationMin: 120,
    durationMax: 1200,
    durationLabel: '执行时长(tick)',
  },
  COLLECT: {
    name: '采集',
    color: '#fbbf24',
    bgColor: 'rgba(251, 191, 36, 0.15)',
    borderColor: '#fbbf24',
    icon: '◆',
    description: '采集资源点，满后自动运回巢穴',
    durationDefault: 500,
    durationMin: 120,
    durationMax: 1500,
    durationLabel: '执行时长(tick)',
  },
  REPRODUCE: {
    name: '繁殖',
    color: '#c084fc',
    bgColor: 'rgba(192, 132, 252, 0.15)',
    borderColor: '#c084fc',
    icon: '✦',
    description: '消耗资源在巢穴繁殖新个体',
    hasParam: true,
    paramLabel: '消耗食物',
    paramMin: 5,
    paramMax: 50,
    paramDefault: 15,
    durationDefault: 350,
    durationMin: 120,
    durationMax: 900,
    durationLabel: '执行时长(tick)',
  },
  SPREAD: {
    name: '扩散',
    color: '#22d3ee',
    bgColor: 'rgba(34, 211, 238, 0.15)',
    borderColor: '#22d3ee',
    icon: '✧',
    description: '虫群散开，扩大搜索范围',
    hasParam: true,
    paramLabel: '分散强度',
    paramMin: 1,
    paramMax: 10,
    paramDefault: 5,
    durationDefault: 250,
    durationMin: 60,
    durationMax: 800,
    durationLabel: '执行时长(tick)',
  },
  RETREAT: {
    name: '撤退',
    color: '#fb923c',
    bgColor: 'rgba(251, 146, 60, 0.15)',
    borderColor: '#fb923c',
    icon: '←',
    description: '受伤个体返回巢穴恢复生命',
    durationDefault: 300,
    durationMin: 60,
    durationMax: 800,
    durationLabel: '执行时长(tick)',
  },
};
