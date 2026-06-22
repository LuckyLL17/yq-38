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
} from './types';

const GRID_W = 60;
const GRID_H = 40;
const CELL = 16;

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
  role: Bug['role'] = 'worker'
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
    instructionPointer: 0,
    cooldown: 0,
    wanderAngle: angle,
    age: 0,
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

export interface SimulationContext {
  instructions: Instruction[];
  onFoodGained?: (n: number, pos: Position) => void;
  onCrystalGained?: (n: number, pos: Position) => void;
  onEnemyKilled?: (enemy: Enemy) => void;
  onResourceCollected?: (resourceId: number, amount: number, type: 'food' | 'crystal', pos: Position) => void;
  onBugDied?: (bug: Bug) => void;
  onBugBorn?: (bug: Bug) => void;
}

export function simulateStep(
  state: GameState,
  ctx: SimulationContext
): GameState {
  if (state.paused) return state;

  const { terrain, nestPos } = state;
  const newParticles = [...state.particles];
  const pid = { v: (state.particles[state.particles.length - 1]?.id ?? 0) + 1 };

  const deltaFood = { v: 0 };
  const deltaCrystal = { v: 0 };
  const deltaKills = { v: 0 };
  const deltaCollected = { v: 0 };
  const ctxWrap: SimulationContext = {
    instructions: ctx.instructions,
    onFoodGained: (n, pos) => { deltaFood.v += n; ctx.onFoodGained?.(n, pos); },
    onCrystalGained: (n, pos) => { deltaCrystal.v += n; ctx.onCrystalGained?.(n, pos); },
    onEnemyKilled: (enemy) => { deltaKills.v += 1; ctx.onEnemyKilled?.(enemy); },
    onResourceCollected: (rid, amt, type, pos) => { deltaCollected.v += 1; ctx.onResourceCollected?.(rid, amt, type, pos); },
    onBugDied: (bug) => { ctx.onBugDied?.(bug); },
    onBugBorn: ctx.onBugBorn,
  };

  const newBugs = state.bugs.map(b => ({ ...b, vel: { ...b.vel }, pos: { ...b.pos } }));
  const newEnemies = state.enemies.map(e => ({ ...e, vel: { ...e.vel }, pos: { ...e.pos } }));
  const newResources = state.resources.map(r => ({ ...r, pos: { ...r.pos } }));

  const instructions = ctxWrap.instructions;

  for (const bug of newBugs) {
    bug.age++;
    bug.cooldown = Math.max(0, bug.cooldown - 1);
    const terrainAt = getTerrainAt(terrain, bug.pos.x, bug.pos.y);
    const speedMul = terrainSpeedMul(terrainAt);
    const baseSpeed = bug.role === 'scout' ? 1.4 : bug.role === 'soldier' ? 0.85 : 1.05;
    const speed = 1.2 * baseSpeed * speedMul;

    const cur = instructions[0];

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
            let nearestRes: ResourceNode | null = null;
            let nearestD = Infinity;
            for (const r of newResources) {
              if (r.amount <= 0) continue;
              const d = dist(bug.pos, r.pos);
              if (d < nearestD) {
                nearestD = d;
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
                    ctxWrap.onCrystalGained?.(bug.carrying, { ...bug.pos });
                    addParticle(newParticles, pid, bug.pos, '#a78bfa', 3, 5);
                  } else {
                    ctxWrap.onFoodGained?.(bug.carrying, { ...bug.pos });
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
                ctxWrap.onResourceCollected?.(nearestRes.id, take, nearestRes.type, { ...nearestRes.pos });
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
            let nearestEnemy: Enemy | null = null;
            let nearestD = Infinity;
            for (const e of newEnemies) {
              if (e.hp <= 0) continue;
              const d = dist(bug.pos, e.pos);
              if (d < nearestD && d < atkRange * 2.5) {
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
              if (nearestD < atkRange && bug.cooldown <= 0) {
                const atkMul = terrainAttackMul(terrainAt);
                const dmg = bug.attackPower * atkMul * (bug.role === 'soldier' ? 1.3 : 1);
                nearestEnemy.hp -= dmg;
                bug.cooldown = 18;
                addParticle(newParticles, pid, nearestEnemy.pos, '#f87171', 3, 3);
                if (nearestEnemy.hp <= 0) {
                  ctxWrap.onEnemyKilled?.(nearestEnemy);
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
    for (const other of newBugs) {
      if (other.id === bug.id) continue;
      const d = dist(bug.pos, other.pos);
      if (d < 120) {
        cohX += other.pos.x;
        cohY += other.pos.y;
        nc++;
        if (d < 60) {
          aliX += other.vel.vx;
          aliY += other.vel.vy;
          na++;
        }
        if (d < 22 && d > 0.1) {
          const f = (22 - d) / 22;
          sepX += ((bug.pos.x - other.pos.x) / d) * f;
          sepY += ((bug.pos.y - other.pos.y) / d) * f;
          ns++;
        }
      }
    }
    if (nc > 0) {
      cohX = cohX / nc - bug.pos.x;
      cohY = cohY / nc - bug.pos.y;
      const [cx, cy] = normalize(cohX, cohY);
      bug.vel.vx += cx * 0.03;
      bug.vel.vy += cy * 0.03;
    }
    if (na > 0) {
      const [ax, ay] = normalize(aliX / na, aliY / na);
      bug.vel.vx += ax * 0.04;
      bug.vel.vy += ay * 0.04;
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
  }

  for (const enemy of newEnemies) {
    if (enemy.hp <= 0) continue;
    let nearestBug: Bug | null = null;
    let nearestD = Infinity;
    for (const b of newBugs) {
      if (b.hp <= 0) continue;
      const d = dist(enemy.pos, b.pos);
      if (d < enemy.range && d < nearestD) {
        nearestD = d;
        nearestBug = b;
      }
    }
    if (nearestBug) {
      const dx = nearestBug.pos.x - enemy.pos.x;
      const dy = nearestBug.pos.y - enemy.pos.y;
      const [nx, ny] = normalize(dx, dy);
      const espeed = enemy.type === 'predator' ? 0.9 : 0.55;
      enemy.vel.vx += nx * 0.15 * espeed;
      enemy.vel.vy += ny * 0.15 * espeed;
      if (nearestD < 18 && enemy.type === 'predator') {
        nearestBug.hp -= enemy.attackPower * 0.08;
        addParticle(newParticles, pid, nearestBug.pos, '#fca5a5', 2, 1);
      }
    } else {
      enemy.vel.vx += rand(-0.03, 0.03);
      enemy.vel.vy += rand(-0.03, 0.03);
    }
    const vmax = 0.9;
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

  const survivedBugs = newBugs.filter(b => {
    if (b.hp <= 0) {
      ctxWrap.onBugDied?.(b);
      addParticle(newParticles, pid, b.pos, '#34d399', 3, 8);
      return false;
    }
    return true;
  });

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

  return {
    ...state,
    bugs: survivedBugs,
    enemies: survivedEnemies,
    resources: aliveResources,
    particles: aliveParticles,
    tick: state.tick + 1,
    gameTime: state.gameTime + state.speed,
    totalFood: state.totalFood + deltaFood.v,
    totalCrystal: state.totalCrystal + deltaCrystal.v,
    totalFoodGained: state.totalFoodGained + deltaFood.v,
    totalCrystalGained: state.totalCrystalGained + deltaCrystal.v,
    enemiesKilled: state.enemiesKilled + deltaKills.v,
    resourcesCollected: state.resourcesCollected + deltaCollected.v,
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

export function createInitialState(level: number): GameState {
  const terrain = createTerrain(level);
  const nestPos: Position = {
    x: Math.floor(GRID_W * 0.2) * CELL + CELL,
    y: Math.floor(GRID_H * 0.5) * CELL + CELL,
  };
  const resources = createResources(level, terrain);
  const enemies = createEnemies(level, terrain);

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
  };
}

export const GRID_CONSTANTS = { GRID_W, GRID_H, CELL };

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
