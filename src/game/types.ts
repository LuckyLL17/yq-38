export type TerrainType = 'plain' | 'forest' | 'rock' | 'water' | 'nest' | 'resource';

export type TimeOfDay = 'dawn' | 'day' | 'dusk' | 'night';
export type WeatherType = 'sunny' | 'cloudy' | 'rain' | 'fog' | 'storm';

export interface DayNightEffect {
  bugSpeedMul: number;
  bugAttackMul: number;
  bugDefenseMul: number;
  bugVisionMul: number;
  bugRegenMul: number;
}

export interface WeatherEffect {
  enemySpeedMul: number;
  enemyAttackMul: number;
  enemyVisionMul: number;
  enemyDefenseMul: number;
  pheromoneDecayMul: number;
}

export interface TimeCycleState {
  dayProgress: number;
  timeOfDay: TimeOfDay;
  currentWeather: WeatherType;
  weatherDuration: number;
  weatherTimer: number;
  dayCount: number;
  dayNightEffect: DayNightEffect;
  weatherEffect: WeatherEffect;
}

export type InstructionType = 'MOVE' | 'ATTACK' | 'COLLECT' | 'REPRODUCE' | 'SPREAD' | 'RETREAT' | 'IF' | 'ELSE' | 'LOOP';

export type ConditionType =
  | 'ENEMY_NEARBY'
  | 'RESOURCE_NEARBY'
  | 'HP_LOW'
  | 'HP_HIGH'
  | 'CARRYING_FULL'
  | 'FOOD_ABUNDANT'
  | 'FOOD_LOW'
  | 'DAYTIME'
  | 'NIGHTTIME';

export interface Instruction {
  id: string;
  type: InstructionType;
  param?: number;
  duration: number;
  children?: Instruction[];
  elseChildren?: Instruction[];
  condition?: ConditionType;
  conditionParam?: number;
  collapsed?: boolean;
}

export interface Position {
  x: number;
  y: number;
}

export interface Velocity {
  vx: number;
  vy: number;
}

export type MutationType =
  | 'strong_jaws'
  | 'thick_shell'
  | 'swift_legs'
  | 'efficient_digestive'
  | 'poison_sting'
  | 'compound_eyes'
  | 'pheromone_trail'
  | 'regenerative'
  | 'group_tactics'
  | 'resource_sense'
  | 'winged_glide'
  | 'iron_grip';

export type AbilityType =
  | 'damage_boost'
  | 'hp_boost'
  | 'speed_boost'
  | 'carry_boost'
  | 'attack_poison'
  | 'vision_range'
  | 'pheromone_strength'
  | 'hp_regen'
  | 'swarm_damage'
  | 'resource_detect'
  | 'glide_terrain'
  | 'no_drop';

export interface Mutation {
  id: string;
  type: MutationType;
  name: string;
  description: string;
  ability: AbilityType;
  value: number;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  icon: string;
  color: string;
  bgColor: string;
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
  squadId: string;
  instructionPointer: number;
  cooldown: number;
  wanderAngle: number;
  age: number;
  exp: number;
  level: number;
  mutations: string[];
  expToNext: number;
  mutationReady: boolean;
}

