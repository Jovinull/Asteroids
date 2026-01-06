// src/meta.ts
export type SkillSize = "minor" | "major" | "keystone";

export type Skill = {
  id: string;
  name: string;
  desc: string;
  icon: string;
  cost: number;
  type: "Core" | "Weapons" | "Mobility" | "Defense" | "Salvage" | "Contract";
  req?: string[];
  x: number;
  y: number;
  size?: SkillSize;
};

export type Meta = {
  v: number;
  cores: number;
  unlocked: Record<string, true>;
};

export type MetaMods = {
  thrustMul: number;
  frictionMul: number;
  maxSpeedMul: number;

  laserSpeedMul: number;
  laserMaxAdd: number;
  shootCdMul: number;

  powerDurMul: number;
  invulnMul: number;

  dropChanceMul: number;
  startShield: number;

  roidSpeedMul: number;
  ufoRateMul: number;
  extraRoidPerWave: number;

  coresYieldAdd: number; // 0.10 => +10%
};

const META_KEY = "asteroids_meta_v3";

// seus saves antigos reais
const LEGACY_KEYS = [
  "asteroids_meta_v1",
  "asteroids_meta_v2",
  "asteroids_meta",
] as const;

function clamp(n: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, n));
}

function hasLocalStorage(): boolean {
  try {
    return (
      typeof globalThis !== "undefined" &&
      typeof globalThis.localStorage !== "undefined"
    );
  } catch {
    return false;
  }
}

