#!/usr/bin/env node
/**
 * Generates the README preview images from the real qfabric math engine,
 * so the picture in the docs can never drift from what the components compute.
 *
 * The amplitude strings, probabilities, bar heights and basis labels below all
 * come from `qfabric/math`; only the figure chrome is layout. It writes a
 * light and a dark variant for GitHub's `<picture>` theme switching. Run after
 * building core:
 *
 *   pnpm --filter qfabric build && node scripts/gen-readme-assets.mjs
 *   (or: pnpm gen:assets)
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { StateVector, basisLabel, formatAmplitude } from '../packages/core/dist/math/index.js';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(here, '../assets');

/** Same values as `packages/core/styles/tokens.css`. */
const THEMES = {
  light: {
    paper: '#FCFCFD',
    surface: '#FFFFFF',
    line: '#E2E5EA',
    ink: '#16181D',
    muted: '#5C6370',
    faint: '#8A909B',
    accent: '#1F4E9C',
  },
  dark: {
    paper: '#101216',
    surface: '#15181D',
    line: '#2A2F37',
    ink: '#E7E9ED',
    muted: '#9BA1AC',
    faint: '#6F7580',
    accent: '#8FB0F0',
  },
};

const SANS = 'Instrument Sans, Segoe UI, system-ui, sans-serif';
const MATH = 'STIX Two Text, Cambria Math, Times New Roman, serif';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const percent = (p) => `${Math.round(p * 1000) / 10}%`;
const display = (s) => s.replace(/-/g, '−');

/** Pull the same display data a <qf-state-vector> / <qf-probability> would. */
function describe(ketLabel) {
  const sv = StateVector.fromKet(ketLabel);
  const terms = [];
  for (let i = 0; i < sv.dim; i++) {
    const p = sv.probability(i);
    if (p < 1e-12) continue;
    terms.push({
      amp: formatAmplitude(sv.amplitude(i), { format: 'symbolic' }),
      label: basisLabel(i, sv.qubits),
      prob: p,
    });
  }
  const bars = Array.from(sv.probabilities()).map((prob, i) => ({
    label: basisLabel(i, sv.qubits),
    prob,
  }));
  return { qubits: sv.qubits, terms, bars };
}

/** Width estimate for serif math glyphs at a given size. */
const mathWidth = (text, size) => [...text].length * size * 0.5;

/** One state-vector term: optional stacked fraction, then the ket. */
function termSvg(body, label, startX, cy, t) {
  const parts = [];
  let x = startX;
  const frac = /^([^/()\s]+)\/([^/()\s]+)$/.exec(body);
  if (frac) {
    const [, num, den] = frac;
    const size = 16.5;
    const w = Math.max(mathWidth(num, size), mathWidth(den, size)) + 6;
    const mid = x + w / 2;
    parts.push(
      `<text x="${mid}" y="${cy - 5}" text-anchor="middle" font-size="${size}">${esc(display(num))}</text>`,
      `<line x1="${x}" y1="${cy}" x2="${x + w}" y2="${cy}" stroke="${t.ink}" stroke-width="1"></line>`,
      `<text x="${mid}" y="${cy + 17}" text-anchor="middle" font-size="${size}">${esc(display(den))}</text>`,
    );
    x += w + 4;
  } else if (body !== '1') {
    parts.push(`<text x="${x}" y="${cy + 8}" font-size="23">${esc(display(body))}</text>`);
    x += mathWidth(body, 23) + 4;
  }
  const ket = `|${label}⟩`;
  parts.push(`<text x="${x}" y="${cy + 8}" font-size="23">${esc(ket)}</text>`);
  x += mathWidth(ket, 23) + 4;
  return { svg: parts.join(''), x };
}

function figure(x, name, meta, body, t) {
  return `
  <g transform="translate(${x}, 30)">
    <rect x="0.5" y="0.5" width="401" height="219" rx="6" fill="${t.surface}" stroke="${t.line}"></rect>
    ${body}
    <line x1="1" y1="183.5" x2="401" y2="183.5" stroke="${t.line}"></line>
    <text x="12" y="206" font-family="${SANS}" font-size="12" font-weight="600" fill="${t.ink}">${esc(name)}</text>
    <text x="390" y="206" text-anchor="end" font-family="${SANS}" font-size="12" fill="${t.muted}">${esc(meta)}</text>
  </g>`;
}

