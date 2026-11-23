#!/usr/bin/env node
/**
 * Smoke test for the built example site (run `pnpm smoke`, which builds it
 * first). Checks the output a reader would get: directives became components,
 * layout rows close where they should, the runtime and styles are bundled, and
 * nothing is fetched from a third party.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = resolve(dirname(fileURLToPath(import.meta.url)), '../examples/dist');
const failures = [];
const check = (ok, message) => {
  if (!ok) failures.push(message);
};

const lesson = readFileSync(join(dist, 'lessons/superposition/index.html'), 'utf8');
const assets = readdirSync(join(dist, '_astro'));
const read = (name) => readFileSync(join(dist, '_astro', name), 'utf8');
const css = assets
  .filter((f) => f.endsWith('.css'))
  .map(read)
  .join('\n');
const js = assets
  .filter((f) => f.endsWith('.js'))
  .map(read)
  .join('\n');

// Directives were transformed.
check(lesson.includes('<qf-state-vector'), 'lesson has no <qf-state-vector>');
check(lesson.includes('<qf-probability'), 'lesson has no <qf-probability>');
check(!lesson.includes(':::'), 'raw ":::" directive text leaked into the lesson');
check(!lesson.includes('qf-error'), 'lesson contains a directive error card');

// The row holds only components, and the prose after it stays outside.
const row = /<div class="qf-row">([\s\S]*?)<\/div>/.exec(lesson);
check(row, 'lesson has no .qf-row');
if (row) {
  const inner = row[1].replace(/<qf-[a-z-]+[^>]*><\/qf-[a-z-]+>/g, '').trim();
  check(inner === '', `.qf-row contains non-component content: ${inner.slice(0, 80)}`);
}

// Runtime, tokens and fonts are bundled.
check(js.includes('qf-state-vector'), 'component runtime is not bundled');
check(css.includes('--qf-paper'), 'design tokens are not bundled');
check(/font-family:\s*["']?Instrument Sans Variable/.test(css), 'Instrument Sans is not bundled');

// No third-party requests.
for (const [name, text] of [
  ['lesson HTML', lesson],
  ['CSS', css],
]) {
  check(!/fonts\.(googleapis|gstatic)\.com/.test(text), `${name} references Google Fonts`);
}
const external = [...lesson.matchAll(/<(?:script|link)[^>]+(?:src|href)="(https?:)?\/\/[^"]+"/g)];
check(
  external.length === 0,
  `lesson loads external resources: ${external.map((m) => m[0]).join(', ')}`,
);

if (failures.length) {
  console.error(`Smoke test failed:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log('Smoke test passed: example site output looks right.');
