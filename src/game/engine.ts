import type {
  GameState,
  Bug,
  Enemy,
  ResourceNode,
  TerrainCell,
  Position,
  Particle,
  Instruction,
  TerrainType,
  PheromoneMap,
  PheromoneCell,
  Squad,
  Mutation,
  MutationType,
  SwarmEvolution,
  TimeCycleState,
  TimeOfDay,
  WeatherType,
  ConditionType,
  ExecutionFrame,
} from './types';
import {
  MUTATION_LIBRARY,
  RARITY_WEIGHTS,
  calcExpToNext,
  getExpReward,
  DAY_NIGHT_EFFECTS,
  WEATHER_EFFECTS,
  TICKS_PER_DAY,
  WEATHER_CHANGE_INTERVAL,
  getTimeOfDay,
  selectRandomWeather,
  CONDITION_LABELS,
} from './types';

const GRID_W = 60;
const GRID_H = 40;
const CELL = 16;

const PHEROMONE_CELL = 8;
const PHEROMONE_DECAY = 0.008;
const PHEROMONE_DEPOSIT = 0.15;
const PHEROMONE_MAX = 5.0;

function createPheromoneMap(): PheromoneMap {
  const pw = Math.ceil((GRID_W * CELL) / PHEROMONE_CELL);
  const ph = Math.ceil((GRID_H * CELL) / PHEROMONE_CELL);
  const cells: PheromoneCell[][] = [];
  for (let y = 0; y < ph; y++) {
    cells[y] = [];
    for (let x = 0; x < pw; x++) {
      cells[y][x] = { strength: 0, age: 0 };
    }
  }
  return {
    width: pw,
    height: ph,
    cellSize: PHEROMONE_CELL,
    cells,
    decayRate: PHEROMONE_DECAY,
    depositAmount: PHEROMONE_DEPOSIT,
    maxStrength: PHEROMONE_MAX,
  };
}

function depositPheromone(
  map: PheromoneMap,
  x: number,
  y: number,
  amount?: number
) {
  const px = clamp(Math.floor(x / map.cellSize), 0, map.width - 1);
  const py = clamp(Math.floor(y / map.cellSize), 0, map.height - 1);
  const cell = map.cells[py][px];
  const dep = amount ?? map.depositAmount;
  cell.strength = Math.min(map.maxStrength, cell.strength + dep);
  cell.age = 0;
  const neighbors = [
    [px - 1, py], [px + 1, py], [px, py - 1], [px, py + 1],
    [px - 1, py - 1], [px + 1, py - 1], [px - 1, py + 1], [px + 1, py + 1],
  ];
  for (const [nx, ny] of neighbors) {
    if (nx >= 0 && nx < map.width && ny >= 0 && ny < map.height) {
      const nc = map.cells[ny][nx];
      nc.strength = Math.min(map.maxStrength, nc.strength + dep * 0.35);
    }
  }
}

function decayPheromones(map: PheromoneMap, decayMul: number = 1.0) {
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      const cell = map.cells[y][x];
      if (cell.strength > 0) {
        cell.strength = Math.max(0, cell.strength - map.decayRate * decayMul);
        cell.age++;
      }
    }
  }
}

function clonePheromoneMap(map: PheromoneMap): PheromoneMap {
  return {
    ...map,
    cells: map.cells.map(row => row.map(cell => ({ ...cell }))),
  };
}

function rand(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

function dist(a: Position, b: Position) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function normalize(vx: number, vy: number): [number, number] {
  const len = Math.sqrt(vx * vx + vy * vy);
  if (len < 0.0001) return [0, 0];
  return [vx / len, vy / len];
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

export function createTerrain(level: number): TerrainCell[][] {
  const terrain: TerrainCell[][] = [];
  for (let y = 0; y < GRID_H; y++) {
    terrain[y] = [];
    for (let x = 0; x < GRID_W; x++) {
      const n = Math.sin(x * 0.15 + level) * Math.cos(y * 0.12 + level * 0.5);
      const n2 = Math.sin((x + y) * 0.08 + level * 0.3);
      let type: TerrainType = 'plain';
      if (n > 0.6) type = 'rock';
      else if (n > 0.25) type = 'forest';
      else if (n2 < -0.55) type = 'water';
      terrain[y][x] = { type };
    }
  }
  const cx = Math.floor(GRID_W * 0.2);
  const cy = Math.floor(GRID_H * 0.5);
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      const x = cx + dx;
      const y = cy + dy;
      if (x >= 0 && x < GRID_W && y >= 0 && y < GRID_H) {
        terrain[y][x] = { type: 'nest' };
      }
    }
  }
  return terrain;
}

export function createResources(level: number, terrain: TerrainCell[][]): ResourceNode[] {
  const resources: ResourceNode[] = [];
  let id = 0;
  const count = 6 + level * 2;
  for (let i = 0; i < count; i++) {
    let x = 0, y = 0, valid = false, tries = 0;
    while (!valid && tries < 200) {
      x = Math.floor(rand(GRID_W * 0.4, GRID_W - 3));
      y = Math.floor(rand(2, GRID_H - 3));
      const t = terrain[y]?.[x]?.type;
      if (t && t !== 'water' && t !== 'nest') valid = true;
      tries++;
    }
    if (valid) {
      resources.push({
        id: id++,
        pos: { x: x * CELL + CELL / 2, y: y * CELL + CELL / 2 },
        amount: Math.floor(rand(30, 80 + level * 15)),
        maxAmount: Math.floor(rand(30, 80 + level * 15)),
        type: Math.random() > 0.7 ? 'crystal' : 'food',
      });
    }
  }
  return resources;
}

export function createEnemies(level: number, terrain: TerrainCell[][]): Enemy[] {
  const enemies: Enemy[] = [];
  let id = 0;
  const count = 2 + Math.floor(level * 1.5);
  for (let i = 0; i < count; i++) {
    let x = 0, y = 0, valid = false, tries = 0;
    while (!valid && tries < 200) {
      x = Math.floor(rand(GRID_W * 0.55, GRID_W - 3));
      y = Math.floor(rand(3, GRID_H - 3));
      const t = terrain[y]?.[x]?.type;
      if (t && t !== 'water' && t !== 'nest') valid = true;
      tries++;
    }
    if (valid) {
      enemies.push({
        id: id++,
        pos: { x: x * CELL + CELL / 2, y: y * CELL + CELL / 2 },
        vel: { vx: 0, vy: 0 },
        hp: 30 + level * 15,
        maxHp: 30 + level * 15,
        attackPower: 3 + Math.floor(level * 0.8),
        type: Math.random() > 0.5 ? 'predator' : 'guard',
        range: 80 + level * 10,
      });
    }
  }
  return enemies;
}

