import { type CSSResultGroup, css, html, nothing, svg } from 'lit';
import { property } from 'lit/decorators.js';
import { QFStateElement } from '../../base/qf-state-element.js';
import { defineElement } from '../../base/register.js';
import type { Mode } from '../../base/types.js';
import { basisLabel } from '../../math/measure.js';

interface Bar {
  index: number;
  label: string;
  prob: number;
}

/** `0.5` → `50%`, `0.3333` → `33.3%`. */
function percent(p: number): string {
  return `${Math.round(p * 1000) / 10}%`;
}

/**
 * `<qf-probability>`: measurement-probability bar chart.
 *
 * Auto-scales display by qubit count: 1–4 qubits show every basis state
 * (including zeros); 5–8 show non-zero states sorted descending; 9+ show the
 * top 16 plus an "and N others" summary. Overridable via `show-all` / `top-n`.
 */
export class QFProbability extends QFStateElement {
  /** Force showing all basis states regardless of qubit count. */
  @property({ attribute: 'show-all', type: Boolean }) accessor showAll = false;

  /** Cap the number of bars shown. */
  @property({ attribute: 'top-n', type: Number }) accessor topN = 0;

  protected override supportedModes: Mode[] = ['static'];
  protected override componentLabel = 'Measurement probability';

  static override styles: CSSResultGroup = [
    QFStateElement.styles,
    css`
      svg { width: 100%; height: auto; display: block; overflow: visible; }
      .bar {
        fill: var(--qf-accent, #1f4e9c);
        transition:
          height var(--qf-duration, 150ms) var(--qf-ease, ease-out),
          y var(--qf-duration, 150ms) var(--qf-ease, ease-out);
      }
      .stub { fill: var(--qf-line, #e2e5ea); }
      .grid { stroke: var(--qf-line, #e2e5ea); stroke-width: 1; }
      .base { stroke: var(--qf-ink-faint, #8a909b); stroke-width: 1; }
      .ytick {
        font-family: var(--qf-font-sans, system-ui, sans-serif);
        font-size: 10.5px;
        fill: var(--qf-ink-faint, #8a909b);
        font-variant-numeric: tabular-nums;
      }
      .pval {
        font-family: var(--qf-font-sans, system-ui, sans-serif);
        font-size: 11.5px;
        font-weight: 500;
        fill: var(--qf-ink, #16181d);
        font-variant-numeric: tabular-nums;
      }
      .blabel {
        font-family: var(--qf-font-math, 'STIX Two Text', 'Cambria Math', serif);
        fill: var(--qf-ink-muted, #5c6370);
      }
      .summary {
        font-size: var(--qf-text-xs, 12px);
        color: var(--qf-ink-muted, #5c6370);
      }
      @media (prefers-reduced-motion: reduce) {
        .bar { transition: none; }
      }
    `,
  ];

  /** Decide which bars to render given qubit count + overrides. */
  private selectBars(): { bars: Bar[]; total: number; hidden: number } {
    const sv = this.stateVector;
    const probs = sv.probabilities();
    const all: Bar[] = Array.from(probs).map((prob, index) => ({
      index,
      prob,
      label: basisLabel(index, sv.qubits),
    }));
    const total = all.length;
    const n = sv.qubits;

    if (this.topN > 0) {
      const sorted = [...all].sort((a, b) => b.prob - a.prob).slice(0, this.topN);
      return { bars: sorted, total, hidden: total - sorted.length };
    }
    if (this.showAll || n <= 4) {
      return { bars: all, total, hidden: 0 };
    }
    if (n <= 8) {
      const nonZero = all.filter((b) => b.prob > 1e-9).sort((a, b) => b.prob - a.prob);
      return { bars: nonZero, total, hidden: total - nonZero.length };
    }
    const top = [...all].sort((a, b) => b.prob - a.prob).slice(0, 16);
    return { bars: top, total, hidden: total - top.length };
  }

  protected renderState() {
    const { bars, total, hidden } = this.selectBars();
    const W = 400;
    const H = 200;
    const left = 36; // room for the 100% / 50% / 0 scale
    const right = 8;
    const top = 16;
    const base = 168;
    const plotH = base - top;
    const n = bars.length || 1;
    const slot = (W - left - right) / n;
    // Bars keep a sensible width instead of stretching to fill one or two slots.
    const bw = Math.max(2, Math.min(48, slot * 0.6));
    const showValues = bw >= 18;
    const labelSize = n <= 4 ? 15 : n <= 8 ? 12 : 10;
    const showLabels = slot >= labelSize * 1.6;

    const rects = bars.map((b, i) => {
      const cx = left + slot * i + slot / 2;
      const x = cx - bw / 2;
      const h = b.prob * plotH;
      const y = base - h;
      const pct = percent(b.prob);
      return svg`
        <g>
          <title>|${b.label}⟩ ${pct}</title>
          ${
            b.prob > 1e-9
              ? svg`<rect class="bar" x=${x} y=${y} width=${bw} height=${h} rx="1"></rect>`
              : svg`<rect class="stub" x=${x} y=${base - 2} width=${bw} height="2"></rect>`
          }
          ${showValues && b.prob > 0.005 ? svg`<text class="pval" x=${cx} y=${y - 7} text-anchor="middle">${pct}</text>` : nothing}
          ${showLabels ? svg`<text class="blabel" x=${cx} y=${base + 22} font-size=${labelSize} text-anchor="middle">|${b.label}⟩</text>` : nothing}
        </g>
      `;
    });

    return html`
      <svg viewBox="0 0 ${W} ${H}" role="img" aria-label=${this.describe()}>
        <line class="grid" x1=${left} y1=${top} x2=${W - right} y2=${top}></line>
        <line class="grid" x1=${left} y1=${top + plotH / 2} x2=${W - right} y2=${top + plotH / 2}></line>
        <text class="ytick" x=${left - 6} y=${top + 4} text-anchor="end">100%</text>
        <text class="ytick" x=${left - 6} y=${top + plotH / 2 + 4} text-anchor="end">50%</text>
        <text class="ytick" x=${left - 6} y=${base + 4} text-anchor="end">0</text>
        ${rects}
        <line class="base" x1=${left} y1=${base} x2=${W - right} y2=${base}></line>
      </svg>
      ${
        hidden > 0
          ? html`<div class="summary">Showing ${bars.length} of ${total} basis states</div>`
          : nothing
      }
    `;
  }

  private describe(): string {
    const sv = this.stateVector;
    const entries = Array.from(sv.probabilities())
      .map((p, i) => ({ i, p }))
      .filter((e) => e.p > 1e-6)
      .sort((a, b) => b.p - a.p);
    if (!entries.length) return 'No measurable outcomes.';
    const top = entries
      .slice(0, 4)
      .map((e) => `${basisLabel(e.i, sv.qubits)} ${(e.p * 100).toFixed(0)}%`);
    return `Measurement probabilities. ${top.join(', ')}.`;
  }
}

defineElement('qf-probability', QFProbability);

declare global {
  interface HTMLElementTagNameMap {
    'qf-probability': QFProbability;
  }
}
