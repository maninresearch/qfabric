import { applyMatrix, evalParam, getGateDef } from './gates.js';
import { StateVector } from './state-vector.js';

/** A parsed gate operation. */
export interface Operation {
  /** Gate name as written (e.g. `H`, `CNOT`, `RZ`). */
  name: string;
  /** Evaluated numeric parameters (e.g. `[π/4]`). */
  params: number[];
  /** Target qubits, in written order (controls first, target last). */
  qubits: number[];
  /** True for `measure` ops, which are handled by the measurement layer. */
  measure?: boolean;
}

/**
 * Parse one gate line: `GATE [PARAM] QUBIT…`.
 *
 *   H 0            → { name:'H', params:[], qubits:[0] }
 *   CNOT 0 1       → { name:'CNOT', params:[], qubits:[0,1] }
 *   RZ(pi/4) 0     → { name:'RZ', params:[π/4], qubits:[0] }
 *   measure 0 1    → { name:'measure', measure:true, qubits:[0,1] }
 *   barrier        → { name:'barrier', qubits:[] }
 */
export function parseOperation(line: string): Operation {
  const trimmed = line.trim();
  const match = trimmed.match(/^([A-Za-z_†]+)(?:\(([^)]*)\))?\s*(.*)$/);
  if (!match) throw new Error(`Cannot parse gate line '${line}'.`);
  const [, rawName = '', paramStr, rest = ''] = match;
  const name = rawName;
  const lower = name.toLowerCase();

  const qubits = rest
    .trim()
    .split(/[\s,]+/)
    .filter((t) => t.length > 0)
    .map((t) => {
      const q = Number.parseInt(t, 10);
      if (Number.isNaN(q)) throw new Error(`Invalid qubit index '${t}' in '${line}'.`);
      return q;
    });

  if (lower === 'measure') return { name: 'measure', params: [], qubits, measure: true };
  if (lower === 'barrier') return { name: 'barrier', params: [], qubits };

  const params = paramStr ? paramStr.split(',').map((p) => evalParam(p.trim())) : [];

  return { name, params, qubits };
}

/** Parse a list of gate lines (skips blank lines). */
export function parseCircuit(lines: string[]): Operation[] {
  return lines
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .map(parseOperation);
}

/**
 * Apply one operation to a state in place (measurement/barrier are no-ops here
 * because measurement is a separate, randomized step). Validates arity against the
 * circuit's qubit count and re-normalizes after the gate.
 */
export function applyOperation(state: StateVector, op: Operation): void {
  if (op.measure || op.name.toLowerCase() === 'barrier') return;
  const def = getGateDef(op.name);
  if (op.qubits.length !== def.arity) {
    throw new Error(
      `${op.name} requires ${def.arity} qubit(s), but ${op.qubits.length} given ` +
        `('${op.name} ${op.qubits.join(' ')}').`,
    );
  }
  applyMatrix(state, def.build(op.params), op.qubits);
  state.normalize();
}

/**
 * Run a full sequence on a fresh `|0…0⟩` state (or a provided initial state),
 * returning the final state. Gates apply in circuit order: left to right, each
 * left-multiplied individually.
 */
export function runCircuit(qubits: number, ops: Operation[], initial?: StateVector): StateVector {
  const state = initial ? initial.clone() : StateVector.zero(qubits);
  for (const op of ops) applyOperation(state, op);
  return state;
}

/**
 * Like `runCircuit` but returns every intermediate state (including the initial
 * one), for showing each gate's effect step by step.
 */
export function circuitTrace(
  qubits: number,
  ops: Operation[],
  initial?: StateVector,
): StateVector[] {
  const state = initial ? initial.clone() : StateVector.zero(qubits);
  const frames: StateVector[] = [state.clone()];
  for (const op of ops) {
    applyOperation(state, op);
    frames.push(state.clone());
  }
  return frames;
}