export function createBug(
  id: number,
  nestPos: Position,
  role: Bug['role'] = 'worker',
  squadId: string = 'default'
): Bug {
  const angle = rand(0, Math.PI * 2);
  const r = rand(10, 40);
  const stats = {
    worker: { hp: 15, atk: 2, carry: 8 },
    soldier: { hp: 35, atk: 7, carry: 2 },
    scout: { hp: 10, atk: 1, carry: 4 },
  }[role];
  return {
    id,
    pos: { x: nestPos.x + Math.cos(angle) * r, y: nestPos.y + Math.sin(angle) * r },
    vel: { vx: 0, vy: 0 },
    target: null,
    hp: stats.hp,
    maxHp: stats.hp,
    attackPower: stats.atk,
    carryCapacity: stats.carry,
    carrying: 0,
    role,
    squadId,
    instructionPointer: 0,
    cooldown: 0,
    wanderAngle: angle,
    age: 0,
    exp: 0,
    level: 1,
    mutations: [],
    expToNext: calcExpToNext(1),
    mutationReady: false,
  };
}

export function getTerrainAt(
  terrain: TerrainCell[][],
  x: number,
  y: number
): TerrainType {
  const gx = clamp(Math.floor(x / CELL), 0, GRID_W - 1);
  const gy = clamp(Math.floor(y / CELL), 0, GRID_H - 1);
  return terrain[gy][gx].type;
}

export function terrainSpeedMul(type: TerrainType): number {
  switch (type) {
    case 'forest': return 0.7;
    case 'rock': return 0.5;
    case 'water': return 0.25;
    case 'nest': return 1.1;
    case 'plain': return 1.0;
    case 'resource': return 1.0;
  }
}

export function terrainAttackMul(type: TerrainType): number {
  switch (type) {
    case 'forest': return 1.3;
    case 'rock': return 1.5;
    default: return 1.0;
  }
}

function addParticle(
  particles: Particle[],
  pid: { v: number },
  pos: Position,
  color: string,
  size = 3,
  count = 4
) {
  for (let i = 0; i < count; i++) {
    const a = rand(0, Math.PI * 2);
    const s = rand(0.5, 2.5);
    particles.push({
      id: pid.v++,
      pos: { ...pos },
      vel: { vx: Math.cos(a) * s, vy: Math.sin(a) * s },
      life: rand(20, 45),
      maxLife: 45,
      color,
      size: rand(size * 0.6, size * 1.4),
    });
  }
}

export function createSwarmEvolution(): SwarmEvolution {
  return {
    totalExp: 0,
    evolutionLevel: 1,
    evolutionPoints: 0,
    unlockedMutations: [],
    mutationHistory: [],
    totalMutations: 0,
    legendaryMutations: 0,
  };
}

export function selectRandomMutation(existingTypes: MutationType[] = []): Mutation {
  const availableTypes = (Object.keys(MUTATION_LIBRARY) as MutationType[]).filter(
    (t) => !existingTypes.includes(t)
  );
  const pool = availableTypes.length > 0 ? availableTypes : (Object.keys(MUTATION_LIBRARY) as MutationType[]);

  const totalWeight = pool.reduce(
    (sum, t) => sum + RARITY_WEIGHTS[MUTATION_LIBRARY[t].rarity],
    0
  );
  let roll = Math.random() * totalWeight;

  for (const t of pool) {
    const m = MUTATION_LIBRARY[t];
    roll -= RARITY_WEIGHTS[m.rarity];
    if (roll <= 0) return { ...m };
  }
  return { ...MUTATION_LIBRARY[pool[0]] };
}

export function applyMutationStats(bug: Bug, mutation: Mutation): Bug {
  const b = { ...bug, mutations: [...bug.mutations, mutation.id] };
  switch (mutation.ability) {
    case 'hp_boost':
      b.maxHp = Math.floor(b.maxHp * (1 + mutation.value));
      b.hp = Math.min(b.maxHp, b.hp + (b.maxHp - bug.maxHp));
      break;
    case 'carry_boost':
      b.carryCapacity = Math.floor(b.carryCapacity * (1 + mutation.value));
      break;
  }
  return b;
}

export function addExpToBug(bug: Bug, amount: number): { bug: Bug; leveledUp: boolean; levelsGained: number } {
  const b = { ...bug };
  b.exp += amount;
  let levelsGained = 0;
  while (b.exp >= b.expToNext && b.level < 20) {
    b.exp -= b.expToNext;
    b.level++;
    b.expToNext = calcExpToNext(b.level);
    levelsGained++;
    b.maxHp = Math.floor(b.maxHp * 1.08);
    b.hp = b.maxHp;
    b.attackPower = Math.max(1, Math.floor(b.attackPower * 1.12));
  }
  if (levelsGained > 0) {
    b.mutationReady = true;
  }
  return { bug: b, leveledUp: levelsGained > 0, levelsGained };
}

export function getBugAbilityValue(bug: Bug, mutationsMap: Map<string, Mutation>, ability: string): number {
  let total = 0;
  for (const mid of bug.mutations) {
    const m = mutationsMap.get(mid);
    if (m && m.ability === ability) total += m.value;
  }
  return total;
}

export function createMutationsMap(): Map<string, Mutation> {
  const map = new Map<string, Mutation>();
  for (const key of Object.keys(MUTATION_LIBRARY) as MutationType[]) {
    map.set(MUTATION_LIBRARY[key].id, MUTATION_LIBRARY[key]);
  }
  return map;
}

export function calcSwarmEvolutionLevel(totalExp: number): number {
  if (totalExp < 500) return 1;
  if (totalExp < 1500) return 2;
  if (totalExp < 4000) return 3;
  if (totalExp < 10000) return 4;
  if (totalExp < 25000) return 5;
  if (totalExp < 60000) return 6;
  if (totalExp < 150000) return 7;
  return 8;
}

export interface SimulationContext {
  instructions: Instruction[];
  squads: Squad[];
  onFoodGained?: (n: number, pos: Position, bugId?: number) => void;
  onCrystalGained?: (n: number, pos: Position, bugId?: number) => void;
  onEnemyKilled?: (enemy: Enemy, killerBugId?: number) => void;
  onResourceCollected?: (resourceId: number, amount: number, type: 'food' | 'crystal', pos: Position, bugId?: number) => void;
  onBugDied?: (bug: Bug) => void;
  onBugBorn?: (bug: Bug) => void;
  onBugExp?: (bugId: number, amount: number, source: string) => void;
  onBugLevelUp?: (bugId: number, level: number) => void;
  onBugMutation?: (bugId: number, mutation: Mutation) => void;
  onSwarmEvolution?: (newLevel: number, totalExp: number) => void;
}

