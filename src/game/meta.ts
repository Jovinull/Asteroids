import type { Meta, MetaMods, Skill } from "./types";
import { clamp } from "./utils";

export const META_KEY = "asteroids_meta_v1";

export function loadMeta(): Meta {
  try {
    const raw = localStorage.getItem(META_KEY);
    if (!raw) return { cores: 0, unlocked: { core: true } };
    const parsed = JSON.parse(raw) as Partial<Meta>;
    return {
      cores: typeof parsed.cores === "number" ? parsed.cores : 0,
      unlocked:
        parsed.unlocked && typeof parsed.unlocked === "object"
          ? (parsed.unlocked as Record<string, boolean>)
          : { core: true },
    };
  } catch {
    return { cores: 0, unlocked: { core: true } };
  }
}

export function saveMeta(meta: Meta): void {
  try {
    localStorage.setItem(META_KEY, JSON.stringify(meta));
  } catch {
    // ignore
  }
}

export function hasSkill(meta: Meta, id: string): boolean {
  return !!meta.unlocked[id];
}

export const SKILLS: Skill[] = [
  {
    id: "core",
    name: "Pilot Core",
    icon: "◆",
    type: "Base",
    cost: 0,
    req: [],
    desc: "O núcleo do piloto. Libera a árvore.",
    mods: {},
  },

  // Engenharia
  {
    id: "thrusters1",
    name: "Thrusters I",
    icon: "⚡",
    type: "Engenharia",
    cost: 3,
    req: ["core"],
    desc: "+6% aceleração do impulso.",
    mods: { thrustMul: 1.06 },
  },
  {
    id: "thrusters2",
    name: "Thrusters II",
    icon: "⚡",
    type: "Engenharia",
    cost: 6,
    req: ["thrusters1"],
    desc: "+10% aceleração do impulso.",
    mods: { thrustMul: 1.1 },
  },
  {
    id: "stabilizers",
    name: "Stabilizers",
    icon: "◎",
    type: "Engenharia",
    cost: 5,
    req: ["thrusters1"],
    desc: "Menos deriva (controle mais firme).",
    mods: { frictionMul: 0.92 },
  },
  {
    id: "overdrive",
    name: "Overdrive",
    icon: "⟡",
    type: "Engenharia",
    cost: 7,
    req: ["thrusters2"],
    desc: "+10% velocidade máxima.",
    mods: { maxSpeedMul: 1.1 },
  },

  // Armas
  {
    id: "capacitors",
    name: "Capacitors",
    icon: "✦",
    type: "Armas",
    cost: 4,
    req: ["core"],
    desc: "+8% velocidade do laser.",
    mods: { laserSpeedMul: 1.08 },
  },
  {
    id: "cooling",
    name: "Cooling",
    icon: "❄",
    type: "Armas",
    cost: 6,
    req: ["capacitors"],
    desc: "Menor cooldown de tiro.",
    mods: { shootCdMul: 0.88 },
  },
  {
    id: "magazine",
    name: "Magazine",
    icon: "▣",
    type: "Armas",
    cost: 7,
    req: ["cooling"],
    desc: "+2 lasers simultâneos.",
    mods: { laserMaxAdd: 2 },
  },
  {
    id: "powerMastery",
    name: "Power Mastery",
    icon: "✺",
    type: "Armas",
    cost: 6,
    req: ["capacitors"],
    desc: "Power-ups duram +20%.",
    mods: { powerDurMul: 1.2 },
  },

  // Sobrevivência
  {
    id: "shieldStart",
    name: "Shield Protocol",
    icon: "🛡",
    type: "Sobrevivência",
    cost: 8,
    req: ["core"],
    desc: "Começa a run com 1 shield.",
    mods: { startShield: 1 },
  },
  {
    id: "blinkMatrix",
    name: "Blink Matrix",
    icon: "⌁",
    type: "Sobrevivência",
    cost: 6,
    req: ["shieldStart"],
    desc: "+12% invencibilidade pós-hit.",
    mods: { invulnMul: 1.12 },
  },
  {
    id: "salvage",
    name: "Salvage",
    icon: "⛭",
    type: "Sobrevivência",
    cost: 6,
    req: ["shieldStart"],
    desc: "+20% chance de drop de power-up.",
    mods: { dropChanceMul: 1.2 },
  },

  // Contratos
  {
    id: "contract1",
    name: "Contract I",
    icon: "☠",
    type: "Contrato",
    cost: 5,
    req: ["core"],
    desc: "Asteroides +8% velozes. Núcleos +15%.",
    mods: { roidSpeedMul: 1.08, coresYieldAdd: 0.15 },
  },
  {
    id: "contract2",
    name: "Contract II",
    icon: "☠",
    type: "Contrato",
    cost: 7,
    req: ["contract1"],
    desc: "UFO aparece mais. Núcleos +20%.",
    mods: { ufoRateMul: 1.2, coresYieldAdd: 0.2 },
  },
  {
    id: "contract3",
    name: "Contract III",
    icon: "☠",
    type: "Contrato",
    cost: 9,
    req: ["contract2"],
    desc: "Wave com +1 asteroide base. Núcleos +25%.",
    mods: { extraRoidPerWave: 1, coresYieldAdd: 0.25 },
  },
];

export function computeMetaMods(meta: Meta): MetaMods {
  const mods: MetaMods = {
    thrustMul: 1,
    frictionMul: 1,
    maxSpeedMul: 1,

    laserSpeedMul: 1,
    shootCdMul: 1,
    laserMaxAdd: 0,
    powerDurMul: 1,

    invulnMul: 1,
    dropChanceMul: 1,
    startShield: 0,

    roidSpeedMul: 1,
    ufoRateMul: 1,
    extraRoidPerWave: 0,
    coresYieldAdd: 0,
  };

  for (const s of SKILLS) {
    if (!hasSkill(meta, s.id)) continue;
    const m = s.mods ?? {};

    if (m.thrustMul) mods.thrustMul *= m.thrustMul;
    if (m.frictionMul) mods.frictionMul *= m.frictionMul;
    if (m.maxSpeedMul) mods.maxSpeedMul *= m.maxSpeedMul;

    if (m.laserSpeedMul) mods.laserSpeedMul *= m.laserSpeedMul;
    if (m.shootCdMul) mods.shootCdMul *= m.shootCdMul;
    if (m.laserMaxAdd) mods.laserMaxAdd += m.laserMaxAdd;
    if (m.powerDurMul) mods.powerDurMul *= m.powerDurMul;

    if (m.invulnMul) mods.invulnMul *= m.invulnMul;
    if (m.dropChanceMul) mods.dropChanceMul *= m.dropChanceMul;
    if (m.startShield) mods.startShield += m.startShield;

    if (m.roidSpeedMul) mods.roidSpeedMul *= m.roidSpeedMul;
    if (m.ufoRateMul) mods.ufoRateMul *= m.ufoRateMul;
    if (m.extraRoidPerWave) mods.extraRoidPerWave += m.extraRoidPerWave;
    if (m.coresYieldAdd) mods.coresYieldAdd += m.coresYieldAdd;
  }

  mods.frictionMul = clamp(mods.frictionMul, 0.7, 1.2);
  mods.shootCdMul = clamp(mods.shootCdMul, 0.65, 1.25);
  mods.powerDurMul = clamp(mods.powerDurMul, 1.0, 1.6);
  mods.invulnMul = clamp(mods.invulnMul, 1.0, 1.35);

  return mods;
}
