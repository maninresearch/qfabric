import { readFileSync } from 'node:fs';
import { unified } from '@astrojs/markdown-remark';
import remarkQFabric from '@qfabric/remark-plugin';
import { describe, expect, it, vi } from 'vitest';
import qfabric, { COMPONENT_IMPORTS, importsForTags } from './index.js';

type Stage = 'page' | 'page-ssr' | 'before-hydration' | 'head-inline';
type Markdown = { remarkPlugins?: unknown[]; processor?: unknown };

async function runSetup(options?: Parameters<typeof qfabric>[0], markdown: Markdown = {}) {
  const scripts: Array<[Stage, string]> = [];
  const updates: Array<{ markdown?: Markdown }> = [];
  const logs: string[] = [];
  await qfabric(options).hooks['astro:config:setup']?.({
    updateConfig: (c) => updates.push(c),
    injectScript: (stage, code) => scripts.push([stage, code]),
    config: { markdown: markdown as never },
    logger: { info: (m) => logs.push(m) },
  });
  return { scripts, updates, logs };
}

describe('qfabric() integration', () => {
  it('is named after the package', () => {
    expect(qfabric().name).toBe('@qfabric/astro');
  });

  it('injects tokens, fonts and the component runtime by default', async () => {
    const { scripts } = await runSetup();
    expect(scripts).toEqual([
      ['page-ssr', `import '@qfabric/core/styles/tokens.css';`],
      ['page-ssr', `import '@qfabric/astro/styles/fonts.css';`],
      ['page', `import '@qfabric/core';`],
    ]);
  });

  it('skips the fonts when loadFonts is false', async () => {
    const { scripts } = await runSetup({ loadFonts: false });
    expect(scripts.map(([, code]) => code)).not.toContain(
      `import '@qfabric/astro/styles/fonts.css';`,
    );
  });

  it('still loads the components when componentLoading is "auto"', async () => {
    const { scripts } = await runSetup({ componentLoading: 'auto' });
    expect(scripts).toContainEqual(['page', `import '@qfabric/core';`]);
  });
});

describe('remark plugin registration', () => {
  it('Astro 5 and 6: adds only its own entry, since updateConfig appends arrays', async () => {
    const other = () => {};
    const { updates } = await runSetup({ remark: {} }, { remarkPlugins: [other] });
    expect(updates).toEqual([{ markdown: { remarkPlugins: [[remarkQFabric, {}]] } }]);
  });

  it('Astro 7: switches the default processor to unified with the plugin', async () => {
    const satteri = { name: 'satteri', options: {}, createRenderer: async () => ({}) };
    const { updates, logs } = await runSetup({}, { processor: satteri });
    const processor = updates[0]?.markdown?.processor as ReturnType<typeof unified>;
    expect(processor.name).toBe('unified');
    expect(processor.options.remarkPlugins).toEqual([[remarkQFabric, {}]]);
    expect(logs[0]).toContain('"satteri"');
  });

  it('Astro 7: adds the plugin to an existing unified processor, once', async () => {
    const other = () => {};
    const processor = unified({ remarkPlugins: [other] });
    const first = await runSetup({}, { processor });
    await runSetup({}, { processor });
    expect(first.updates).toEqual([]);
    expect(processor.options.remarkPlugins).toEqual([other, [remarkQFabric, {}]]);
  });

  it('Astro 7: explains how to install @astrojs/markdown-remark when it is missing', async () => {
    vi.resetModules();
    vi.doMock('@astrojs/markdown-remark', () => {
      throw new Error('Cannot find package');
    });
    const { default: fresh } = await import('./index.js');
    const setup = fresh().hooks['astro:config:setup'];
    await expect(
      setup?.({
        updateConfig: () => {},
        injectScript: () => {},
        config: { markdown: { processor: { name: 'satteri' } } },
      }),
    ).rejects.toThrow('npm install @astrojs/markdown-remark');
    vi.doUnmock('@astrojs/markdown-remark');
  });
});

describe('component map', () => {
  const coreExports = Object.keys(
    JSON.parse(readFileSync(new URL('../../core/package.json', import.meta.url), 'utf8')).exports,
  );

  it('points every tag at a real @qfabric/core export', () => {
    for (const spec of Object.values(COMPONENT_IMPORTS)) {
      expect(coreExports).toContain(spec.replace(/^@qfabric\/core/, '.'));
    }
  });

  it('resolves used tags to unique imports and ignores unknown tags', () => {
    expect(importsForTags(['qf-probability', 'qf-probability', 'qf-unknown'])).toEqual([
      '@qfabric/core/probability',
    ]);
  });
});