export function simulateStep(
  state: GameState,
  ctx: SimulationContext
): GameState {
  if (state.paused) return state;

  const { terrain, nestPos, squads, evolution } = state;
  const newParticles = [...state.particles];
  const pid = { v: (state.particles[state.particles.length - 1]?.id ?? 0) + 1 };
  const newPheromoneMap = clonePheromoneMap(state.pheromoneMap);
  const mutationsMap = createMutationsMap();
  
  const newTimeCycle = updateTimeCycle(state.timeCycle);
  const { dayNightEffect, weatherEffect } = newTimeCycle;

  const deltaFood = { v: 0 };
  const deltaCrystal = { v: 0 };
  const deltaKills = { v: 0 };
  const deltaCollected = { v: 0 };
  const deltaExpTotal = { v: 0 };
  const pendingMutations: GameState['pendingMutations'] = [...state.pendingMutations];

  const bugExpDeltas = new Map<number, { amount: number; source: string }[]>();
  const addBugExp = (bugId: number, amount: number, source: string) => {
    if (!bugExpDeltas.has(bugId)) bugExpDeltas.set(bugId, []);
    bugExpDeltas.get(bugId)!.push({ amount, source });
    deltaExpTotal.v += amount;
  };

  const ctxWrap: SimulationContext = {
    instructions: ctx.instructions,
    squads: ctx.squads,
    onFoodGained: (n, pos, bugId) => {
      deltaFood.v += n;
      ctx.onFoodGained?.(n, pos, bugId);
      if (bugId !== undefined) addBugExp(bugId, getExpReward('deposit_food') * n, 'deposit_food');
    },
    onCrystalGained: (n, pos, bugId) => {
      deltaCrystal.v += n;
      ctx.onCrystalGained?.(n, pos, bugId);
      if (bugId !== undefined) addBugExp(bugId, getExpReward('deposit_crystal') * n, 'deposit_crystal');
    },
    onEnemyKilled: (enemy, killerBugId) => {
      deltaKills.v += 1;
      ctx.onEnemyKilled?.(enemy, killerBugId);
      if (killerBugId !== undefined) addBugExp(killerBugId, getExpReward('kill'), 'kill');
    },
    onResourceCollected: (rid, amt, type, pos, bugId) => {
      deltaCollected.v += 1;
      ctx.onResourceCollected?.(rid, amt, type, pos, bugId);
      if (bugId !== undefined) addBugExp(bugId, getExpReward('collect'), 'collect');
    },
    onBugDied: (bug) => { ctx.onBugDied?.(bug); },
    onBugBorn: ctx.onBugBorn,
    onBugExp: ctx.onBugExp,
    onBugLevelUp: ctx.onBugLevelUp,
    onBugMutation: ctx.onBugMutation,
    onSwarmEvolution: ctx.onSwarmEvolution,
  };

  const newBugs = state.bugs.map(b => ({ ...b, vel: { ...b.vel }, pos: { ...b.pos } }));
  const newEnemies = state.enemies.map(e => ({ ...e, vel: { ...e.vel }, pos: { ...e.pos } }));
  const newResources = state.resources.map(r => ({ ...r, pos: { ...r.pos } }));

  const squadMap = new Map(squads.map(s => [s.id, s]));

  for (const bug of newBugs) {
    bug.age++;
    bug.cooldown = Math.max(0, bug.cooldown - 1);
    const terrainAt = getTerrainAt(terrain, bug.pos.x, bug.pos.y);

    const hasGlide = getBugAbilityValue(bug, mutationsMap, 'glide_terrain') > 0;
    const speedMul = hasGlide ? 1.0 : terrainSpeedMul(terrainAt);
    const speedBoost = 1 + getBugAbilityValue(bug, mutationsMap, 'speed_boost');
    const hpRegenVal = getBugAbilityValue(bug, mutationsMap, 'hp_regen');
    if (hpRegenVal > 0 && bug.hp < bug.maxHp) {
      bug.hp = Math.min(bug.maxHp, bug.hp + hpRegenVal * dayNightEffect.bugRegenMul);
    }
    
    if (dayNightEffect.bugRegenMul > 1 && bug.hp < bug.maxHp) {
      bug.hp = Math.min(bug.maxHp, bug.hp + 0.02 * (dayNightEffect.bugRegenMul - 1) * 10);
    }
    if (bug.age % 180 === 0) {
      addBugExp(bug.id, getExpReward('survive'), 'survive');
    }
    const baseSpeed = bug.role === 'scout' ? 1.4 : bug.role === 'soldier' ? 0.85 : 1.05;
    const speed = 1.2 * baseSpeed * speedMul * speedBoost * dayNightEffect.bugSpeedMul;

    const squad = squadMap.get(bug.squadId);
    const cur = squad ? resolveActiveInstructionForBug(squad, state, bug) : null;

    if (!cur) {
      bug.wanderAngle += rand(-0.1, 0.1);
    } else {
      switch (cur.type) {
          case 'MOVE': {
            const spreadRad = ((cur.param ?? 60) * Math.PI) / 180;
            const toRight = { x: GRID_W * CELL * 0.9, y: bug.pos.y };
            const dx = toRight.x - bug.pos.x;
            const dy = toRight.y - bug.pos.y;
            const [nx, ny] = normalize(dx, dy);
            const jitter = rand(-spreadRad / 2, spreadRad / 2);
            const ca = Math.cos(jitter);
            const sa = Math.sin(jitter);
            const ax = nx * ca - ny * sa;
            const ay = nx * sa + ny * ca;
            bug.vel.vx += ax * 0.18;
            bug.vel.vy += ay * 0.18;
            bug.wanderAngle = Math.atan2(ay, ax);
            break;
          }
          case 'SPREAD': {
            const strength = (cur.param ?? 5) * 0.3;
            let sepX = 0, sepY = 0, count = 0;
            for (const other of newBugs) {
              if (other.id === bug.id) continue;
              const d = dist(bug.pos, other.pos);
              if (d < 35 && d > 0.1) {
                const factor = (35 - d) / 35;
                sepX += ((bug.pos.x - other.pos.x) / d) * factor;
                sepY += ((bug.pos.y - other.pos.y) / d) * factor;
                count++;
              }
            }
            if (count > 0) {
              bug.vel.vx += (sepX / count) * strength * 0.4;
              bug.vel.vy += (sepY / count) * strength * 0.4;
            }
            bug.wanderAngle += rand(-0.08, 0.08);
            bug.vel.vx += Math.cos(bug.wanderAngle) * 0.06;
            bug.vel.vy += Math.sin(bug.wanderAngle) * 0.06;
            break;
          }
          case 'COLLECT': {
            const resSenseMul = 1 + getBugAbilityValue(bug, mutationsMap, 'resource_detect');
            const visionMul = 1 + getBugAbilityValue(bug, mutationsMap, 'vision_range');
            let nearestRes: ResourceNode | null = null;
            let nearestD = Infinity;
            for (const r of newResources) {
              if (r.amount <= 0) continue;
              const d = dist(bug.pos, r.pos);
              const effectiveD = d / (resSenseMul * visionMul);
              if (effectiveD < nearestD) {
                nearestD = effectiveD;
                nearestRes = r;
              }
            }
            if (bug.carrying >= bug.carryCapacity) {
              const dx = nestPos.x - bug.pos.x;
              const dy = nestPos.y - bug.pos.y;
              const [nx, ny] = normalize(dx, dy);
              bug.vel.vx += nx * 0.25;
              bug.vel.vy += ny * 0.25;
              if (dist(bug.pos, nestPos) < 28) {
                if (bug.carrying > 0) {
                  const nearest = nearestRes;
                  if (nearest && nearest.type === 'crystal') {
                    ctxWrap.onCrystalGained?.(bug.carrying, { ...bug.pos }, bug.id);
                    addParticle(newParticles, pid, bug.pos, '#a78bfa', 3, 5);
                  } else {
                    ctxWrap.onFoodGained?.(bug.carrying, { ...bug.pos }, bug.id);
                    addParticle(newParticles, pid, bug.pos, '#fbbf24', 3, 5);
                  }
                  bug.carrying = 0;
                }
              }
            } else if (nearestRes) {
              const dx = nearestRes.pos.x - bug.pos.x;
              const dy = nearestRes.pos.y - bug.pos.y;
              const [nx, ny] = normalize(dx, dy);
              bug.vel.vx += nx * 0.22;
              bug.vel.vy += ny * 0.22;
              if (nearestD < 14 && bug.cooldown <= 0) {
                const take = Math.min(bug.carryCapacity - bug.carrying, 3, nearestRes.amount);
                bug.carrying += take;
                nearestRes.amount -= take;
                ctxWrap.onResourceCollected?.(nearestRes.id, take, nearestRes.type, { ...nearestRes.pos }, bug.id);
                bug.cooldown = 10;
                addParticle(newParticles, pid, nearestRes.pos,
                  nearestRes.type === 'crystal' ? '#a78bfa' : '#fbbf24', 2, 2);
              }
            } else {
              bug.wanderAngle += rand(-0.1, 0.1);
              bug.vel.vx += Math.cos(bug.wanderAngle) * 0.08;
              bug.vel.vy += Math.sin(bug.wanderAngle) * 0.08;
            }
            break;
          }
          case 'ATTACK': {
            const atkRange = cur.param ?? 50;
            const atkRangeMul = 1 + getBugAbilityValue(bug, mutationsMap, 'vision_range') * 0.3;
            const damageBoost = 1 + getBugAbilityValue(bug, mutationsMap, 'damage_boost');
            const poisonVal = getBugAbilityValue(bug, mutationsMap, 'attack_poison');
            const swarmDmgVal = getBugAbilityValue(bug, mutationsMap, 'swarm_damage');
            let nearbyAllies = 0;
            if (swarmDmgVal > 0) {
              for (const other of newBugs) {
                if (other.id !== bug.id && dist(bug.pos, other.pos) < 60) nearbyAllies++;
              }
            }
            const swarmMul = 1 + nearbyAllies * swarmDmgVal;
            let nearestEnemy: Enemy | null = null;
            let nearestD = Infinity;
            for (const e of newEnemies) {
              if (e.hp <= 0) continue;
              const d = dist(bug.pos, e.pos);
              if (d < nearestD && d < atkRange * 2.5 * atkRangeMul) {
                nearestD = d;
                nearestEnemy = e;
              }
            }
            if (nearestEnemy) {
              const dx = nearestEnemy.pos.x - bug.pos.x;
              const dy = nearestEnemy.pos.y - bug.pos.y;
              const [nx, ny] = normalize(dx, dy);
              const aggroMul = bug.role === 'soldier' ? 1.4 : 1.0;
              bug.vel.vx += nx * 0.24 * aggroMul;
              bug.vel.vy += ny * 0.24 * aggroMul;
              if (nearestD < atkRange * atkRangeMul && bug.cooldown <= 0) {
                const atkMul = terrainAttackMul(terrainAt);
                let dmg = bug.attackPower * atkMul * (bug.role === 'soldier' ? 1.3 : 1);
                dmg *= damageBoost * swarmMul * dayNightEffect.bugAttackMul;
                if (poisonVal > 0) dmg *= 1 + poisonVal;
                nearestEnemy.hp -= dmg;
                bug.cooldown = 18;
                addParticle(newParticles, pid, nearestEnemy.pos, '#f87171', 3, 3);
                if (nearestEnemy.hp <= 0) {
                  ctxWrap.onEnemyKilled?.(nearestEnemy, bug.id);
                  addParticle(newParticles, pid, nearestEnemy.pos, '#ef4444', 4, 10);
                }
              }
            } else {
              const toRight = { x: GRID_W * CELL * 0.9, y: bug.pos.y };
              const dx = toRight.x - bug.pos.x;
              const dy = toRight.y - bug.pos.y;
              const [nx, ny] = normalize(dx, dy);
              bug.vel.vx += nx * 0.14;
              bug.vel.vy += ny * 0.14;
              bug.wanderAngle += rand(-0.1, 0.1);
              bug.vel.vx += Math.cos(bug.wanderAngle) * 0.05;
              bug.vel.vy += Math.sin(bug.wanderAngle) * 0.05;
            }
            break;
          }
          case 'REPRODUCE': {
            const dx = nestPos.x - bug.pos.x;
            const dy = nestPos.y - bug.pos.y;
            const d = Math.sqrt(dx * dx + dy * dy);
            if (d > 50) {
              const [nx, ny] = normalize(dx, dy);
              bug.vel.vx += nx * 0.22;
              bug.vel.vy += ny * 0.22;
            } else {
              bug.wanderAngle += rand(-0.2, 0.2);
              bug.vel.vx += Math.cos(bug.wanderAngle) * 0.05;
              bug.vel.vy += Math.sin(bug.wanderAngle) * 0.05;
            }
            break;
          }
          case 'RETREAT': {
            if (bug.hp < bug.maxHp * 0.5 || bug.carrying > 0) {
              const dx = nestPos.x - bug.pos.x;
              const dy = nestPos.y - bug.pos.y;
              const [nx, ny] = normalize(dx, dy);
              const speedRet = 1.3;
              bug.vel.vx += nx * 0.22 * speedRet;
              bug.vel.vy += ny * 0.22 * speedRet;
            } else {
              bug.wanderAngle += rand(-0.1, 0.1);
              bug.vel.vx += Math.cos(bug.wanderAngle) * 0.08;
              bug.vel.vy += Math.sin(bug.wanderAngle) * 0.08;
            }
            break;
          }
        }
    }

    let cohX = 0, cohY = 0, aliX = 0, aliY = 0, sepX = 0, sepY = 0, nc = 0, na = 0, ns = 0;
    let crossCohX = 0, crossCohY = 0, crossAliX = 0, crossAliY = 0, cnc = 0, cna = 0;
    const sameSquad = bug.squadId;
    for (const other of newBugs) {
      if (other.id === bug.id) continue;
      const d = dist(bug.pos, other.pos);
      const isSameSquad = other.squadId === sameSquad;
      const cohRange = isSameSquad ? 150 : 80;
      const aliRange = isSameSquad ? 80 : 40;
      const sepRange = isSameSquad ? 22 : 28;
      if (d < cohRange) {
        if (isSameSquad) {
          cohX += other.pos.x * 1.6;
          cohY += other.pos.y * 1.6;
          nc += 1.6;
        } else {
          crossCohX += other.pos.x * 0.4;
          crossCohY += other.pos.y * 0.4;
          cnc += 0.4;
        }
        if (d < aliRange) {
          if (isSameSquad) {
            aliX += other.vel.vx * 1.8;
            aliY += other.vel.vy * 1.8;
            na += 1.8;
          } else {
            crossAliX += other.vel.vx * 0.3;
            crossAliY += other.vel.vy * 0.3;
            cna += 0.3;
          }
        }
        if (d < sepRange && d > 0.1) {
          const f = (sepRange - d) / sepRange;
          const mul = isSameSquad ? 0.8 : 1.4;
          sepX += ((bug.pos.x - other.pos.x) / d) * f * mul;
          sepY += ((bug.pos.y - other.pos.y) / d) * f * mul;
          ns++;
        }
      }
    }
    const totalNc = nc + cnc;
    if (totalNc > 0) {
      const avgCohX = (cohX + crossCohX) / totalNc - bug.pos.x;
      const avgCohY = (cohY + crossCohY) / totalNc - bug.pos.y;
      const [cx, cy] = normalize(avgCohX, avgCohY);
      const cohMul = nc > 0 ? 0.05 : 0.02;
      bug.vel.vx += cx * cohMul;
      bug.vel.vy += cy * cohMul;
    }
    const totalNa = na + cna;
    if (totalNa > 0) {
      const [ax, ay] = normalize((aliX + crossAliX) / totalNa, (aliY + crossAliY) / totalNa);
      const aliMul = na > 0 ? 0.06 : 0.02;
      bug.vel.vx += ax * aliMul;
      bug.vel.vy += ay * aliMul;
    }
    if (ns > 0) {
      bug.vel.vx += sepX * 0.5;
      bug.vel.vy += sepY * 0.5;
    }

    const vmax = speed;
    const vs = Math.sqrt(bug.vel.vx * bug.vel.vx + bug.vel.vy * bug.vel.vy);
    if (vs > vmax) {
      bug.vel.vx = (bug.vel.vx / vs) * vmax;
      bug.vel.vy = (bug.vel.vy / vs) * vmax;
    }
    bug.vel.vx *= 0.9;
    bug.vel.vy *= 0.9;
    bug.pos.x += bug.vel.vx;
    bug.pos.y += bug.vel.vy;
    bug.pos.x = clamp(bug.pos.x, 5, GRID_W * CELL - 5);
    bug.pos.y = clamp(bug.pos.y, 5, GRID_H * CELL - 5);

    if (dist(bug.pos, nestPos) < 25) {
      bug.hp = Math.min(bug.maxHp, bug.hp + 0.15);
    }

    const pheroBoost = 1 + getBugAbilityValue(bug, mutationsMap, 'pheromone_strength');
    const depositMul = bug.role === 'scout' ? 1.4 : bug.role === 'soldier' ? 1.1 : 1.0;
    depositPheromone(newPheromoneMap, bug.pos.x, bug.pos.y, newPheromoneMap.depositAmount * depositMul * pheroBoost);
  }

  for (const enemy of newEnemies) {
    if (enemy.hp <= 0) continue;
    let nearestBug: Bug | null = null;
    let nearestD = Infinity;
    const effectiveRange = enemy.range * weatherEffect.enemyVisionMul;
    for (const b of newBugs) {
      if (b.hp <= 0) continue;
      const d = dist(enemy.pos, b.pos);
      if (d < effectiveRange && d < nearestD) {
        nearestD = d;
        nearestBug = b;
      }
    }
    if (nearestBug) {
      const dx = nearestBug.pos.x - enemy.pos.x;
      const dy = nearestBug.pos.y - enemy.pos.y;
      const [nx, ny] = normalize(dx, dy);
      const espeed = (enemy.type === 'predator' ? 0.9 : 0.55) * weatherEffect.enemySpeedMul;
      enemy.vel.vx += nx * 0.15 * espeed;
      enemy.vel.vy += ny * 0.15 * espeed;
      if (nearestD < 18 && enemy.type === 'predator') {
        const damage = enemy.attackPower * 0.08 * weatherEffect.enemyAttackMul / dayNightEffect.bugDefenseMul;
        nearestBug.hp -= damage;
        addParticle(newParticles, pid, nearestBug.pos, '#fca5a5', 2, 1);
      }
    } else {
      enemy.vel.vx += rand(-0.03, 0.03) * weatherEffect.enemySpeedMul;
      enemy.vel.vy += rand(-0.03, 0.03) * weatherEffect.enemySpeedMul;
    }
    const vmax = 0.9 * weatherEffect.enemySpeedMul;
    const vs = Math.sqrt(enemy.vel.vx * enemy.vel.vx + enemy.vel.vy * enemy.vel.vy);
    if (vs > vmax) {
      enemy.vel.vx = (enemy.vel.vx / vs) * vmax;
      enemy.vel.vy = (enemy.vel.vy / vs) * vmax;
    }
    enemy.vel.vx *= 0.92;
    enemy.vel.vy *= 0.92;
    enemy.pos.x += enemy.vel.vx;
    enemy.pos.y += enemy.vel.vy;
    enemy.pos.x = clamp(enemy.pos.x, 10, GRID_W * CELL - 10);
    enemy.pos.y = clamp(enemy.pos.y, 10, GRID_H * CELL - 10);
  }

  const processedBugs: Bug[] = [];
  for (let bi = 0; bi < newBugs.length; bi++) {
    let b = newBugs[bi];
    if (b.hp <= 0) {
      const hasNoDrop = getBugAbilityValue(b, mutationsMap, 'no_drop') > 0;
      if (!hasNoDrop && b.carrying > 0) {
        // 可以实现资源掉落在地上，这里简化为直接损失
      }
      ctxWrap.onBugDied?.(b);
      addParticle(newParticles, pid, b.pos, '#34d399', 3, 8);
      continue;
    }

    const expEntries = bugExpDeltas.get(b.id);
    if (expEntries) {
      let totalExp = 0;
      for (const e of expEntries) {
        totalExp += e.amount;
        ctxWrap.onBugExp?.(b.id, e.amount, e.source);
      }
      const expResult = addExpToBug(b, totalExp);
      b = expResult.bug;
      if (expResult.leveledUp) {
        ctxWrap.onBugLevelUp?.(b.id, b.level);
        addParticle(newParticles, pid, b.pos, '#fde047', 4, 12);
      }
    }

    if (b.mutationReady) {
      const existingMutationIds = b.mutations;
      const existingMutationTypes: MutationType[] = [];
      for (const mid of existingMutationIds) {
        const m = mutationsMap.get(mid);
        if (m) existingMutationTypes.push(m.type);
      }
      if (Math.random() < 0.7) {
        const mutation = selectRandomMutation(existingMutationTypes);
        b = applyMutationStats(b, mutation);
        b.mutationReady = false;
        pendingMutations.push({ bugId: b.id, mutation, tick: state.tick });
        ctxWrap.onBugMutation?.(b.id, mutation);
        addParticle(newParticles, pid, b.pos, mutation.color, 5, 15);
      } else {
        b.mutationReady = false;
      }
    }

    processedBugs.push(b);
  }
  const survivedBugs = processedBugs;

  const survivedEnemies = newEnemies.filter(e => e.hp > 0);
  const aliveResources = newResources.filter(r => r.amount > 0);

  for (const p of newParticles) {
    p.pos.x += p.vel.vx;
    p.pos.y += p.vel.vy;
    p.vel.vx *= 0.95;
    p.vel.vy *= 0.95;
    p.life--;
  }
  const aliveParticles = newParticles.filter(p => p.life > 0);

  decayPheromones(newPheromoneMap, weatherEffect.pheromoneDecayMul);

  const newEvolution = { ...evolution };
  newEvolution.totalExp += deltaExpTotal.v;
  const newEvoLevel = calcSwarmEvolutionLevel(newEvolution.totalExp);
  if (newEvoLevel > evolution.evolutionLevel) {
    newEvolution.evolutionLevel = newEvoLevel;
    newEvolution.evolutionPoints += (newEvoLevel - evolution.evolutionLevel) * 3;
    ctxWrap.onSwarmEvolution?.(newEvoLevel, newEvolution.totalExp);
    addParticle(newParticles, pid, nestPos, '#a855f7', 6, 20);
  }
  for (const pm of pendingMutations) {
    if (pm.tick === state.tick) {
      newEvolution.totalMutations++;
      if (pm.mutation.rarity === 'legendary') newEvolution.legendaryMutations++;
      if (!newEvolution.unlockedMutations.includes(pm.mutation.id)) {
        newEvolution.unlockedMutations.push(pm.mutation.id);
      }
      newEvolution.mutationHistory.push({
        tick: pm.tick,
        bugId: pm.bugId,
        mutation: pm.mutation,
      });
    }
  }
  const activePendingMutations = pendingMutations.filter(pm => state.tick - pm.tick < 600);

  return {
    ...state,
    bugs: survivedBugs,
    enemies: survivedEnemies,
    resources: aliveResources,
    particles: aliveParticles,
    pheromoneMap: newPheromoneMap,
    tick: state.tick + 1,
    gameTime: state.gameTime + state.speed,
    totalFood: state.totalFood + deltaFood.v,
    totalCrystal: state.totalCrystal + deltaCrystal.v,
    totalFoodGained: state.totalFoodGained + deltaFood.v,
    totalCrystalGained: state.totalCrystalGained + deltaCrystal.v,
    enemiesKilled: state.enemiesKilled + deltaKills.v,
    resourcesCollected: state.resourcesCollected + deltaCollected.v,
    evolution: newEvolution,
    pendingMutations: activePendingMutations,
    timeCycle: newTimeCycle,
  };
}