function buildSvg(ketLabel, t) {
  const { qubits, terms, bars } = describe(ketLabel);
  const meta = `${qubits} qubit${qubits === 1 ? '' : 's'}`;

  // Left figure: state vector
  const cy = 84;
  let x = 24;
  const math = [];
  terms.forEach((term, idx) => {
    const negative = term.amp.startsWith('-');
    const body = negative ? term.amp.slice(1) : term.amp;
    const op = negative ? '−' : idx > 0 ? '+' : null;
    if (op) {
      math.push(`<text x="${x + 4}" y="${cy + 8}" font-size="23" fill="${t.muted}">${op}</text>`);
      x += 30;
    }
    const out = termSvg(body, term.label, x, cy, t);
    math.push(out.svg);
    x = out.x + 6;
  });
  const probLine = terms.map((term) => `P(${term.label}) = ${percent(term.prob)}`).join(' · ');
  const stateBody = `
    <g font-family="${MATH}" fill="${t.ink}">${math.join('')}</g>
    <text x="24" y="${cy + 50}" font-family="${SANS}" font-size="12" fill="${t.muted}">${esc(probLine)}</text>`;

  // Right figure: measurement probability
  const left = 52;
  const right = 386;
  const top = 22;
  const base = 150;
  const plotH = base - top;
  const slot = (right - left) / bars.length;
  const bw = Math.min(48, slot * 0.6);
  const grid = [top, top + plotH / 2]
    .map((y) => `<line x1="${left}" y1="${y}" x2="${right}" y2="${y}" stroke="${t.line}"></line>`)
    .join('');
  const ticks = [
    [top, '100%'],
    [top + plotH / 2, '50%'],
    [base, '0'],
  ]
    .map(
      ([y, s]) =>
        `<text x="${left - 6}" y="${y + 4}" text-anchor="end" font-family="${SANS}" font-size="10.5" fill="${t.faint}">${s}</text>`,
    )
    .join('');
  const barSvg = bars
    .map((b, i) => {
      const cx = left + slot * i + slot / 2;
      const h = b.prob * plotH;
      const shape =
        b.prob > 1e-9
          ? `<rect x="${(cx - bw / 2).toFixed(1)}" y="${(base - h).toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" rx="1" fill="${t.accent}"></rect>
      <text x="${cx.toFixed(1)}" y="${(base - h - 7).toFixed(1)}" text-anchor="middle" font-family="${SANS}" font-size="11.5" font-weight="500" fill="${t.ink}">${percent(b.prob)}</text>`
          : `<rect x="${(cx - bw / 2).toFixed(1)}" y="${base - 2}" width="${bw.toFixed(1)}" height="2" fill="${t.line}"></rect>`;
      return `
      ${shape}
      <text x="${cx.toFixed(1)}" y="${base + 22}" text-anchor="middle" font-family="${MATH}" font-size="15" fill="${t.muted}">|${esc(b.label)}⟩</text>`;
    })
    .join('');
  const probBody = `
    ${grid}${ticks}${barSvg}
    <line x1="${left}" y1="${base}" x2="${right}" y2="${base}" stroke="${t.faint}"></line>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="280" viewBox="0 0 900 280" fill="none" role="img" aria-label="Rendered output of QFabric components for the ${esc(ketLabel)} state. Generated from qfabric.">
  <rect x="0.5" y="0.5" width="899" height="279" rx="12" fill="${t.paper}" stroke="${t.line}"></rect>
  <!-- <qf-state-vector state="${esc(ketLabel)}" show-label> -->${figure(30, 'State vector', meta, stateBody, t)}
  <!-- <qf-probability state="${esc(ketLabel)}" show-label> -->${figure(468, 'Measurement probability', meta, probBody, t)}
</svg>
`;
}

mkdirSync(outDir, { recursive: true });
for (const [name, theme] of Object.entries(THEMES)) {
  const file = resolve(
    outDir,
    name === 'light' ? 'example-preview.svg' : 'example-preview-dark.svg',
  );
  writeFileSync(file, buildSvg('|+⟩', theme).replace(/[ \t]+$/gm, ''));
  console.log(`Wrote ${file} from qfabric math engine output.`);
}
