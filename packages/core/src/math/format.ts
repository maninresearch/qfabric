import type { Complex } from './complex.js';

const TOL = 1e-9;

export interface FormatOptions {
  /** `symbolic` (default) recognizes common values; `decimal` always numeric. */
  format?: 'symbolic' | 'decimal';
  /** Decimal places when falling back to numeric (default 3). */
  precision?: number;
}

/** Known positive real magnitudes recognized in symbolic mode. */
const REAL_CONSTANTS: Array<{ value: number; label: string }> = [
  { value: 1, label: '1' },
  { value: Math.SQRT1_2, label: '1/√2' },
  { value: 0.5, label: '1/2' },
  { value: Math.sqrt(3) / 2, label: '√3/2' },
  { value: 1 / Math.sqrt(3), label: '1/√3' },
];

const approx = (a: number, b: number): boolean => Math.abs(a - b) < TOL;

/** Match `x` against a recognized real constant, returning a signed label. */
function matchReal(x: number, precision: number): string {
  if (approx(x, 0)) return '0';
  const sign = x < 0 ? '-' : '';
  const abs = Math.abs(x);
  for (const { value, label } of REAL_CONSTANTS) {
    if (approx(abs, value)) return sign + label;
  }
  return x.toFixed(precision);
}

/**
 * Format a complex amplitude. In symbolic mode (default) recognizes exact
 * values (`0`, `1`, `-1`, `i`, `-i`), common reals (`1/√2`, `1/2`, `√3/2`,
 * `1/√3`), and common imaginaries (`i/√2`); everything else falls back to a
 * fixed number of decimal places.
 */
export function formatAmplitude(z: Complex, opts: FormatOptions = {}): string {
  const precision = opts.precision ?? 3;
  const { re, im } = z;

  if (opts.format === 'decimal') {
    if (approx(im, 0)) return re.toFixed(precision);
    if (approx(re, 0)) return `${im.toFixed(precision)}i`;
    const sign = im < 0 ? '-' : '+';
    return `${re.toFixed(precision)}${sign}${Math.abs(im).toFixed(precision)}i`;
  }

  const reZero = approx(re, 0);
  const imZero = approx(im, 0);

  if (reZero && imZero) return '0';

  // Pure real.
  if (imZero) return matchReal(re, precision);

  // Pure imaginary: reuse real matching on the coefficient.
  if (reZero) {
    const coeff = matchReal(im, precision);
    if (coeff === '1') return 'i';
    if (coeff === '-1') return '-i';
    // `1/√2` → `i/√2`, `-1/√2` → `-i/√2`; a bare number → `0.333i`.
    if (coeff.includes('/')) {
      const negative = coeff.startsWith('-');
      const body = negative ? coeff.slice(1) : coeff;
      return `${negative ? '-' : ''}i/${body.split('/')[1]}`;
    }
    return `${coeff}i`;
  }

  // Recognize (1+i)/2 and (1-i)/2.
  if (approx(Math.abs(re), 0.5) && approx(Math.abs(im), 0.5)) {
    const a = re < 0 ? '-1' : '1';
    const b = im < 0 ? '-i' : '+i';
    return `(${a}${b})/2`;
  }

  // General complex: re ± |im| i, each part symbolic.
  const reStr = matchReal(re, precision);
  const imAbs = matchReal(Math.abs(im), precision);
  const sign = im < 0 ? '-' : '+';
  const imStr = imAbs === '1' ? 'i' : `${imAbs}i`;
  return `${reStr} ${sign} ${imStr}`;
}

/** Format a probability as `fraction (percentage)` where recognizable. */
export function formatProbability(p: number, opts: FormatOptions = {}): string {
  const precision = opts.precision ?? 3;
  const pct = `${(p * 100).toFixed(p > 0 && p < 0.001 ? 2 : 1)}%`;
  if (opts.format === 'decimal') return `${p.toFixed(precision)} (${pct})`;
  if (approx(p, 0)) return '0';
  if (approx(p, 1)) return '1 (100%)';
  if (approx(p, 0.5)) return '1/2 (50%)';
  if (approx(p, 0.25)) return '1/4 (25%)';
  if (approx(p, 1 / 3)) return '1/3 (33.3%)';
  return `${p.toFixed(precision)} (${pct})`;
}