export function tryReproduce(
  state: GameState,
  cost: number,
  addBug: (bug: Bug) => void,
  onBugBorn?: (bug: Bug) => void
): GameState {
  if (state.totalFood >= cost) {
    const roleRoll = Math.random();
    const role: Bug['role'] = roleRoll > 0.7 ? 'soldier' : roleRoll > 0.5 ? 'scout' : 'worker';
    const id = (state.bugs[state.bugs.length - 1]?.id ?? 0) + 1;
    const bug = createBug(id, state.nestPos, role);
    addBug(bug);
    onBugBorn?.(bug);
    return { ...state, totalFood: state.totalFood - cost };
  }
  return state;
}

export const DEFAULT_SQUAD_COLORS = [
  '#34d399',
  '#f472b6',
  '#fbbf24',
  '#22d3ee',
  '#a78bfa',
  '#fb923c',
  '#4ade80',
  '#f87171',
];

export function createDefaultSquads(): Squad[] {
  const now = Date.now();
  return [
    {
      id: 'squad-default',
      name: '主群',
      color: DEFAULT_SQUAD_COLORS[0],
      instructions: [],
      instructionTimer: 0,
      executionStack: [],
      createdAt: now,
    },
    {
      id: 'squad-alpha',
      name: 'A 队 · 采集',
      color: DEFAULT_SQUAD_COLORS[2],
      instructions: [],
      instructionTimer: 0,
      executionStack: [],
      createdAt: now + 1,
    },
    {
      id: 'squad-beta',
      name: 'B 队 · 作战',
      color: DEFAULT_SQUAD_COLORS[1],
      instructions: [],
      instructionTimer: 0,
      executionStack: [],
      createdAt: now + 2,
    },
  ];
}

