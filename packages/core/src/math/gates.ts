import type { StateVector } from './state-vector.js';

/**
 * A unitary as a flat row-major matrix of interleaved `[re, im]` entries.
 * Dimension `2^k` for a k-qubit gate, so `data.length === 2 · 2^k · 2^k`.
 */
export interface GateMatrix {
  /** Number of qubits the matrix acts on. */
  arity: number;
  /** Row-major interleaved complex entries. */
  data: Float64Array;
}

const SQRT1_2 = Math.SQRT1_2;

/** Build a k-qubit `GateMatrix` from nested `[re, im]` rows. */
function mat(rows: Array<Array<[number, number]>>): GateMatrix {
  const dim = rows.length;
  const arity = Math.log2(dim);
  const data = new Float64Array(dim * dim * 2);
  for (let r = 0; r < dim; r++) {
    const row = rows[r];
    if (!row || row.length !== dim) throw new Error('non-square gate matrix');
    for (let cIdx = 0; cIdx < dim; cIdx++) {
      const entry = row[cIdx] ?? [0, 0];
      data[(r * dim + cIdx) * 2] = entry[0];
      data[(r * dim + cIdx) * 2 + 1] = entry[1];
    }
  }
  return { arity, data };
}

/** Promote a single-qubit unitary to a controlled (2-qubit) gate: diag(I, U). */
function controlled(u: GateMatrix): GateMatrix {
  const d = u.data;
  return mat([
    [
      [1, 0],
      [0, 0],
      [0, 0],
      [0, 0],
    ],
    [
      [0, 0],
      [1, 0],
      [0, 0],
      [0, 0],
    ],
    [
      [0, 0],
      [0, 0],
      [d[0]!, d[1]!],
      [d[2]!, d[3]!],
    ],
    [
      [0, 0],
      [0, 0],
      [d[4]!, d[5]!],
      [d[6]!, d[7]!],
    ],
  ]);
}

// Static single-qubit gates
const I = mat([
  [
    [1, 0],
    [0, 0],
  ],
  [
    [0, 0],
    [1, 0],
  ],
]);
const X = mat([
  [
    [0, 0],
    [1, 0],
  ],
  [
    [1, 0],
    [0, 0],
  ],
]);
const Y = mat([
  [
    [0, 0],
    [0, -1],
  ],
  [
    [0, 1],
    [0, 0],
  ],
]);
const Z = mat([
  [
    [1, 0],
    [0, 0],
  ],
  [
    [0, 0],
    [-1, 0],
  ],
]);
const H = mat([
  [
    [SQRT1_2, 0],
    [SQRT1_2, 0],
  ],
  [
    [SQRT1_2, 0],
    [-SQRT1_2, 0],
  ],
]);
const S = mat([
  [
    [1, 0],
    [0, 0],
  ],
  [
    [0, 0],
    [0, 1],
  ],
]);
const SDG = mat([
  [
    [1, 0],
    [0, 0],
  ],
  [
    [0, 0],
    [0, -1],
  ],
]);
const T = mat([
  [
    [1, 0],
    [0, 0],
  ],
  [
    [0, 0],
    [SQRT1_2, SQRT1_2],
  ],
]);
const TDG = mat([
  [
    [1, 0],
    [0, 0],
  ],
  [
    [0, 0],
    [SQRT1_2, -SQRT1_2],
  ],
]);

// Parameterized single-qubit gates
const RX = (t: number): GateMatrix => {
  const c = Math.cos(t / 2);
  const s = Math.sin(t / 2);
  return mat([
    [
      [c, 0],
      [0, -s],
    ],
    [
      [0, -s],
      [c, 0],
    ],
  ]);
};
const RY = (t: number): GateMatrix => {
  const c = Math.cos(t / 2);
  const s = Math.sin(t / 2);
  return mat([
    [
      [c, 0],
      [-s, 0],
    ],
    [
      [s, 0],
      [c, 0],
    ],
  ]);
};
const RZ = (t: number): GateMatrix =>
  mat([
    [
      [Math.cos(t / 2), -Math.sin(t / 2)],
      [0, 0],
    ],
    [
      [0, 0],
      [Math.cos(t / 2), Math.sin(t / 2)],
    ],
  ]);