function safeGetItem(key: string): string | null {
  if (!hasLocalStorage()) return null;
  try {
    return globalThis.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetItem(key: string, value: string): void {
  if (!hasLocalStorage()) return;
  try {
    globalThis.localStorage.setItem(key, value);
  } catch {
    // ignore
  }
}

function safeRemoveItem(key: string): void {
  if (!hasLocalStorage()) return;
  try {
    globalThis.localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

function safeParse(json: string | null): unknown {
  if (!json) return null;
  try {
    return JSON.parse(json) as unknown;
  } catch {
    return null;
  }
}

function normalizeUnlocked(input: unknown): Record<string, true> {
  const out: Record<string, true> = {};

  if (input && typeof input === "object") {
    const obj = input as Record<string, unknown>;
    for (const k of Object.keys(obj)) {
      if (obj[k] === true) out[k] = true;
    }
  }

  // core sempre conhecido
  out.core = true;
  return out;
}

/**
 * Migração v1 -> v3 (mapeia IDs antigos para os ramos novos)
 * Se algum ID antigo não existir no mapa, ele é ignorado (não quebra o save).
 */
const V1_TO_V3: Record<string, string> = {
  core: "core",

  // Engenharia -> Mobility
  thrusters1: "mob_thr_01",
  thrusters2: "mob_thr_02",
  stabilizers: "mob_fric_01",
  overdrive: "mob_spd_01",

  // Armas -> Weapons / Salvage
  capacitors: "wep_spd_01",
  cooling: "wep_cd_01",
  magazine: "wep_max_01",
  powerMastery: "salv_dur_01",

  // Sobrevivência -> Defense / Salvage
  shieldStart: "def_shield_01",
  blinkMatrix: "def_inv_01",
  salvage: "salv_drop_01",

  // Contratos -> Contract
  contract1: "ctr_roid_01",
  contract2: "ctr_ufo_01",
  contract3: "ctr_extra_01",
};

function migrateLegacyUnlocked(unlocked: unknown): Record<string, true> {
  const out: Record<string, true> = {};

  if (unlocked && typeof unlocked === "object") {
    const u = unlocked as Record<string, unknown>;
    for (const oldId of Object.keys(u)) {
      if (u[oldId] !== true) continue;

      const mapped = V1_TO_V3[oldId];
      if (mapped) out[mapped] = true;
    }
  }

  out.core = true;
  return out;
}

export function loadMeta(): Meta {
  // default seguro
  const fallback: Meta = { v: 3, cores: 0, unlocked: { core: true } };

  const raw = safeParse(safeGetItem(META_KEY));
  if (raw && typeof raw === "object") {
    const pick = raw as Partial<Meta>;
    const unlocked = normalizeUnlocked(pick.unlocked);
    const cores = typeof pick.cores === "number" ? pick.cores : 0;
    return { v: 3, cores, unlocked };
  }

  // tenta legacy (v1/v2/antigo)
  let legacyPick: unknown = null;
  let legacyKeyUsed: string | null = null;

  for (const k of LEGACY_KEYS) {
    const parsed = safeParse(safeGetItem(k));
    if (parsed && typeof parsed === "object") {
      legacyPick = parsed;
      legacyKeyUsed = k;
      break;
    }
  }

  if (!legacyPick) return fallback;

  const legacy = legacyPick as { cores?: unknown; unlocked?: unknown };
  const cores = typeof legacy.cores === "number" ? legacy.cores : 0;

  // se veio do v1, tenta mapear refletindo sua árvore antiga
  // se veio de outro legacy, o formato pode ser similar; mapear ainda é ok (só ignora IDs fora do mapa)
  const unlocked = migrateLegacyUnlocked(legacy.unlocked);

  const migrated: Meta = { v: 3, cores, unlocked };

  // salva já no formato novo e limpa legacy pra não re-migrar sempre
  saveMeta(migrated);
  if (legacyKeyUsed) {
    for (const k of LEGACY_KEYS) safeRemoveItem(k);
  }

  return migrated;
}

export function saveMeta(meta: Meta): void {
  safeSetItem(META_KEY, JSON.stringify(meta));
}

export function hasSkill(meta: Meta, id: string): boolean {
  return Boolean(meta.unlocked[id]);
}

/**
 * SKILL TREE GIGANTE
 * Coord system: stage ~ 3000 x 2000 (só pra layout)
 */
const C = { x: 1500, y: 1000 };

function S(s: Skill): Skill {
  return s;
}

// Helpers de layout
function ring(
  count: number,
  radius: number,
  startAng = -Math.PI / 2
): Array<{ x: number; y: number }> {
  const pts: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < count; i++) {
    const a = startAng + (i * Math.PI * 2) / count;
    pts.push({ x: C.x + Math.cos(a) * radius, y: C.y + Math.sin(a) * radius });
  }
  return pts;
}

function chain(
  prefix: string,
  names: string[],
  icon: string,
  type: Skill["type"],
  start: { x: number; y: number },
  dir: { x: number; y: number },
  step: number,
  baseCost: number,
  req0: string
): Skill[] {
  const out: Skill[] = [];
  let prev = req0;

  for (let i = 0; i < names.length; i++) {
    const id = `${prefix}${String(i + 1).padStart(2, "0")}`;
    const x = start.x + dir.x * step * i;
    const y = start.y + dir.y * step * i;

    out.push(
      S({
        id,
        name: names[i],
        desc: `${names[i]} — melhora progressiva do ramo.`,
        icon,
        cost: baseCost + Math.floor(i / 2),
        type,
        req: [prev],
        x,
        y,
        size: i >= names.length - 2 ? "major" : "minor",
      })
    );

    prev = id;
  }

  return out;
}

const coreRing = ring(8, 230);

export const SKILLS: Skill[] = [
  S({
    id: "core",
    name: "Núcleo Primordial",
    desc: "O coração do seu piloto. Desbloqueia acesso aos ramos principais.",
    icon: "✦",
    cost: 0,
    type: "Core",
    x: C.x,
    y: C.y,
    size: "keystone",
  }),

  // Anel central (8 nós)
  S({
    id: "core_ring_01",
    name: "Acoplamento Arcano",
    desc: "Pequeno aumento geral. Serve como ponte para outros ramos.",
    icon: "⟡",
    cost: 1,
    type: "Core",
    req: ["core"],
    x: coreRing[0].x,
    y: coreRing[0].y,
    size: "minor",
  }),
  S({
    id: "core_ring_02",
    name: "Foco de Tiro",
    desc: "Pequeno aumento em LaserSpeed.",
    icon: "⟡",
    cost: 1,
    type: "Core",
    req: ["core"],
    x: coreRing[1].x,
    y: coreRing[1].y,
    size: "minor",
  }),
  S({
    id: "core_ring_03",
    name: "Giro Estelar",
    desc: "Pequeno aumento em mobilidade.",
    icon: "⟡",
    cost: 1,
    type: "Core",
    req: ["core"],
    x: coreRing[2].x,
    y: coreRing[2].y,
    size: "minor",
  }),
  S({
    id: "core_ring_04",
    name: "Câmara de Impulso",
    desc: "Pequeno aumento em Thrust.",
    icon: "⟡",
    cost: 1,
    type: "Core",
    req: ["core"],
    x: coreRing[3].x,
    y: coreRing[3].y,
    size: "minor",
  }),
  S({
    id: "core_ring_05",
    name: "Blindagem de Reserva",
    desc: "Pequeno aumento em Invuln.",
    icon: "⟡",
    cost: 1,
    type: "Core",
    req: ["core"],
    x: coreRing[4].x,
    y: coreRing[4].y,
    size: "minor",
  }),
  S({
    id: "core_ring_06",
    name: "Inércia Controlada",
    desc: "Pequeno ajuste de Friction.",
    icon: "⟡",
    cost: 1,
    type: "Core",
    req: ["core"],
    x: coreRing[5].x,
    y: coreRing[5].y,
    size: "minor",
  }),
  S({
    id: "core_ring_07",
    name: "Sonda de Sucata",
    desc: "Pequeno aumento em DropChance.",
    icon: "⟡",
    cost: 1,
    type: "Core",
    req: ["core"],
    x: coreRing[6].x,
    y: coreRing[6].y,
    size: "minor",
  }),
  S({
    id: "core_ring_08",
    name: "Cláusula Sombria",
    desc: "Abre o caminho dos Contratos (recompensa maior).",
    icon: "⟡",
    cost: 1,
    type: "Core",
    req: ["core"],
    x: coreRing[7].x,
    y: coreRing[7].y,
    size: "minor",
  }),

  // ROOTS (grandes)
  S({
    id: "wep_root",
    name: "Sistema de Armas",
    desc: "LaserSpeed, Cadência e mais lasers ativos.",
    icon: "⚔",
    cost: 2,
    type: "Weapons",
    req: ["core_ring_01", "core_ring_02"],
    x: 1500,
    y: 660,
    size: "major",
  }),
  S({
    id: "mob_root",
    name: "Propulsão",
    desc: "Thrust, Friction e MaxSpeed para domar o caos.",
    icon: "➤",
    cost: 2,
    type: "Mobility",
    req: ["core_ring_03", "core_ring_04"],
    x: 2130,
    y: 1000,
    size: "major",
  }),
  S({
    id: "def_root",
    name: "Estruturas Defensivas",
    desc: "Invulnerabilidade, escudo inicial e janela de segurança.",
    icon: "🛡",
    cost: 2,
    type: "Defense",
    req: ["core_ring_05", "core_ring_06"],
    x: 870,
    y: 1000,
    size: "major",
  }),
  S({
    id: "salv_root",
    name: "Recuperação & Sucata",
    desc: "DropChance e duração de powerups.",
    icon: "⛏",
    cost: 2,
    type: "Salvage",
    req: ["core_ring_07"],
    x: 1080,
    y: 740,
    size: "major",
  }),
  S({
    id: "ctr_root",
    name: "Contratos",
    desc: "Mais risco → mais Núcleos. Mude as regras da run.",
    icon: "⚑",
    cost: 2,
    type: "Contract",
    req: ["core_ring_08"],
    x: 1500,
    y: 1410,
    size: "major",
  }),

  // WEAPONS CHAINS
  ...chain(
    "wep_spd_",
    [
      "Lente Aquecida I",
      "Lente Aquecida II",
      "Lente Aquecida III",
      "Facho Estável",
      "Facho Rachado",
      "Facho Solar",
    ],
    "✶",
    "Weapons",
    { x: 1320, y: 520 },
    { x: 0, y: -1 },
    95,
    2,
    "wep_root"
  ),
  ...chain(
    "wep_cd_",
    [
      "Gatilho Curto I",
      "Gatilho Curto II",
      "Gatilho Curto III",
      "Mecanismo Fino",
      "Mecanismo Rápido",
      "Mecanismo Brutal",
    ],
    "⌁",
    "Weapons",
    { x: 1680, y: 520 },
    { x: 0, y: -1 },
    95,
    2,
    "wep_root"
  ),
  ...chain(
    "wep_max_",
    [
      "Condutor Extra",
      "Câmara Extra",
      "Carregador Extra",
      "Bateria Extra",
      "Superbanco",
    ],
    "≋",
    "Weapons",
    { x: 1500, y: 560 },
    { x: 0, y: -1 },
    90,
    3,
    "wep_root"
  ),

  // WEAPON KEYSTONES
  S({
    id: "wep_keystone_overclock",
    name: "Overclock do Reator",
    desc: "LaserSpeed enorme, mas exige investimento pesado no ramo de armas.",
    icon: "✹",
    cost: 8,
    type: "Weapons",
    req: ["wep_spd_06", "wep_cd_06", "wep_max_05"],
    x: 1500,
    y: 140,
    size: "keystone",
  }),
  S({
    id: "wep_keystone_precision",
    name: "Cirurgia de Precisão",
    desc: "Cadência melhor e LaserSpeed melhor (modo sniper no caos).",
    icon: "◎",
    cost: 7,
    type: "Weapons",
    req: ["wep_spd_05", "wep_cd_05"],
    x: 1200,
    y: 220,
    size: "keystone",
  }),

  // MOBILITY CHAINS
  ...chain(
    "mob_thr_",
    [
      "Thrusters I",
      "Thrusters II",
      "Thrusters III",
      "Afterburn I",
      "Afterburn II",
      "Afterburn III",
      "Afterburn IV",
    ],
    "➹",
    "Mobility",
    { x: 2320, y: 880 },
    { x: 1, y: 0 },
    120,
    2,
    "mob_root"
  ),
  ...chain(
    "mob_fric_",
    [
      "Atrito I",
      "Atrito II",
      "Atrito III",
      "Deriva I",
      "Deriva II",
      "Deriva III",
    ],
    "≈",
    "Mobility",
    { x: 2320, y: 1120 },
    { x: 1, y: 0 },
    120,
    2,
    "mob_root"
  ),
  ...chain(
    "mob_spd_",
    [
      "Velocidade I",
      "Velocidade II",
      "Velocidade III",
      "Turbo I",
      "Turbo II",
      "Turbo III",
    ],
    "➠",
    "Mobility",
    { x: 2260, y: 1000 },
    { x: 1, y: 0 },
    120,
    3,
    "mob_root"
  ),

  // MOBILITY KEYSTONES
  S({
    id: "mob_keystone_driftking",
    name: "Drift King",
    desc: "MaxSpeed forte e Friction otimizada: você vira uma lâmina no espaço.",
    icon: "⟠",
    cost: 8,
    type: "Mobility",
    req: ["mob_fric_06", "mob_spd_06"],
    x: 2890,
    y: 1000,
    size: "keystone",
  }),
  S({
    id: "mob_keystone_afterburner",
    name: "Afterburner Absoluto",
    desc: "Thrust forte e MaxSpeed forte: aceleração absurda.",
    icon: "➳",
    cost: 8,
    type: "Mobility",
    req: ["mob_thr_07", "mob_spd_05"],
    x: 2890,
    y: 820,
    size: "keystone",
  }),

  // DEFENSE CHAINS
  ...chain(
    "def_inv_",
    [
      "Invuln I",
      "Invuln II",
      "Invuln III",
      "Janela Segura",
      "Reflexo Frio",
      "Campo Calmo",
    ],
    "◈",
    "Defense",
    { x: 680, y: 880 },
    { x: -1, y: 0 },
    120,
    2,
    "def_root"
  ),
  ...chain(
    "def_shield_",
    [
      "Escudo Inicial",
      "Escudo Resiliente",
      "Escudo Preparado",
      "Escudo Estratégico",
      "Escudo Veterano",
    ],
    "⛨",
    "Defense",
    { x: 680, y: 1120 },
    { x: -1, y: 0 },
    120,
    3,
    "def_root"
  ),
  ...chain(
    "def_grace_",
    ["Graça I", "Graça II", "Graça III", "Graça IV"],
    "✚",
    "Defense",
    { x: 740, y: 1000 },
    { x: -1, y: 0 },
    120,
    3,
    "def_root"
  ),

  // DEFENSE KEYSTONES
  S({
    id: "def_keystone_phalanx",
    name: "Falange",
    desc: "Ganha Escudo Inicial e melhora Invuln (build consistente).",
    icon: "⛊",
    cost: 7,
    type: "Defense",
    req: ["def_inv_06", "def_shield_05"],
    x: 110,
    y: 1000,
    size: "keystone",
  }),
  S({
    id: "def_keystone_ironwill",
    name: "Vontade de Ferro",
    desc: "Invuln alta: reentradas mais seguras após morte/respawn.",
    icon: "⬣",
    cost: 7,
    type: "Defense",
    req: ["def_inv_05", "def_grace_04"],
    x: 110,
    y: 820,
    size: "keystone",
  }),

  // SALVAGE CHAINS
  ...chain(
    "salv_drop_",
    [
      "Sucata I",
      "Sucata II",
      "Sucata III",
      "Coleta I",
      "Coleta II",
      "Coleta III",
    ],
    "⟐",
    "Salvage",
    { x: 980, y: 600 },
    { x: -1, y: -1 },
    95,
    2,
    "salv_root"
  ),
  ...chain(
    "salv_dur_",
    [
      "Duração I",
      "Duração II",
      "Duração III",
      "Persistência I",
      "Persistência II",
      "Persistência III",
    ],
    "⧗",
    "Salvage",
    { x: 1180, y: 600 },
    { x: 1, y: -1 },
    95,
    2,
    "salv_root"
  ),

  // SALVAGE KEYSTONES
  S({
    id: "salv_keystone_scavenger",
    name: "Rei da Sucata",
    desc: "DropChance e PowerDur fortes. Builds de powerup ficam insanas.",
    icon: "⟰",
    cost: 7,
    type: "Salvage",
    req: ["salv_drop_06", "salv_dur_06"],
    x: 1080,
    y: 220,
    size: "keystone",
  }),
  S({
    id: "salv_keystone_magnet",
    name: "Ímã de Destino",
    desc: "DropChance forte. Menos runs “secas”.",
    icon: "⊕",
    cost: 6,
    type: "Salvage",
    req: ["salv_drop_05"],
    x: 820,
    y: 320,
    size: "keystone",
  }),

  // CONTRACT CHAINS
  ...chain(
    "ctr_roid_",
    [
      "Rochas I",
      "Rochas II",
      "Rochas III",
      "Rochas IV",
      "Rochas V",
      "Rochas VI",
    ],
    "☄",
    "Contract",
    { x: 1320, y: 1540 },
    { x: 0, y: 1 },
    95,
    2,
    "ctr_root"
  ),
  ...chain(
    "ctr_ufo_",
    ["UFO I", "UFO II", "UFO III", "UFO IV", "UFO V"],
    "⌬",
    "Contract",
    { x: 1680, y: 1540 },
    { x: 0, y: 1 },
    95,
    2,
    "ctr_root"
  ),
  ...chain(
    "ctr_extra_",
    ["Mais Rochas I", "Mais Rochas II", "Mais Rochas III", "Mais Rochas IV"],
    "✣",
    "Contract",
    { x: 1500, y: 1550 },
    { x: 0, y: 1 },
    95,
    3,
    "ctr_root"
  ),
  ...chain(
    "ctr_yield_",
    [
      "Bônus Núcleos I",
      "Bônus Núcleos II",
      "Bônus Núcleos III",
      "Bônus Núcleos IV",
    ],
    "⚚",
    "Contract",
    { x: 1500, y: 1700 },
    { x: 0, y: 1 },
    95,
    4,
    "ctr_extra_04"
  ),

  // CONTRACT KEYSTONES
  S({
    id: "ctr_keystone_hell",
    name: "Contrato: Inferno",
    desc: "Tudo fica mais agressivo. Mas Núcleos rendem muito mais.",
    icon: "⚠",
    cost: 9,
    type: "Contract",
    req: ["ctr_roid_06", "ctr_ufo_05", "ctr_yield_04"],
    x: 1500,
    y: 1930,
    size: "keystone",
  }),
  S({
    id: "ctr_keystone_greed",
    name: "Contrato: Ganância",
    desc: "Bônus de Núcleos por run (se você sobreviver).",
    icon: "✪",
    cost: 8,
    type: "Contract",
    req: ["ctr_yield_03"],
    x: 1200,
    y: 1880,
    size: "keystone",
  }),

  // Cross-links “pra virar WEB”
  S({
    id: "bridge_wep_salv",
    name: "Arsenal de Sucata",
    desc: "Conecta armas e sucata. Pequeno bônus híbrido.",
    icon: "⟢",
    cost: 4,
    type: "Core",
    req: ["wep_root", "salv_root"],
    x: 1280,
    y: 720,
    size: "major",
  }),
  S({
    id: "bridge_mob_wep",
    name: "Mira em Movimento",
    desc: "Conecta mobilidade e armas. Pequeno bônus híbrido.",
    icon: "⟣",
    cost: 4,
    type: "Core",
    req: ["mob_root", "wep_root"],
    x: 1840,
    y: 820,
    size: "major",
  }),
  S({
    id: "bridge_def_ctr",
    name: "Cláusula de Segurança",
    desc: "Conecta defesa e contratos. Pequeno bônus para sobreviver ao risco.",
    icon: "⟤",
    cost: 4,
    type: "Core",
    req: ["def_root", "ctr_root"],
    x: 1100,
    y: 1270,
    size: "major",
  }),
];

export function computeMetaMods(meta: Meta): MetaMods {
  const mods: MetaMods = {
    thrustMul: 1,
    frictionMul: 1,
    maxSpeedMul: 1,

    laserSpeedMul: 1,
    laserMaxAdd: 0,
    shootCdMul: 1,

    powerDurMul: 1,
    invulnMul: 1,

    dropChanceMul: 1,
    startShield: 0,

    roidSpeedMul: 1,
    ufoRateMul: 1,
    extraRoidPerWave: 0,

    coresYieldAdd: 0,
  };

  const unlockedIds = Object.keys(meta.unlocked);

  for (const id of unlockedIds) {
    // CORE RING (pequenos bônus gerais)
    if (id.startsWith("core_ring_")) {
      mods.thrustMul *= 1.01;
      mods.maxSpeedMul *= 1.01;
      mods.laserSpeedMul *= 1.01;
      mods.dropChanceMul *= 1.01;
      continue;
    }

    // WEAPONS
    if (id.startsWith("wep_spd_")) {
      mods.laserSpeedMul *= 1.035;
      continue;
    }
    if (id.startsWith("wep_cd_")) {
      mods.shootCdMul *= 0.965;
      continue;
    }
    if (id.startsWith("wep_max_")) {
      mods.laserMaxAdd += 1;
      continue;
    }
    if (id === "wep_keystone_overclock") {
      mods.laserSpeedMul *= 1.22;
      mods.shootCdMul *= 0.92;
      continue;
    }
    if (id === "wep_keystone_precision") {
      mods.laserSpeedMul *= 1.14;
      mods.shootCdMul *= 0.93;
      continue;
    }

    // MOBILITY
    if (id.startsWith("mob_thr_")) {
      mods.thrustMul *= 1.045;
      continue;
    }
    if (id.startsWith("mob_fric_")) {
      mods.frictionMul *= 0.965;
      continue;
    }
    if (id.startsWith("mob_spd_")) {
      mods.maxSpeedMul *= 1.035;
      continue;
    }
    if (id === "mob_keystone_driftking") {
      mods.maxSpeedMul *= 1.16;
      mods.frictionMul *= 0.9;
      continue;
    }
    if (id === "mob_keystone_afterburner") {
      mods.thrustMul *= 1.18;
      mods.maxSpeedMul *= 1.1;
      continue;
    }

    // DEFENSE
    if (id.startsWith("def_inv_")) {
      mods.invulnMul *= 1.09;
      continue;
    }
    if (id.startsWith("def_grace_")) {
      mods.invulnMul *= 1.06;
      continue;
    }
    if (id.startsWith("def_shield_")) {
      mods.startShield = 1;
      mods.invulnMul *= 1.03;
      continue;
    }
    if (id === "def_keystone_phalanx") {
      mods.startShield = 1;
      mods.invulnMul *= 1.12;
      continue;
    }
    if (id === "def_keystone_ironwill") {
      mods.invulnMul *= 1.18;
      continue;
    }

    // SALVAGE
    if (id.startsWith("salv_drop_")) {
      mods.dropChanceMul *= 1.06;
      continue;
    }
    if (id.startsWith("salv_dur_")) {
      mods.powerDurMul *= 1.07;
      continue;
    }
    if (id === "salv_keystone_scavenger") {
      mods.dropChanceMul *= 1.18;
      mods.powerDurMul *= 1.18;
      continue;
    }
    if (id === "salv_keystone_magnet") {
      mods.dropChanceMul *= 1.14;
      continue;
    }

    // CONTRACTS
    if (id.startsWith("ctr_roid_")) {
      mods.roidSpeedMul *= 1.07;
      mods.coresYieldAdd += 0.03;
      continue;
    }
    if (id.startsWith("ctr_ufo_")) {
      mods.ufoRateMul *= 1.08;
      mods.coresYieldAdd += 0.02;
      continue;
    }
    if (id.startsWith("ctr_extra_")) {
      mods.extraRoidPerWave += 1;
      mods.coresYieldAdd += 0.02;
      continue;
    }
    if (id.startsWith("ctr_yield_")) {
      mods.coresYieldAdd += 0.08;
      continue;
    }
    if (id === "ctr_keystone_hell") {
      mods.roidSpeedMul *= 1.18;
      mods.ufoRateMul *= 1.18;
      mods.extraRoidPerWave += 2;
      mods.coresYieldAdd += 0.22;
      continue;
    }
    if (id === "ctr_keystone_greed") {
      mods.coresYieldAdd += 0.2;
      continue;
    }

    // Bridges
    if (id === "bridge_wep_salv") {
      mods.laserSpeedMul *= 1.05;
      mods.dropChanceMul *= 1.05;
      continue;
    }
    if (id === "bridge_mob_wep") {
      mods.maxSpeedMul *= 1.04;
      mods.shootCdMul *= 0.97;
      continue;
    }
    if (id === "bridge_def_ctr") {
      mods.invulnMul *= 1.06;
      mods.coresYieldAdd += 0.03;
      continue;
    }
  }

  // clamps de segurança
  mods.shootCdMul = clamp(mods.shootCdMul, 0.45, 1);
  mods.powerDurMul = clamp(mods.powerDurMul, 0.75, 2.5);
  mods.laserSpeedMul = clamp(mods.laserSpeedMul, 0.75, 3.5);
  mods.thrustMul = clamp(mods.thrustMul, 0.75, 3.5);
  mods.maxSpeedMul = clamp(mods.maxSpeedMul, 0.75, 3.5);

  mods.dropChanceMul = clamp(mods.dropChanceMul, 0.5, 3.5);
  mods.invulnMul = clamp(mods.invulnMul, 0.6, 3.0);

  mods.roidSpeedMul = clamp(mods.roidSpeedMul, 0.7, 3.5);
  mods.ufoRateMul = clamp(mods.ufoRateMul, 0.7, 3.5);

  mods.laserMaxAdd = Math.max(0, mods.laserMaxAdd);
  mods.extraRoidPerWave = Math.max(0, mods.extraRoidPerWave);
  mods.coresYieldAdd = clamp(mods.coresYieldAdd, 0, 2.0);

  return mods;
}
