import { type CSSResultGroup, css, html, nothing } from 'lit';
import { property } from 'lit/decorators.js';
import { QFStateElement } from '../../base/qf-state-element.js';
import { defineElement } from '../../base/register.js';
import type { Mode } from '../../base/types.js';
import { formatAmplitude, formatProbability } from '../../math/format.js';
import { basisLabel } from '../../math/measure.js';

/** Math-style text: italic `i`, true minus sign. */
function mathText(s: string): unknown[] {
  return s
    .replace(/-/g, '−')
    .split(/(i)/)
    .filter((part) => part !== '')
    .map((part) => (part === 'i' ? html`<i>i</i>` : part));
}

/** Coefficient for one term, without its sign. `1` is implied, fractions stack. */
function renderCoefficient(body: string): unknown {
  if (body === '1') return nothing;
  const frac = /^\((.+)\)\/(.+)$/.exec(body) ?? /^([^/()\s]+)\/([^/()\s]+)$/.exec(body);
  if (frac?.[1] && frac[2]) {
    return html`<span class="frac"><span>${mathText(frac[1])}</span><span>${mathText(frac[2])}</span></span>`;
  }
  // A complex coefficient with both parts reads as one factor in parentheses.
  if (/[+-]/.test(body.slice(1))) return html`(${mathText(body)})`;
  return mathText(body);
}

/** `0.5` → `50%`, `0.3333` → `33.3%`. */
function percent(p: number): string {
  return `${Math.round(p * 1000) / 10}%`;
}

/**
 * `<qf-state-vector>`: ket notation with per-basis amplitudes.
 *
 * Renders each non-trivial basis state as `amplitude · |index⟩`, with symbolic
 * amplitude formatting by default. Global phase is normalized so physically
 * equivalent states look identical, unless `show-global-phase`.
 */
export class QFStateVector extends QFStateElement {
  /** `symbolic` (default) or `decimal` amplitude display. */
  @property() accessor format: 'symbolic' | 'decimal' = 'symbolic';

  /** Decimal places in decimal mode. */
  @property({ type: Number }) accessor precision = 3;

  /** Show raw amplitudes without global-phase normalization. */
  @property({ attribute: 'show-global-phase', type: Boolean }) accessor showGlobalPhase = false;

  protected override supportedModes: Mode[] = ['static'];
  protected override componentLabel = 'State vector';

  static override styles: CSSResultGroup = [
    QFStateElement.styles,
    css`
      .math {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 2px 6px;
        font-family: var(--qf-font-math, 'STIX Two Text', 'Cambria Math', 'Times New Roman', serif);
        font-size: 23px;
        line-height: 1.3;
        color: var(--qf-ink, #16181d);
      }
      .term { display: inline-flex; align-items: center; gap: 3px; white-space: nowrap; }
      .op { color: var(--qf-ink-muted, #5c6370); padding: 0 2px; }
      .frac {
        display: inline-flex;
        flex-direction: column;
        align-items: center;
        font-size: 0.72em;
        line-height: 1.05;
      }
      .frac > span:first-child { border-bottom: 1px solid currentColor; padding: 0 0.2em 0.05em; }
      .frac > span:last-child { padding: 0.08em 0.2em 0; }
      .probs {
        font-size: var(--qf-text-xs, 12px);
        color: var(--qf-ink-muted, #5c6370);
        font-variant-numeric: tabular-nums;
      }
      .empty { color: var(--qf-ink-muted, #5c6370); font-style: italic; }
    `,
  ];

  /** Normalize the global phase: make the first non-zero amplitude real+positive. */
  private globalPhase(): { cos: number; sin: number } {
    if (this.showGlobalPhase) return { cos: 1, sin: 0 };
    const data = this.stateVector.data;
    for (let i = 0; i < this.stateVector.dim; i++) {
      const re = data[i * 2] ?? 0;
      const im = data[i * 2 + 1] ?? 0;
      const mag = Math.hypot(re, im);
      if (mag > 1e-9) {
        // Divide by e^{iφ} = (re+im i)/mag → multiply amplitudes by conj/mag.
        return { cos: re / mag, sin: -im / mag };
      }
    }
    return { cos: 1, sin: 0 };
  }

  protected renderState() {
    const sv = this.stateVector;
    const { cos, sin } = this.globalPhase();
    const terms: unknown[] = [];
    const probs: string[] = [];

    for (let i = 0; i < sv.dim; i++) {
      const p = sv.probability(i);
      if (p < 1e-12) continue;
      // Rotate amplitude by the global-phase correction.
      const re0 = sv.data[i * 2] ?? 0;
      const im0 = sv.data[i * 2 + 1] ?? 0;
      const re = re0 * cos - im0 * sin;
      const im = re0 * sin + im0 * cos;
      const amp = formatAmplitude({ re, im }, { format: this.format, precision: this.precision });
      const negative = amp.startsWith('-');
      const body = negative ? amp.slice(1) : amp;
      const label = basisLabel(i, sv.qubits);
      const prob = formatProbability(p, { format: this.format, precision: this.precision });
      const op = negative ? '−' : terms.length > 0 ? '+' : null;
      terms.push(html`
        ${op ? html`<span class="op">${op}</span>` : nothing}
        <span class="term" title=${`P = ${prob}`}>${renderCoefficient(body)}|${label}⟩</span>
      `);
      probs.push(`P(${label}) = ${percent(p)}`);
    }

    return html`
      <div class="math" aria-hidden="true">
        ${terms.length ? terms : html`<span class="empty">empty state</span>`}
      </div>
      ${probs.length > 1 && probs.length <= 4 ? html`<div class="probs" aria-hidden="true">${probs.join(' · ')}</div>` : nothing}
      <p class="qf-sr-only" aria-live="polite">${this.describe()}</p>
    `;
  }

  /** Screen-reader description, scaled by qubit count. */
  private describe(): string {
    const sv = this.stateVector;
    const entries = Array.from(sv.probabilities())
      .map((p, i) => ({ i, p }))
      .filter((e) => e.p > 1e-6)
      .sort((a, b) => b.p - a.p);
    if (entries.length === 1 && entries[0]) {
      return `State |${basisLabel(entries[0].i, sv.qubits)}⟩ with certainty.`;
    }
    const top = entries.slice(0, sv.qubits <= 2 ? entries.length : 4);
    const parts = top.map((e) => `${basisLabel(e.i, sv.qubits)} at ${(e.p * 100).toFixed(0)}%`);
    const prefix = sv.qubits <= 2 ? '' : `${sv.qubits}-qubit state. Highest: `;
    return `${prefix}${parts.join(', ')}.`;
  }
}

defineElement('qf-state-vector', QFStateVector);

declare global {
  interface HTMLElementTagNameMap {
    'qf-state-vector': QFStateVector;
  }
}
