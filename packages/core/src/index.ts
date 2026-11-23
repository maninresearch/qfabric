/**
 * qfabric: QFabric web components and quantum math engine.
 *
 * Importing this convenience entry registers all shipped components. For
 * tree-shakeable builds import a specific component instead, e.g.
 * `import 'qfabric/state-vector'`.
 */

// Side-effectful registration of every shipped component.
import './components/state-vector/index.js';
import './components/probability/index.js';

// Re-exports for programmatic use.
export * from './math/index.js';
export { QFElement } from './base/qf-element.js';
export { QFStateElement } from './base/qf-state-element.js';
export { defineElement } from './base/register.js';
export type { Mode, Theme, Size } from './base/types.js';
export {
  dispatchStateUpdate,
  dispatchError,
  onStateUpdate,
  onError,
  stateUpdateFrom,
  type StateUpdateDetail,
  type ErrorDetail,
} from './base/bind.js';
export { QFStateVector } from './components/state-vector/index.js';
export { QFProbability } from './components/probability/index.js';

export const version = '0.0.0';