export function createInitialState(level: number): GameState {
  const terrain = createTerrain(level);
  const nestPos: Position = {
    x: Math.floor(GRID_W * 0.2) * CELL + CELL,
    y: Math.floor(GRID_H * 0.5) * CELL + CELL,
  };
  const resources = createResources(level, terrain);
  const enemies = createEnemies(level, terrain);
  const squads = createDefaultSquads();

  const levels = [
    { obj: '采集 100 食物', target: 100, type: 'food' as const },
    { obj: '消灭 3 个敌人', target: 3, type: 'kill' as const },
    { obj: '采集 50 水晶', target: 50, type: 'crystal' as const },
    { obj: '采集 200 食物', target: 200, type: 'food' as const },
    { obj: '消灭 8 个敌人', target: 8, type: 'kill' as const },
    { obj: '虫群扩张至 60 个体', target: 60, type: 'population' as const },
  ];
  const lv = levels[(level - 1) % levels.length];

  const initialFood = 30;
  let initialProgress = 0;
  if (lv.type === 'food') {
    initialProgress = initialFood;
  }

  return {
    bugs: [],
    enemies,
    resources,
    terrain,
    particles: [],
    nestPos,
    gridWidth: GRID_W,
    gridHeight: GRID_H,
    cellSize: CELL,
    tick: 0,
    paused: false,
    speed: 1,
    gameTime: 0,
    totalFood: initialFood,
    totalCrystal: 0,
    totalFoodGained: initialFood,
    totalCrystalGained: 0,
    enemiesKilled: 0,
    resourcesCollected: 0,
    instructionTimer: 0,
    level,
    levelObjective: lv.obj,
    levelTarget: lv.target,
    levelProgress: initialProgress,
    levelComplete: false,
    pheromoneMap: createPheromoneMap(),
    squads,
    currentSquadId: 'squad-default',
    evolution: createSwarmEvolution(),
    pendingMutations: [],
    timeCycle: createInitialTimeCycle(),
  };
}

