import fs from "fs";

const path = "src/db/enemies/monsters.ts";
const raw = fs.readFileSync(path, "utf8");
const lines = raw.split(/\r?\n/);

const coalStart = lines.findIndex((l) => /^  coalConvoyGuardian: \{/.test(l));
const carStart = lines.findIndex((l, idx) => idx > coalStart && /^  carGuardian: \{/.test(l));
if (coalStart < 0 || carStart < 0) {
  throw new Error("Could not find coalConvoyGuardian / carGuardian anchors");
}

const coalLines = lines.slice(coalStart, carStart);
let block = coalLines.join("\n");
block = block.replace(/^  coalConvoyGuardian:/m, "  coalFlameGuardian:");
block = block.replace(/Coal Convoy Guardian/g, "Coal Flame Guardian");

block = block.replace(
  /\n    projectile: \{[\s\S]*?\n    \},\n(?=    emitter:)/,
  "\n",
);

const fpStart = lines.findIndex((l) => /^  fireParasiteEnemy: \{/.test(l));
let saLine = -1;
for (let i = fpStart; i < lines.length; i++) {
  if (lines[i] === "    streamAttack: {") {
    saLine = i;
    break;
  }
}
if (saLine < 0) {
  throw new Error("streamAttack not found on fireParasiteEnemy");
}

let depth = 0;
let started = false;
let saEnd = -1;
for (let i = saLine; i < lines.length; i++) {
  const line = lines[i];
  for (const ch of line) {
    if (ch === "{") {
      depth += 1;
      started = true;
    } else if (ch === "}") {
      depth -= 1;
    }
  }
  if (started && depth === 0 && line.trim() === "},") {
    saEnd = i;
    break;
  }
}
if (saEnd < 0) {
  throw new Error("Could not close streamAttack block");
}

const streamLines = lines.slice(saLine, saEnd + 1);
let streamText = streamLines.join("\n");
streamText = streamText.replace(/damage: 1100/, "damage: 1600");
streamText = streamText.replace(/damagePerSecond: 850/, "damagePerSecond: 1236");

block = block.replace(
  /(    projectileKnockBackSpeed: 0,\n    projectileKnockBackDistance: 0,)\n(    emitter:)/,
  `$1\n${streamText}\n$2`,
);

const withoutIife = raw.replace(
  /\r?\n\r?\n\{\r?\n  const coal = MONSTERS_ENEMIES\.coalConvoyGuardian;[\s\S]*?\r?\n\}\r?\n?$/,
  "\n",
);

const inserted = withoutIife.replace(
  /(\n  coalConvoyGuardian: \{[\s\S]*?\n  \},\n)(  carGuardian: \{)/,
  `$1${block}\n$2`,
);

if (inserted === withoutIife) {
  throw new Error("Insert failed — pattern not found (coal/carbGuardian)");
}

fs.writeFileSync(path, inserted, "utf8");
console.log("OK: coalFlameGuardian inlined, IIFE removed");
