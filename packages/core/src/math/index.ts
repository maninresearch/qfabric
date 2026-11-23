/**
 * @qfabric/core/math: the quantum math engine.
 *
 * Public, framework-agnostic API for plugin authors and advanced users.
 * Imports nothing from the DOM/rendering layer.
 */

export type { Complex } from './complex.js';
export { c, cAbs, cAbs2, cArg, cExp, cMul, cAdd } from './complex.js';

export { StateVector, EPSILON, MAX_QUBITS } from './state-vector.js';

export {
  type GateMatrix,
  applyMatrix,
  evalParam,
  getGateDef,
  resolveGateName,
  GATE_NAMES,
} from './gates.js';

export {
  type Operation,
  parseOperation,
  parseCircuit,
  applyOperation,
  runCircuit,
  circuitTrace,
} from './circuit.js';

export {
  type MeasurementResult,
  measure,
  sample,
  basisLabel,
} from './measure.js';

export {
  type FormatOptions,
  formatAmplitude,
  formatProbability,
} from './format.js';