export const GRID_CONSTANTS = { GRID_W, GRID_H, CELL };

export function createInitialTimeCycle(): TimeCycleState {
  const initialWeather = selectRandomWeather();
  const initialTimeOfDay: TimeOfDay = 'day';
  return {
    dayProgress: 0.25,
    timeOfDay: initialTimeOfDay,
    currentWeather: initialWeather,
    weatherDuration: WEATHER_CHANGE_INTERVAL,
    weatherTimer: 0,
    dayCount: 1,
    dayNightEffect: { ...DAY_NIGHT_EFFECTS[initialTimeOfDay] },
    weatherEffect: { ...WEATHER_EFFECTS[initialWeather] },
  };
}

export function updateTimeCycle(timeCycle: TimeCycleState): TimeCycleState {
  const newCycle = { ...timeCycle };
  
  newCycle.dayProgress = (newCycle.dayProgress + 1 / TICKS_PER_DAY) % 1;
  
  if (newCycle.dayProgress < timeCycle.dayProgress) {
    newCycle.dayCount++;
  }
  
  const newTimeOfDay = getTimeOfDay(newCycle.dayProgress);
  if (newTimeOfDay !== newCycle.timeOfDay) {
    newCycle.timeOfDay = newTimeOfDay;
    newCycle.dayNightEffect = { ...DAY_NIGHT_EFFECTS[newTimeOfDay] };
  }
  
  newCycle.weatherTimer++;
  if (newCycle.weatherTimer >= newCycle.weatherDuration) {
    newCycle.weatherTimer = 0;
    newCycle.currentWeather = selectRandomWeather();
    newCycle.weatherDuration = WEATHER_CHANGE_INTERVAL + Math.floor(Math.random() * WEATHER_CHANGE_INTERVAL);
    newCycle.weatherEffect = { ...WEATHER_EFFECTS[newCycle.currentWeather] };
  }
  
  return newCycle;
}

