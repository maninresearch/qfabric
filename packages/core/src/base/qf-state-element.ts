import { property } from 'lit/decorators.js';
import { parseCircuit, runCircuit } from '../math/circuit.js';
import { StateVector } from '../math/state-vector.js';
import { type StateUpdateDetail, onStateUpdate } from './bind.js';
import { QFElement } from './qf-element.js';

/**
 * Base for components that display a quantum state (`state-vector` and
 * `probability`). Resolves its state from, in priority order:
 *
 *   1. a live `bind` source, or
 *   2. the `state` ket attribute / `gates` sequence on a fresh |0…0⟩.
 *
 * Subclasses implement `renderState()` and may read `this.state`.
 */
export abstract class QFStateElement extends QFElement {
  /** Initial ket: `|0⟩`, `|+⟩`, `|01⟩`, … (defaults to `|0⟩`). */
  @property() accessor state = '|0⟩';

  /** Optional gate sequence applied to the initial state. */
  @property({ attribute: false }) accessor gates: string[] = [];

  /** Number of qubits when not implied by `state` (default 1). */
  @property({ type: Number }) accessor qubits = 1;

  /** The resolved live state vector driving the render. */
  protected stateVector: StateVector = StateVector.zero(1);

  private _unbind: (() => void) | null = null;

  override connectedCallback(): void {
    super.connectedCallback();
    this._recompute();
    this._subscribe();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this._unbind?.();
    this._unbind = null;
  }

  /**
   * Recompute before render, so the update that a `state`, `gates` or `bind`
   * change triggers draws the new state. (In `updated()` it would land one
   * render late.)
   */
  protected override willUpdate(changed: Map<string, unknown>): void {
    super.willUpdate(changed);
    if (changed.has('state') || changed.has('gates') || changed.has('bind')) this._recompute();
  }

  override updated(changed: Map<string, unknown>): void {
    super.updated(changed);
    if (changed.has('bind')) this._subscribe();
  }

  private _subscribe(): void {
    this._unbind?.();
    this._unbind = null;
    if (this.bind) {
      this._unbind = onStateUpdate(this.bind, (d) => this._onBound(d));
    }
  }

  private _onBound(detail: StateUpdateDetail): void {
    try {
      const next = new StateVector(detail.qubits, new Float64Array(detail.stateVector));
      const err = next.validate();
      if (err) {
        this.setWarning(err); // keep last valid state
        return;
      }
      this.stateVector = next;
      this.setWarning(null);
      this.requestUpdate();
    } catch (e) {
      this.setWarning(String(e));
    }
  }

  private _recompute(): void {
    if (this.bind) return; // bound state wins; ignore static attrs
    try {
      let sv = StateVector.fromKet(this.state);
      if (this.gates.length) sv = runCircuit(sv.qubits, parseCircuit(this.gates), sv);
      this.stateVector = sv;
      this.setWarning(null);
    } catch (e) {
      this.setWarning(String(e));
    }
  }

  protected override componentMeta(): string {
    const n = this.stateVector.qubits;
    return `${n} qubit${n === 1 ? '' : 's'}`;
  }
}
