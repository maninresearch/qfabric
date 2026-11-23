import type { Complex } from './complex.js';

/** Tolerance for normalization / validation checks. */
export const EPSILON = 1e-10;

/** Maximum qubit count. */
export const MAX_QUBITS = 16;

/**
 * A pure quantum state on `qubits` qubits.
 *
 * Amplitudes are stored as a flat `Float64Array` of interleaved `[re, im]`
 * pairs of length `2 · 2^n`. Basis index `i` uses little-endian (Qiskit)
 * ordering: qubit 0 is the least-significant bit, i.e. the rightmost symbol in
 * `|…⟩` notation and the top wire of a circuit.
 */
export class StateVector {
  readonly qubits: number;
  readonly dim: number;
  readonly data: Float64Array;

  constructor(qubits: number, data?: Float64Array) {
    if (qubits < 1 || qubits > MAX_QUBITS || !Number.isInteger(qubits)) {
      throw new RangeError(`qubits must be an integer in [1, ${MAX_QUBITS}], got ${qubits}`);
    }
    this.qubits = qubits;
    this.dim = 1 << qubits;
    if (data) {
      if (data.length !== this.dim * 2) {
        throw new RangeError(`data length ${data.length} !== expected ${this.dim * 2}`);
      }
      this.data = data;
    } else {
      this.data = new Float64Array(this.dim * 2);
      this.data[0] = 1; // |0…0⟩
    }
  }

  /** The computational ground state |0…0⟩. */
  static zero(qubits: number): StateVector {
    return new StateVector(qubits);
  }

  /**
   * Build a single-qubit state from a ket label: `|0⟩ |1⟩ |+⟩ |-⟩ |i⟩ |-i⟩`,
   * or a multi-qubit computational basis ket like `|01⟩` / `|101⟩`.
   * Angle brackets may be ASCII `>` or unicode `⟩`; surrounding `|` optional.
   */
  static fromKet(label: string): StateVector {
    const inner = label.trim().replace(/^\|/, '').replace(/[⟩>]$/, '').trim();
    const ROOT2 = Math.SQRT1_2;
    switch (inner) {
      case '0':
        return StateVector.zero(1);
      case '1': {
        const s = new StateVector(1);
        s.data[0] = 0;
        s.data[2] = 1;
        return s;
      }
      case '+':
        return StateVector.fromAmplitudes(1, [ROOT2, 0, ROOT2, 0]);
      case '-':
        return StateVector.fromAmplitudes(1, [ROOT2, 0, -ROOT2, 0]);
      case 'i':
        return StateVector.fromAmplitudes(1, [ROOT2, 0, 0, ROOT2]);
      case '-i':
        return StateVector.fromAmplitudes(1, [ROOT2, 0, 0, -ROOT2]);
      default: {
        if (!/^[01]+$/.test(inner)) {
          throw new Error(
            `Invalid state '|${inner}⟩'. Expected |0⟩, |1⟩, |+⟩, |-⟩, |i⟩, |-i⟩ or a computational basis ket like |01⟩.`,
          );
        }
        const n = inner.length;
        // Little-endian: leftmost symbol is the highest-indexed qubit.
        const index = Number.parseInt(inner, 2);
        const s = new StateVector(n);
        s.data[0] = 0;
        s.data[index * 2] = 1;
        return s;
      }
    }
  }

  /** Build from a flat interleaved `[re, im, …]` array; normalized on creation. */
  static fromAmplitudes(qubits: number, amps: ArrayLike<number>): StateVector {
    const data = new Float64Array(amps);
    const s = new StateVector(qubits, data);
    s.normalize();
    return s;
  }

  /** Read amplitude of basis state `i` as a `Complex`. */
  amplitude(i: number): Complex {
    return { re: this.data[i * 2] ?? 0, im: this.data[i * 2 + 1] ?? 0 };
  }

  /** Probability |amplitude(i)|² of measuring basis state `i`. */
  probability(i: number): number {
    const re = this.data[i * 2] ?? 0;
    const im = this.data[i * 2 + 1] ?? 0;
    return re * re + im * im;
  }

  /** Full probability distribution over all `2^n` basis states. */
  probabilities(): Float64Array {
    const out = new Float64Array(this.dim);
    for (let i = 0; i < this.dim; i++) out[i] = this.probability(i);
    return out;
  }

  /** Sum of all probabilities. Should be 1 for a valid normalized state. */
  norm2(): number {
    let sum = 0;
    for (let i = 0; i < this.data.length; i++) {
      const v = this.data[i] ?? 0;
      sum += v * v;
    }
    return sum;
  }

  /**
   * Re-normalize in place to unit norm, guarding against floating-point drift.
   * Called after every gate.
   */
  normalize(): this {
    const n = Math.sqrt(this.norm2());
    if (n > EPSILON && Math.abs(n - 1) > EPSILON) {
      for (let i = 0; i < this.data.length; i++) this.data[i] = (this.data[i] ?? 0) / n;
    }
    return this;
  }

  /**
   * Validate the state: finite values, unit norm within ε. Returns an error
   * string if invalid, or `null` if valid. Callers keep the last valid state on
   * failure and show a warning.
   */
  validate(): string | null {
    for (let i = 0; i < this.data.length; i++) {
      const v = this.data[i] ?? 0;
      if (!Number.isFinite(v)) return 'state contains NaN or Infinity';
    }
    const total = this.norm2();
    if (Math.abs(total - 1) > 1e-6) {
      return `probabilities sum to ${total.toFixed(6)}, expected 1`;
    }
    return null;
  }

  /** Deep copy. */
  clone(): StateVector {
    return new StateVector(this.qubits, new Float64Array(this.data));
  }
}