export function updateLevelProgress(state: GameState): GameState {
  const levels = [
    { type: 'food' as const },
    { type: 'kill' as const },
    { type: 'crystal' as const },
    { type: 'food' as const },
    { type: 'kill' as const },
    { type: 'population' as const },
  ];
  const lv = levels[(state.level - 1) % levels.length];
  let progress = 0;
  switch (lv.type) {
    case 'food': progress = state.totalFoodGained; break;
    case 'crystal': progress = state.totalCrystalGained; break;
    case 'kill': progress = state.enemiesKilled; break;
    case 'population': progress = state.bugs.length; break;
  }
  const newProgress = Math.max(state.levelProgress, progress);
  const complete = state.levelComplete || newProgress >= state.levelTarget;
  return { ...state, levelProgress: newProgress, levelComplete: complete };
}

export function evaluateCondition(
  condition: ConditionType,
  conditionParam: number | undefined,
  state: GameState,
  squad: Squad
): boolean {
  const squadBugs = state.bugs.filter(b => b.squadId === squad.id);
  if (squadBugs.length === 0) return false;

  switch (condition) {
    case 'ENEMY_NEARBY': {
      const range = conditionParam ?? 100;
      for (const bug of squadBugs) {
        for (const enemy of state.enemies) {
          if (enemy.hp > 0 && dist(bug.pos, enemy.pos) < range) return true;
        }
      }
      return false;
    }
    case 'RESOURCE_NEARBY': {
      const range = conditionParam ?? 120;
      for (const bug of squadBugs) {
        for (const res of state.resources) {
          if (res.amount > 0 && dist(bug.pos, res.pos) < range) return true;
        }
      }
      return false;
    }
    case 'HP_LOW': {
      const threshold = (conditionParam ?? 30) / 100;
      const avgHp = squadBugs.reduce((sum, b) => sum + (b.hp / b.maxHp), 0) / squadBugs.length;
      return avgHp < threshold;
    }
    case 'HP_HIGH': {
      const threshold = (conditionParam ?? 80) / 100;
      const avgHp = squadBugs.reduce((sum, b) => sum + (b.hp / b.maxHp), 0) / squadBugs.length;
      return avgHp > threshold;
    }
    case 'CARRYING_FULL': {
      return squadBugs.some(b => b.carrying >= b.carryCapacity);
    }
    case 'FOOD_ABUNDANT': {
      return state.totalFood >= (conditionParam ?? 100);
    }
    case 'FOOD_LOW': {
      return state.totalFood <= (conditionParam ?? 30);
    }
    case 'DAYTIME': {
      return state.timeCycle.timeOfDay === 'day' || state.timeCycle.timeOfDay === 'dawn' || state.timeCycle.timeOfDay === 'dusk';
    }
    case 'NIGHTTIME': {
      return state.timeCycle.timeOfDay === 'night';
    }
    default:
      return false;
  }
}

interface InstructionLocation {
  list: Instruction[];
  index: number;
}

function findInstructionLocation(
  instructions: Instruction[],
  instructionId: string
): InstructionLocation | null {
  for (let i = 0; i < instructions.length; i++) {
    if (instructions[i].id === instructionId) {
      return { list: instructions, index: i };
    }
    if (instructions[i].children) {
      const found = findInstructionLocation(instructions[i].children!, instructionId);
      if (found) return found;
    }
    if (instructions[i].elseChildren) {
      const found = findInstructionLocation(instructions[i].elseChildren!, instructionId);
      if (found) return found;
    }
  }
  return null;
}

export function getCurrentLeafInstruction(
  squad: Squad
): Instruction | null {
  if (squad.instructions.length === 0) return null;

  let currentList = squad.instructions;
  for (const frame of squad.executionStack) {
    const loc = findInstructionLocation(currentList, frame.instructionId);
    if (!loc) return null;
    const inst = loc.list[loc.index];
    if (inst.type === 'LOOP') {
      currentList = inst.children ?? [];
    } else if (inst.type === 'IF') {
      currentList = inst.children ?? [];
    }
  }

  if (currentList.length === 0) return null;
  const first = currentList[0];
  if (first.type === 'IF' || first.type === 'LOOP') {
    return first;
  }
  return first;
}

function getFirstLeafFromList(list: Instruction[]): Instruction | null {
  if (list.length === 0) return null;
  const first = list[0];
  if (first.type === 'IF') {
    return getFirstLeafFromList(first.children ?? []);
  }
  if (first.type === 'LOOP') {
    return getFirstLeafFromList(first.children ?? []);
  }
  return first;
}

export function getActiveExecutableInstruction(
  squad: Squad,
  state: GameState
): Instruction | null {
  return resolveActiveInstruction(squad, state);
}

function resolveActiveInstruction(
  squad: Squad,
  state: GameState
): Instruction | null {
  if (squad.instructions.length === 0) return null;

  let currentList = squad.instructions;
  for (const frame of squad.executionStack) {
    const loc = findInstructionLocation(currentList, frame.instructionId);
    if (!loc) return null;
    const inst = loc.list[loc.index];
    if (inst.type === 'LOOP') {
      currentList = inst.children ?? [];
    } else if (inst.type === 'IF') {
      const condMet = evaluateCondition(inst.condition!, inst.conditionParam, state, squad);
      currentList = condMet ? (inst.children ?? []) : (inst.elseChildren ?? []);
    }
  }

  return getFirstLeafFromList(currentList);
}

export interface StepResult {
  instructionSwitched: boolean;
  nextType?: string;
  remainingCount?: number;
}

