import { StateVector } from './state-vector.js';

/** Result of a single-shot measurement. */
export interface MeasurementResult {
  /** Measured basis-state index. */
  outcome: number;
  /** Outcome as a little-endian bit string, qubit 0 rightmost. */
  bitstring: string;
  /** The random number drawn in [0, 1), for callers that explain the draw. */
  random: number;
  /** The post-measurement collapsed state. */
  collapsed: StateVector;
}

/** Format a basis index as an n-bit little-endian ket label string (no bars). */
export function basisLabel(index: number, qubits: number): string {
  return index.toString(2).padStart(qubits, '0');
}

/**
 * Perform a single-shot measurement in the computational basis. Draws a random
 * number (override `rng` for determinism in tests), maps it to an outcome via
 * the cumulative distribution, and returns the collapsed post-measurement
 * state. Does not mutate the input.
 */
export function measure(state: StateVector, rng: () => number = Math.random): MeasurementResult {
  const probs = state.probabilities();
  const random = rng();
  let cumulative = 0;
  let outcome = probs.length - 1;
  for (let i = 0; i < probs.length; i++) {
    cumulative += probs[i] ?? 0;
    if (random < cumulative) {
      outcome = i;
      break;
    }
  }
  const collapsed = StateVector.zero(state.qubits);
  collapsed.data[0] = 0;
  collapsed.data[outcome * 2] = 1;
  return {
    outcome,
    bitstring: basisLabel(outcome, state.qubits),
    random,
    collapsed,
  };
}

/**
 * Run `shots` independent measurements (without collapsing the source state)
 * and return a histogram mapping each outcome index to its count.
 */
export function sample(
  state: StateVector,
  shots: number,
  rng: () => number = Math.random,
): Map<number, number> {
  const probs = state.probabilities();
  // Precompute cumulative distribution once.
  const cum = new Float64Array(probs.length);
  let acc = 0;
  for (let i = 0; i < probs.length; i++) {
    acc += probs[i] ?? 0;
    cum[i] = acc;
  }
  const hist = new Map<number, number>();
  for (let s = 0; s < shots; s++) {
    const r = rng();
    let outcome = probs.length - 1;
    for (let i = 0; i < cum.length; i++) {
      if (r < (cum[i] ?? 1)) {
        outcome = i;
        break;
      }
    }
    hist.set(outcome, (hist.get(outcome) ?? 0) + 1);
  }
  return hist;
}