const P = (phi: number): GateMatrix =>
  mat([
    [
      [1, 0],
      [0, 0],
    ],
    [
      [0, 0],
      [Math.cos(phi), Math.sin(phi)],
    ],
  ]);

// Two- and three-qubit gates
// Convention: first listed qubit(s) are control(s), last is target. In the
// matrix the first qubit is the most-significant local bit.
const CX = controlled(X);
const CY = controlled(Y);
const CZ = controlled(Z);
const CH = controlled(H);
const CRZ = (t: number): GateMatrix => controlled(RZ(t));

const SWAP = mat([
  [
    [1, 0],
    [0, 0],
    [0, 0],
    [0, 0],
  ],
  [
    [0, 0],
    [0, 0],
    [1, 0],
    [0, 0],
  ],
  [
    [0, 0],
    [1, 0],
    [0, 0],
    [0, 0],
  ],
  [
    [0, 0],
    [0, 0],
    [0, 0],
    [1, 0],
  ],
]);

/** Build an 8×8 permutation gate from a basis-index permutation. */
function permute3(perm: number[]): GateMatrix {
  const data = new Float64Array(8 * 8 * 2);
  for (let r = 0; r < 8; r++) data[(r * 8 + (perm[r] ?? r)) * 2] = 1;
  return { arity: 3, data };
}
// Toffoli: controls high bits, flip target (low bit) when both controls set.
const CCX = permute3([0, 1, 2, 3, 4, 5, 7, 6]);
// Fredkin: control high bit; swap the two targets when control set (5 ↔ 6).
const CSWAP = permute3([0, 1, 2, 3, 4, 6, 5, 7]);

/** A gate spec resolved from a name: arity + a factory taking its parameters. */
interface GateDef {
  arity: number;
  paramCount: number;
  build: (params: number[]) => GateMatrix;
}

const def = (m: GateMatrix): GateDef => ({ arity: m.arity, paramCount: 0, build: () => m });
const paramDef = (arity: number, build: (params: number[]) => GateMatrix): GateDef => ({
  arity,
  paramCount: 1,
  build,
});

/**
 * Gate registry. Keys are canonical names; `resolveGateName` maps the many
 * accepted spellings (`Sdg`, `S†`, `S_dag` and so on) onto these.
 */
const GATES: Record<string, GateDef> = {
  I: def(I),
  H: def(H),
  X: def(X),
  Y: def(Y),
  Z: def(Z),
  S: def(S),
  SDG: def(SDG),
  T: def(T),
  TDG: def(TDG),
  RX: paramDef(1, (p) => RX(p[0] ?? 0)),
  RY: paramDef(1, (p) => RY(p[0] ?? 0)),
  RZ: paramDef(1, (p) => RZ(p[0] ?? 0)),
  P: paramDef(1, (p) => P(p[0] ?? 0)),
  CX: def(CX),
  CY: def(CY),
  CZ: def(CZ),
  CH: def(CH),
  SWAP: def(SWAP),
  CRZ: paramDef(2, (p) => CRZ(p[0] ?? 0)),
  CCX: def(CCX),
  CSWAP: def(CSWAP),
  BARRIER: { arity: 0, paramCount: 0, build: () => I }, // visual no-op
};

const ALIASES: Record<string, string> = {
  CNOT: 'CX',
  CPHASE: 'CZ',
  TOFFOLI: 'CCX',
  CCNOT: 'CCX',
  FREDKIN: 'CSWAP',
  SDAG: 'SDG',
  S_DAG: 'SDG',
  'S†': 'SDG',
  TDAG: 'TDG',
  T_DAG: 'TDG',
  'T†': 'TDG',
  PHASE: 'P',
};

/**
 * Normalize a gate name to its canonical registry key. Accepts case-insensitive
 * input and adjoint spellings: `Sdg`, `Sdag`, `S†`, `S_dag` → `SDG`.
 */