export function stepSquadInstructions(
  squad: Squad,
  state: GameState
): StepResult {
  const result: StepResult = { instructionSwitched: false };
  if (squad.instructions.length === 0) return result;

  if (squad.instructionTimer > 0) {
    squad.instructionTimer--;
    if (squad.instructionTimer > 0) return result;
  }

  let currentList = squad.instructions;
  let parentLists: Instruction[][] = [];
  let currentInstructionId: string | null = null;

  for (const frame of squad.executionStack) {
    const loc = findInstructionLocation(currentList, frame.instructionId);
    if (!loc) {
      squad.executionStack = [];
      return stepSquadInstructions(squad, state);
    }
    parentLists.push(currentList);
    const inst = loc.list[loc.index];
    currentInstructionId = inst.id;
    if (inst.type === 'LOOP') {
      currentList = inst.children ?? [];
    } else if (inst.type === 'IF') {
      const condMet = evaluateCondition(inst.condition!, inst.conditionParam, state, squad);
      currentList = condMet ? (inst.children ?? []) : (inst.elseChildren ?? []);
    }
  }

  if (currentList.length > 0) {
    const first = currentList[0];

    if (first.type === 'IF') {
      squad.executionStack.push({ instructionId: first.id, loopCounter: 0 });
      return stepSquadInstructions(squad, state);
    }

    if (first.type === 'LOOP') {
      const maxLoops = first.param ?? 0;
      const existingFrame = squad.executionStack.find(f => f.instructionId === first.id);
      if (!existingFrame) {
        squad.executionStack.push({ instructionId: first.id, loopCounter: 0 });
      }
      const frame = squad.executionStack.find(f => f.instructionId === first.id)!;
      if (maxLoops > 0 && frame.loopCounter >= maxLoops) {
        currentList.shift();
        squad.executionStack = squad.executionStack.filter(f => f.instructionId !== first.id);
        result.instructionSwitched = true;
        const nextLeaf = resolveActiveInstruction(squad, state);
        result.nextType = nextLeaf?.type;
        result.remainingCount = countInstructions(squad.instructions);
        return stepSquadInstructions(squad, state);
      }
      frame.loopCounter++;
      return stepSquadInstructions(squad, state);
    }

    if (squad.instructionTimer <= 0) {
      if (first.duration > 0) {
        squad.instructionTimer = first.duration;
      }
      if (currentList.length > 1 || squad.executionStack.length > 0) {
        currentList.shift();
        if (squad.instructionTimer <= 0) {
          result.instructionSwitched = true;
          return stepSquadInstructions(squad, state);
        }
        result.instructionSwitched = true;
        const nextLeaf = resolveActiveInstruction(squad, state);
        result.nextType = nextLeaf?.type;
        result.remainingCount = countInstructions(squad.instructions);
        return result;
      } else {
        currentList.shift();
        while (squad.executionStack.length > 0) {
          const topFrame = squad.executionStack[squad.executionStack.length - 1];
          const parentList = parentLists[parentLists.length - 1];
          const topLoc = findInstructionLocation(parentList, topFrame.instructionId);
          if (!topLoc) break;
          const topInst = topLoc.list[topLoc.index];

          if (topInst.type === 'LOOP') {
            const maxLoops = topInst.param ?? 0;
            if (maxLoops === 0 || topFrame.loopCounter < maxLoops) {
              topFrame.loopCounter++;
              const nextLeaf = resolveActiveInstruction(squad, state);
              result.nextType = nextLeaf?.type;
              result.remainingCount = countInstructions(squad.instructions);
              result.instructionSwitched = true;
              return stepSquadInstructions(squad, state);
            }
          }

          squad.executionStack.pop();
          parentLists.pop();

          const parentParentList = parentLists.length > 0 ? parentLists[parentLists.length - 1] : squad.instructions;
          const parentLoc = findInstructionLocation(parentParentList, topInst.id);
          if (parentLoc) {
            parentLoc.list.splice(parentLoc.index, 1);
            if (parentLoc.list.length > 0) {
              result.instructionSwitched = true;
              const nextLeaf = resolveActiveInstruction(squad, state);
              result.nextType = nextLeaf?.type;
              result.remainingCount = countInstructions(squad.instructions);
              return stepSquadInstructions(squad, state);
            }
          }
        }
      }
    }
  } else {
    while (squad.executionStack.length > 0) {
      const topFrame = squad.executionStack[squad.executionStack.length - 1];
      const parentList = parentLists[parentLists.length - 1];
      const topLoc = findInstructionLocation(parentList, topFrame.instructionId);
      if (!topLoc) break;
      const topInst = topLoc.list[topLoc.index];

      if (topInst.type === 'LOOP') {
        const maxLoops = topInst.param ?? 0;
        if (maxLoops === 0 || topFrame.loopCounter < maxLoops) {
          topFrame.loopCounter++;
          result.instructionSwitched = true;
          const nextLeaf = resolveActiveInstruction(squad, state);
          result.nextType = nextLeaf?.type;
          result.remainingCount = countInstructions(squad.instructions);
          return stepSquadInstructions(squad, state);
        }
      }

      squad.executionStack.pop();
      parentLists.pop();

      const parentParentList = parentLists.length > 0 ? parentLists[parentLists.length - 1] : squad.instructions;
      const parentLoc = findInstructionLocation(parentParentList, topInst.id);
      if (parentLoc) {
        parentLoc.list.splice(parentLoc.index, 1);
        if (parentLoc.list.length > 0) {
          result.instructionSwitched = true;
          const nextLeaf = resolveActiveInstruction(squad, state);
          result.nextType = nextLeaf?.type;
          result.remainingCount = countInstructions(squad.instructions);
          return stepSquadInstructions(squad, state);
        }
      }
    }
  }

  return result;
}

function countInstructions(instructions: Instruction[]): number {
  let count = 0;
  for (const inst of instructions) {
    count++;
    if (inst.children) count += countInstructions(inst.children);
    if (inst.elseChildren) count += countInstructions(inst.elseChildren);
  }
  return count;
}

export function createSquadInstructionId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${Math.random().toString(36).slice(2, 6)}`;
}

export function evaluateConditionForBug(
  condition: ConditionType,
  conditionParam: number | undefined,
  state: GameState,
  squad: Squad,
  bug: Bug
): boolean {
  switch (condition) {
    case 'ENEMY_NEARBY': {
      const range = conditionParam ?? 100;
      for (const enemy of state.enemies) {
        if (enemy.hp > 0 && dist(bug.pos, enemy.pos) < range) return true;
      }
      return false;
    }
    case 'RESOURCE_NEARBY': {
      const range = conditionParam ?? 120;
      for (const res of state.resources) {
        if (res.amount > 0 && dist(bug.pos, res.pos) < range) return true;
      }
      return false;
    }
    case 'HP_LOW': {
      const threshold = (conditionParam ?? 30) / 100;
      return (bug.hp / bug.maxHp) < threshold;
    }
    case 'HP_HIGH': {
      const threshold = (conditionParam ?? 80) / 100;
      return (bug.hp / bug.maxHp) > threshold;
    }
    case 'CARRYING_FULL': {
      return bug.carrying >= bug.carryCapacity;
    }
    case 'FOOD_ABUNDANT': {
      return state.totalFood >= (conditionParam ?? 100);
    }
    case 'FOOD_LOW': {
      return state.totalFood <= (conditionParam ?? 30);
    }
    case 'DAYTIME': {
      return state.timeCycle.timeOfDay === 'day' || state.timeCycle.timeOfDay === 'dawn' || state.timeCycle.timeOfDay === 'dusk';
    }
    case 'NIGHTTIME': {
      return state.timeCycle.timeOfDay === 'night';
    }
    default:
      return false;
  }
}

function resolveActiveInstructionForBug(
  squad: Squad,
  state: GameState,
  bug: Bug
): Instruction | null {
  if (squad.instructions.length === 0) return null;

  let currentList = squad.instructions;
  for (const frame of squad.executionStack) {
    const loc = findInstructionLocation(currentList, frame.instructionId);
    if (!loc) return null;
    const inst = loc.list[loc.index];
    if (inst.type === 'LOOP') {
      currentList = inst.children ?? [];
    } else if (inst.type === 'IF') {
      const condMet = evaluateConditionForBug(inst.condition!, inst.conditionParam, state, squad, bug);
      currentList = condMet ? (inst.children ?? []) : (inst.elseChildren ?? []);
    }
  }

  return getFirstLeafFromList(currentList);
}
