import { describe, expect, it } from 'vitest';
import { circuitTrace, parseCircuit, runCircuit } from './circuit.js';
import { formatAmplitude } from './format.js';
import { applyMatrix, evalParam, getGateDef, resolveGateName } from './gates.js';
import { measure, sample } from './measure.js';
import { StateVector } from './state-vector.js';

const ROOT2 = Math.SQRT1_2;
const close = (a: number, b: number) => Math.abs(a - b) < 1e-10;

/** Apply a named gate (by canonical token) to a fresh state and return it. */
function apply(
  qubits: number,
  name: string,
  targets: number[],
  params: number[] = [],
): StateVector {
  const s = StateVector.zero(qubits);
  applyMatrix(s, getGateDef(name).build(params), targets);
  s.normalize();
  return s;
}

describe('StateVector', () => {
  it('initializes to |0…0⟩', () => {
    const s = StateVector.zero(3);
    expect(s.probability(0)).toBe(1);
    expect(s.norm2()).toBe(1);
  });

  it('parses ket labels', () => {
    expect(StateVector.fromKet('|1⟩').probability(1)).toBe(1);
    expect(close(StateVector.fromKet('|+⟩').probability(0), 0.5)).toBe(true);
    expect(close(StateVector.fromKet('|+⟩').probability(1), 0.5)).toBe(true);
    // |i⟩ = (|0⟩ + i|1⟩)/√2
    const psi = StateVector.fromKet('|i⟩');
    expect(close(psi.amplitude(1).im, ROOT2)).toBe(true);
  });

  it('multi-qubit basis ket |10⟩ is little-endian (index 2)', () => {
    const s = StateVector.fromKet('|10⟩');
    expect(s.probability(2)).toBe(1);
  });

  it('validate() flags non-normalized states', () => {
    const s = StateVector.zero(1);
    s.data[0] = 5;
    expect(s.validate()).not.toBeNull();
  });
});

describe('single-qubit gates (textbook matrices)', () => {
  it('H|0⟩ = (|0⟩+|1⟩)/√2', () => {
    const s = apply(1, 'H', [0]);
    expect(close(s.amplitude(0).re, ROOT2)).toBe(true);
    expect(close(s.amplitude(1).re, ROOT2)).toBe(true);
  });

  it('X|0⟩ = |1⟩', () => {
    expect(apply(1, 'X', [0]).probability(1)).toBe(1);
  });

  it('Y|0⟩ = i|1⟩', () => {
    const s = apply(1, 'Y', [0]);
    expect(close(s.amplitude(1).im, 1)).toBe(true);
  });

  it('Z|1⟩ = -|1⟩', () => {
    const s = StateVector.fromKet('|1⟩');
    applyMatrix(s, getGateDef('Z').build([]), [0]);
    expect(close(s.amplitude(1).re, -1)).toBe(true);
  });

  it('HH = I', () => {
    const s = StateVector.zero(1);
    applyMatrix(s, getGateDef('H').build([]), [0]);
    applyMatrix(s, getGateDef('H').build([]), [0]);
    s.normalize();
    expect(close(s.probability(0), 1)).toBe(true);
  });

  it('S = √Z: SS|+⟩ phases |1⟩ by -1', () => {
    const s = StateVector.fromKet('|+⟩');
    applyMatrix(s, getGateDef('S').build([]), [0]);
    applyMatrix(s, getGateDef('S').build([]), [0]);
    expect(close(s.amplitude(1).re, -ROOT2)).toBe(true);
  });

  it('T·T = S', () => {
    const t = StateVector.fromKet('|1⟩');
    applyMatrix(t, getGateDef('T').build([]), [0]);
    applyMatrix(t, getGateDef('T').build([]), [0]);
    const sgate = StateVector.fromKet('|1⟩');
    applyMatrix(sgate, getGateDef('S').build([]), [0]);
    expect(close(t.amplitude(1).re, sgate.amplitude(1).re)).toBe(true);
    expect(close(t.amplitude(1).im, sgate.amplitude(1).im)).toBe(true);
  });

  it('RX(π) ≈ -iX', () => {
    const s = apply(1, 'RX', [0], [Math.PI]);
    expect(close(s.probability(1), 1)).toBe(true);
    expect(close(s.amplitude(1).im, -1)).toBe(true);
  });
});