export function resolveGateName(name: string): string {
  const raw = name.trim();
  // Preserve the dagger glyph; uppercase the rest.
  const upper = raw.replace('†', '†').toUpperCase().replace(/\s+/g, '');
  if (GATES[upper]) return upper;
  if (ALIASES[upper]) return ALIASES[upper];
  // `S†` stays `S†` when upper-cased and `Sdg` becomes `SDG`; both map to the same key.
  const dag = upper.replace('†', 'DG');
  if (GATES[dag]) return dag;
  if (ALIASES[dag]) return ALIASES[dag];
  throw new Error(`Unknown gate '${name}'.`);
}

/** Look up a gate definition by (any spelling of) name. */
export function getGateDef(name: string): GateDef {
  const def = GATES[resolveGateName(name)];
  if (!def) throw new Error(`Unknown gate '${name}'.`);
  return def;
}

/**
 * Evaluate a parameter expression: `pi`, `pi/2`, `pi/4`, `2*pi/3`, `0.785`.
 * Supports `pi` (= Math.PI) and chained `*` / `/` only. Not a full parser.
 */
export function evalParam(expr: string | number): number {
  if (typeof expr === 'number') return expr;
  const tokens = expr
    .trim()
    .split(/(?<=[*/])|(?=[*/])/)
    .map((t) => t.trim());
  let acc: number | null = null;
  let op: '*' | '/' = '*';
  for (const tok of tokens) {
    if (tok === '*' || tok === '/') {
      op = tok;
      continue;
    }
    if (tok === '') continue;
    const val = tok === 'pi' || tok === 'π' ? Math.PI : tok === '-pi' ? -Math.PI : Number(tok);
    if (Number.isNaN(val)) throw new Error(`Cannot parse gate parameter '${expr}'.`);
    if (acc === null) acc = val;
    else acc = op === '*' ? acc * val : acc / val;
  }
  if (acc === null) throw new Error(`Empty gate parameter '${expr}'.`);
  return acc;
}

/**
 * Apply a `k`-qubit unitary in place to `state` on the ordered qubit list
 * `qubits`. The first listed qubit maps to the most-significant local bit (so
 * controlled gates put control first, target last). Caller normalizes after.
 */
export function applyMatrix(state: StateVector, m: GateMatrix, qubits: number[]): void {
  const k = m.arity;
  if (k === 0) return; // barrier / no-op
  if (qubits.length !== k) {
    throw new Error(`gate of arity ${k} needs ${k} qubits, got ${qubits.length}`);
  }
  for (const q of qubits) {
    if (q < 0 || q >= state.qubits) {
      throw new Error(`qubit index ${q} out of range for ${state.qubits}-qubit state`);
    }
  }
  const dim = 1 << k;
  const n = state.qubits;
  const data = state.data;
  let targetMask = 0;
  for (const q of qubits) targetMask |= 1 << q;

  // Precompute the global bit position for each local bit (MSB → qubits[0]).
  const bitForLocal: number[] = [];
  for (let j = 0; j < k; j++) bitForLocal[j] = qubits[j]!;

  const inRe = new Float64Array(dim);
  const inIm = new Float64Array(dim);

  for (let base = 0; base < 1 << n; base++) {
    if ((base & targetMask) !== 0) continue; // process each group once

    // Gather the `dim` amplitudes of this group.
    const idx: number[] = [];
    for (let l = 0; l < dim; l++) {
      let g = base;
      for (let j = 0; j < k; j++) {
        if ((l >> (k - 1 - j)) & 1) g |= 1 << bitForLocal[j]!;
      }
      idx[l] = g;
      inRe[l] = data[g * 2]!;
      inIm[l] = data[g * 2 + 1]!;
    }

    // out = M · in
    for (let r = 0; r < dim; r++) {
      let accRe = 0;
      let accIm = 0;
      for (let cIdx = 0; cIdx < dim; cIdx++) {
        const mRe = m.data[(r * dim + cIdx) * 2]!;
        const mIm = m.data[(r * dim + cIdx) * 2 + 1]!;
        const vRe = inRe[cIdx]!;
        const vIm = inIm[cIdx]!;
        accRe += mRe * vRe - mIm * vIm;
        accIm += mRe * vIm + mIm * vRe;
      }
      const g = idx[r]!;
      data[g * 2] = accRe;
      data[g * 2 + 1] = accIm;
    }
  }
}

/** Canonical names of every registered gate. */
export const GATE_NAMES = Object.keys(GATES);