export interface SwarmEvolution {
  totalExp: number;
  evolutionLevel: number;
  evolutionPoints: number;
  unlockedMutations: string[];
  mutationHistory: Array<{ tick: number; bugId: number; mutation: Mutation }>;
  totalMutations: number;
  legendaryMutations: number;
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

export interface PheromoneCell {
  strength: number;
  age: number;
}

export interface PheromoneMap {
  width: number;
  height: number;
  cellSize: number;
  cells: PheromoneCell[][];
  decayRate: number;
  depositAmount: number;
  maxStrength: number;
}

export interface ExecutionFrame {
  instructionId: string;
  loopCounter: number;
}

export interface Squad {
  id: string;
  name: string;
  color: string;
  instructions: Instruction[];
  instructionTimer: number;
  executionStack: ExecutionFrame[];
  createdAt: number;
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
  pheromoneMap: PheromoneMap;
  squads: Squad[];
  currentSquadId: string;
  evolution: SwarmEvolution;
  pendingMutations: Array<{ bugId: number; mutation: Mutation; tick: number }>;
  timeCycle: TimeCycleState;
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
  | 'instruction_switch'
  | 'bug_levelup'
  | 'bug_mutation'
  | 'swarm_evolution';

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
  squads: Squad[];
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
  takeSnapshot: (state: GameState, instructions: Instruction[], squads: Squad[]) => void;
  seekToTick: (targetTick: number) => { state: GameState; instructions: Instruction[]; squads: Squad[] } | null;
  stepForward: () => { state: GameState; instructions: Instruction[]; squads: Squad[] } | null;
  stepBackward: () => { state: GameState; instructions: Instruction[]; squads: Squad[] } | null;
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
  showPheromoneLayer: boolean;
  setState: (state: Partial<GameState>) => void;
  setInstructions: (instructions: Instruction[]) => void;
  addInstruction: (type: InstructionType, index?: number, parentId?: string, branch?: 'if' | 'else') => void;
  removeInstruction: (id: string) => void;
  moveInstruction: (from: number, to: number) => void;
  updateInstruction: (instructionId: string, updates: Partial<Instruction>) => void;
  toggleInstructionCollapsed: (instructionId: string) => void;
  setPaused: (paused: boolean) => void;
  setSpeed: (speed: number) => void;
  togglePheromoneLayer: () => void;
  setShowPheromoneLayer: (show: boolean) => void;
  clearPheromones: () => void;
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
  createSquad: (name: string, color?: string) => void;
  deleteSquad: (squadId: string) => void;
  renameSquad: (squadId: string, name: string) => void;
  setSquadColor: (squadId: string, color: string) => void;
  setCurrentSquad: (squadId: string) => void;
  setSquadInstructions: (squadId: string, instructions: Instruction[]) => void;
  addSquadInstruction: (squadId: string, type: InstructionType, index?: number, parentId?: string, branch?: 'if' | 'else') => void;
  removeSquadInstruction: (squadId: string, instructionId: string) => void;
  moveSquadInstruction: (squadId: string, from: number, to: number) => void;
  updateSquadInstruction: (squadId: string, instructionId: string, updates: Partial<Instruction>) => void;
  toggleSquadInstructionCollapsed: (squadId: string, instructionId: string) => void;
  assignBugToSquad: (bugId: number, squadId: string) => void;
  assignBulkToSquad: (bugIds: number[], squadId: string) => void;
  assignAllToSquad: (squadId: string) => void;
  splitSquadByRole: (sourceSquadId: string) => void;
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
  IF: {
    name: '如果',
    color: '#818cf8',
    bgColor: 'rgba(129, 140, 248, 0.15)',
    borderColor: '#818cf8',
    icon: '?',
    description: '条件判断，满足条件则执行子指令块',
    hasParam: false,
    durationDefault: 0,
    durationMin: 0,
    durationMax: 0,
    durationLabel: '逻辑块',
  },
  ELSE: {
    name: '否则',
    color: '#a78bfa',
    bgColor: 'rgba(167, 139, 250, 0.15)',
    borderColor: '#a78bfa',
    icon: ':',
    description: 'IF 条件不满足时执行的分支',
    hasParam: false,
    durationDefault: 0,
    durationMin: 0,
    durationMax: 0,
    durationLabel: '逻辑块',
  },
  LOOP: {
    name: '循环',
    color: '#f472b6',
    bgColor: 'rgba(244, 114, 182, 0.15)',
    borderColor: '#f472b6',
    icon: '⟳',
    description: '循环执行子指令块，可指定循环次数',
    hasParam: true,
    paramLabel: '循环次数(0为无限)',
    paramMin: 0,
    paramMax: 100,
    paramDefault: 3,
    durationDefault: 0,
    durationMin: 0,
    durationMax: 0,
    durationLabel: '逻辑块',
  },
};

export const MUTATION_LIBRARY: Record<MutationType, Mutation> = {
  strong_jaws: {
    id: 'strong_jaws',
    type: 'strong_jaws',
    name: '强化颚',
    description: '攻击伤害提升',
    ability: 'damage_boost',
    value: 0.25,
    rarity: 'common',
    icon: '𓆦',
    color: '#f87171',
    bgColor: 'rgba(248, 113, 113, 0.15)',
  },
  thick_shell: {
    id: 'thick_shell',
    type: 'thick_shell',
    name: '厚甲壳',
    description: '最大生命值提升',
    ability: 'hp_boost',
    value: 0.3,
    rarity: 'common',
    icon: '⬢',
    color: '#60a5fa',
    bgColor: 'rgba(96, 165, 250, 0.15)',
  },
  swift_legs: {
    id: 'swift_legs',
    type: 'swift_legs',
    name: '疾速足',
    description: '移动速度提升',
    ability: 'speed_boost',
    value: 0.2,
    rarity: 'common',
    icon: '»',
    color: '#22d3ee',
    bgColor: 'rgba(34, 211, 238, 0.15)',
  },
  efficient_digestive: {
    id: 'efficient_digestive',
    type: 'efficient_digestive',
    name: '高效消化',
    description: '携带容量提升',
    ability: 'carry_boost',
    value: 0.5,
    rarity: 'common',
    icon: '◈',
    color: '#fbbf24',
    bgColor: 'rgba(251, 191, 36, 0.15)',
  },
  poison_sting: {
    id: 'poison_sting',
    type: 'poison_sting',
    name: '毒刺',
    description: '攻击附带持续毒素伤害',
    ability: 'attack_poison',
    value: 0.15,
    rarity: 'rare',
    icon: '☠',
    color: '#a78bfa',
    bgColor: 'rgba(167, 139, 250, 0.15)',
  },
  compound_eyes: {
    id: 'compound_eyes',
    type: 'compound_eyes',
    name: '复眼',
    description: '侦测范围扩大，优先找到目标',
    ability: 'vision_range',
    value: 1.5,
    rarity: 'rare',
    icon: '◉',
    color: '#34d399',
    bgColor: 'rgba(52, 211, 153, 0.15)',
  },
  pheromone_trail: {
    id: 'pheromone_trail',
    type: 'pheromone_trail',
    name: '信息素强化',
    description: '分泌更强的信息素，引导虫群',
    ability: 'pheromone_strength',
    value: 1.8,
    rarity: 'rare',
    icon: '≋',
    color: '#c084fc',
    bgColor: 'rgba(192, 132, 252, 0.15)',
  },
  regenerative: {
    id: 'regenerative',
    type: 'regenerative',
    name: '再生组织',
    description: '每秒缓慢恢复生命值',
    ability: 'hp_regen',
    value: 0.08,
    rarity: 'rare',
    icon: '✚',
    color: '#4ade80',
    bgColor: 'rgba(74, 222, 128, 0.15)',
  },
  group_tactics: {
    id: 'group_tactics',
    type: 'group_tactics',
    name: '集群战术',
    description: '周围同类越多伤害越高',
    ability: 'swarm_damage',
    value: 0.1,
    rarity: 'epic',
    icon: '◈',
    color: '#f472b6',
    bgColor: 'rgba(244, 114, 182, 0.15)',
  },
  resource_sense: {
    id: 'resource_sense',
    type: 'resource_sense',
    name: '资源感知',
    description: '能探测更远距离的资源',
    ability: 'resource_detect',
    value: 2.0,
    rarity: 'epic',
    icon: '◇',
    color: '#facc15',
    bgColor: 'rgba(250, 204, 21, 0.15)',
  },
  winged_glide: {
    id: 'winged_glide',
    type: 'winged_glide',
    name: '膜翼滑翔',
    description: '不受地形减速影响',
    ability: 'glide_terrain',
    value: 1,
    rarity: 'epic',
    icon: '⋈',
    color: '#38bdf8',
    bgColor: 'rgba(56, 189, 248, 0.15)',
  },
  iron_grip: {
    id: 'iron_grip',
    type: 'iron_grip',
    name: '铁之握',
    description: '死亡时不掉落携带资源',
    ability: 'no_drop',
    value: 1,
    rarity: 'legendary',
    icon: '⚙',
    color: '#e879f9',
    bgColor: 'rgba(232, 121, 249, 0.15)',
  },
};

export const RARITY_WEIGHTS: Record<Mutation['rarity'], number> = {
  common: 60,
  rare: 28,
  epic: 10,
  legendary: 2,
};

export const RARITY_LABEL: Record<Mutation['rarity'], { label: string; color: string }> = {
  common: { label: '普通', color: '#94a3b8' },
  rare: { label: '稀有', color: '#38bdf8' },
  epic: { label: '史诗', color: '#c084fc' },
  legendary: { label: '传说', color: '#fbbf24' },
};

export function calcExpToNext(level: number): number {
  return Math.floor(50 * Math.pow(1.35, level - 1));
}

export function getExpReward(action: 'collect' | 'kill' | 'deposit_food' | 'deposit_crystal' | 'survive' | 'heal'): number {
  switch (action) {
    case 'collect': return 3;
    case 'kill': return 15;
    case 'deposit_food': return 2;
    case 'deposit_crystal': return 5;
    case 'survive': return 1;
    case 'heal': return 4;
  }
}

export const DAY_NIGHT_EFFECTS: Record<TimeOfDay, DayNightEffect> = {
  dawn: {
    bugSpeedMul: 1.1,
    bugAttackMul: 1.05,
    bugDefenseMul: 1.0,
    bugVisionMul: 1.1,
    bugRegenMul: 1.2,
  },
  day: {
    bugSpeedMul: 1.2,
    bugAttackMul: 1.15,
    bugDefenseMul: 0.95,
    bugVisionMul: 1.3,
    bugRegenMul: 1.0,
  },
  dusk: {
    bugSpeedMul: 1.05,
    bugAttackMul: 1.0,
    bugDefenseMul: 1.05,
    bugVisionMul: 1.0,
    bugRegenMul: 1.1,
  },
  night: {
    bugSpeedMul: 0.85,
    bugAttackMul: 0.85,
    bugDefenseMul: 1.25,
    bugVisionMul: 0.6,
    bugRegenMul: 1.35,
  },
};

export const WEATHER_EFFECTS: Record<WeatherType, WeatherEffect> = {
  sunny: {
    enemySpeedMul: 1.0,
    enemyAttackMul: 1.0,
    enemyVisionMul: 1.1,
    enemyDefenseMul: 1.0,
    pheromoneDecayMul: 1.0,
  },
  cloudy: {
    enemySpeedMul: 0.95,
    enemyAttackMul: 1.0,
    enemyVisionMul: 0.9,
    enemyDefenseMul: 1.05,
    pheromoneDecayMul: 1.0,
  },
  rain: {
    enemySpeedMul: 0.75,
    enemyAttackMul: 0.85,
    enemyVisionMul: 0.6,
    enemyDefenseMul: 1.1,
    pheromoneDecayMul: 1.5,
  },
  fog: {
    enemySpeedMul: 0.85,
    enemyAttackMul: 0.9,
    enemyVisionMul: 0.4,
    enemyDefenseMul: 1.15,
    pheromoneDecayMul: 0.8,
  },
  storm: {
    enemySpeedMul: 0.65,
    enemyAttackMul: 1.3,
    enemyVisionMul: 0.5,
    enemyDefenseMul: 0.85,
    pheromoneDecayMul: 2.0,
  },
};

export const WEATHER_WEIGHTS: Record<WeatherType, number> = {
  sunny: 40,
  cloudy: 30,
  rain: 15,
  fog: 10,
  storm: 5,
};

export const CONDITION_LABELS: Record<ConditionType, { label: string; description: string; hasParam: boolean; paramLabel?: string; paramDefault?: number; paramMin?: number; paramMax?: number }> = {
  ENEMY_NEARBY: { label: '附近有敌人', description: '侦测范围内存在敌人', hasParam: true, paramLabel: '侦测距离', paramDefault: 100, paramMin: 20, paramMax: 300 },
  RESOURCE_NEARBY: { label: '附近有资源', description: '侦测范围内存在资源点', hasParam: true, paramLabel: '侦测距离', paramDefault: 120, paramMin: 20, paramMax: 300 },
  HP_LOW: { label: '生命值低', description: '虫群平均生命值低于阈值', hasParam: true, paramLabel: '血量阈值(%)', paramDefault: 30, paramMin: 5, paramMax: 90 },
  HP_HIGH: { label: '生命值高', description: '虫群平均生命值高于阈值', hasParam: true, paramLabel: '血量阈值(%)', paramDefault: 80, paramMin: 10, paramMax: 95 },
  CARRYING_FULL: { label: '携带已满', description: '个体携带资源达到容量上限', hasParam: false },
  FOOD_ABUNDANT: { label: '食物充足', description: '总食物储备超过阈值', hasParam: true, paramLabel: '食物数量', paramDefault: 100, paramMin: 10, paramMax: 500 },
  FOOD_LOW: { label: '食物短缺', description: '总食物储备低于阈值', hasParam: true, paramLabel: '食物数量', paramDefault: 30, paramMin: 5, paramMax: 200 },
  DAYTIME: { label: '白天时段', description: '当前为白昼时段', hasParam: false },
  NIGHTTIME: { label: '夜晚时段', description: '当前为夜晚时段', hasParam: false },
};

export const TIME_OF_DAY_LABELS: Record<TimeOfDay, { label: string; icon: string; color: string }> = {
  dawn: { label: '黎明', icon: '🌅', color: '#fb923c' },
  day: { label: '白昼', icon: '☀️', color: '#fbbf24' },
  dusk: { label: '黄昏', icon: '🌇', color: '#f472b6' },
  night: { label: '夜晚', icon: '🌙', color: '#818cf8' },
};

export const WEATHER_LABELS: Record<WeatherType, { label: string; icon: string; color: string }> = {
  sunny: { label: '晴朗', icon: '☀️', color: '#fbbf24' },
  cloudy: { label: '多云', icon: '☁️', color: '#94a3b8' },
  rain: { label: '降雨', icon: '🌧️', color: '#38bdf8' },
  fog: { label: '迷雾', icon: '🌫️', color: '#cbd5e1' },
  storm: { label: '风暴', icon: '⛈️', color: '#a78bfa' },
};

export const TICKS_PER_DAY = 2400;
export const WEATHER_CHANGE_INTERVAL = 600;

export function getTimeOfDay(progress: number): TimeOfDay {
  if (progress < 0.125) return 'dawn';
  if (progress < 0.625) return 'day';
  if (progress < 0.75) return 'dusk';
  return 'night';
}

export function selectRandomWeather(): WeatherType {
  const types = Object.keys(WEATHER_WEIGHTS) as WeatherType[];
  const totalWeight = types.reduce((sum, t) => sum + WEATHER_WEIGHTS[t], 0);
  let roll = Math.random() * totalWeight;
  
  for (const t of types) {
    roll -= WEATHER_WEIGHTS[t];
    if (roll <= 0) return t;
  }
  return 'sunny';
}