describe('two- and three-qubit gates', () => {
  it('CNOT truth table over all 4 basis states', () => {
    const expected: Record<string, string> = {
      '00': '00',
      '01': '11', // control = qubit0 (rightmost) set → flips target qubit1
      '10': '10',
      '11': '01',
    };
    for (const [input, output] of Object.entries(expected)) {
      const s = StateVector.fromKet(`|${input}⟩`);
      applyMatrix(s, getGateDef('CNOT').build([]), [0, 1]); // control 0, target 1
      const want = Number.parseInt(output, 2);
      expect(s.probability(want)).toBe(1);
    }
  });

  it('Bell state: H 0; CNOT 0 1 → (|00⟩+|11⟩)/√2', () => {
    const s = runCircuit(2, parseCircuit(['H 0', 'CNOT 0 1']));
    expect(close(s.probability(0), 0.5)).toBe(true);
    expect(close(s.probability(3), 0.5)).toBe(true);
    expect(close(s.probability(1), 0)).toBe(true);
    expect(close(s.probability(2), 0)).toBe(true);
  });

  it('SWAP exchanges qubits', () => {
    const s = StateVector.fromKet('|01⟩'); // index 1
    applyMatrix(s, getGateDef('SWAP').build([]), [0, 1]);
    expect(s.probability(2)).toBe(1); // |10⟩
  });

  it('Toffoli flips target only when both controls set', () => {
    const s = StateVector.fromKet('|011⟩'); // controls q0,q1 = 1; target q2 = 0
    applyMatrix(s, getGateDef('CCX').build([]), [0, 1, 2]);
    expect(s.probability(0b111)).toBe(1);
  });

  it('CZ applies a phase to |11⟩ only', () => {
    const s = StateVector.fromKet('|11⟩');
    applyMatrix(s, getGateDef('CZ').build([]), [0, 1]);
    expect(close(s.amplitude(3).re, -1)).toBe(true);
  });
});

describe('gate name + parameter resolution', () => {
  it('resolves adjoint spellings', () => {
    expect(resolveGateName('Sdg')).toBe('SDG');
    expect(resolveGateName('S_dag')).toBe('SDG');
    expect(resolveGateName('cnot')).toBe('CX');
    expect(resolveGateName('Toffoli')).toBe('CCX');
  });

  it('evaluates parameter expressions', () => {
    expect(close(evalParam('pi'), Math.PI)).toBe(true);
    expect(close(evalParam('pi/2'), Math.PI / 2)).toBe(true);
    expect(close(evalParam('2*pi/3'), (2 * Math.PI) / 3)).toBe(true);
    expect(close(evalParam('0.785'), 0.785)).toBe(true);
  });
});

describe('circuit parsing', () => {
  it('parses parameterized and multi-qubit ops', () => {
    const [rz, crz] = parseCircuit(['RZ(pi/4) 0', 'CRZ(pi/2) 0 1']);
    expect(rz?.name).toBe('RZ');
    expect(close(rz?.params[0] ?? 0, Math.PI / 4)).toBe(true);
    expect(crz?.qubits).toEqual([0, 1]);
  });

  it('rejects wrong arity with a clear message', () => {
    expect(() => runCircuit(1, parseCircuit(['CNOT 0 1']))).toThrow(/qubit/);
  });

  it('circuitTrace yields one frame per step plus the initial', () => {
    const frames = circuitTrace(2, parseCircuit(['H 0', 'CNOT 0 1']));
    expect(frames.length).toBe(3);
    expect(frames[0]?.probability(0)).toBe(1);
  });
});

describe('measurement', () => {
  it('collapses deterministically given a fixed rng', () => {
    const bell = runCircuit(2, parseCircuit(['H 0', 'CNOT 0 1']));
    const r = measure(bell, () => 0.99); // lands in the upper half → |11⟩
    expect(r.outcome).toBe(3);
    expect(r.bitstring).toBe('11');
    expect(r.collapsed.probability(3)).toBe(1);
  });

  it('sampling a Bell state hits only correlated outcomes', () => {
    const bell = runCircuit(2, parseCircuit(['H 0', 'CNOT 0 1']));
    const hist = sample(bell, 2000, () => 0.25);
    expect(hist.get(1)).toBeUndefined();
    expect(hist.get(2)).toBeUndefined();
  });
});

describe('symbolic amplitude formatting', () => {
  it('recognizes common values', () => {
    expect(formatAmplitude({ re: 0, im: 0 })).toBe('0');
    expect(formatAmplitude({ re: 1, im: 0 })).toBe('1');
    expect(formatAmplitude({ re: -1, im: 0 })).toBe('-1');
    expect(formatAmplitude({ re: ROOT2, im: 0 })).toBe('1/√2');
    expect(formatAmplitude({ re: 0, im: 1 })).toBe('i');
    expect(formatAmplitude({ re: 0, im: -1 })).toBe('-i');
    expect(formatAmplitude({ re: 0, im: ROOT2 })).toBe('i/√2');
    expect(formatAmplitude({ re: 0.5, im: 0.5 })).toBe('(1+i)/2');
  });

  it('falls back to decimals', () => {
    expect(formatAmplitude({ re: 0.333, im: 0 }, { precision: 3 })).toBe('0.333');
    expect(formatAmplitude({ re: 0.1, im: 0.2 }, { format: 'decimal', precision: 2 })).toBe(
      '0.10+0.20i',
    );
  });
});
