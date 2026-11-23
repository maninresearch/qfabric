import type { StateVector } from '../math/state-vector.js';

/**
 * Bind protocol. A source component dispatches a single
 * `qfabric:state-update:{id}` event on `document`, and receivers bound to that
 * id update their state from it.
 *
 * All events use `{ bubbles: true, composed: true }` so they cross Shadow DOM
 * boundaries.
 */

export interface StateUpdateDetail {
  id: string;
  /** Interleaved [re, im] amplitudes. A copy, safe for the receiver to keep. */
  stateVector: Float64Array;
  qubits: number;
  metadata: { gatesApplied: string[]; step: number };
}

export interface ErrorDetail {
  error: string;
  lastValidState: {
    stateVector: Float64Array;
    qubits: number;
    metadata: { gatesApplied: string[]; step: number };
  };
}

const updateEvent = (id: string) => `qfabric:state-update:${id}`;
const errorEvent = (id: string) => `qfabric:error:${id}`;

/** Dispatch a state-update for a source `id`. Caller passes a fresh copy. */
export function dispatchStateUpdate(detail: StateUpdateDetail): void {
  if (typeof document === 'undefined') return;
  document.dispatchEvent(
    new CustomEvent<StateUpdateDetail>(updateEvent(detail.id), {
      detail,
      bubbles: true,
      composed: true,
    }),
  );
}

/** Dispatch an error event for a source `id`. */
export function dispatchError(id: string, detail: ErrorDetail): void {
  if (typeof document === 'undefined') return;
  document.dispatchEvent(
    new CustomEvent<ErrorDetail>(errorEvent(id), { detail, bubbles: true, composed: true }),
  );
}

/** Subscribe to state updates for `id`. Returns an unsubscribe function. */
export function onStateUpdate(id: string, handler: (d: StateUpdateDetail) => void): () => void {
  if (typeof document === 'undefined') return () => {};
  const listener = (e: Event) => handler((e as CustomEvent<StateUpdateDetail>).detail);
  document.addEventListener(updateEvent(id), listener);
  return () => document.removeEventListener(updateEvent(id), listener);
}

/** Subscribe to error events for `id`. Returns an unsubscribe function. */
export function onError(id: string, handler: (d: ErrorDetail) => void): () => void {
  if (typeof document === 'undefined') return () => {};
  const listener = (e: Event) => handler((e as CustomEvent<ErrorDetail>).detail);
  document.addEventListener(errorEvent(id), listener);
  return () => document.removeEventListener(errorEvent(id), listener);
}

/** Build a state-update detail from a `StateVector`, copying its buffer. */
export function stateUpdateFrom(
  id: string,
  state: StateVector,
  metadata: { gatesApplied: string[]; step: number },
): StateUpdateDetail {
  return {
    id,
    stateVector: new Float64Array(state.data),
    qubits: state.qubits,
    metadata,
  };
}
