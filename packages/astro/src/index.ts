import remarkQFabric, { type RemarkQFabricOptions } from '@qfabric/remark-plugin';

/**
 * Minimal structural types for the Astro integration API. We keep `astro` a
 * peer dependency and avoid importing its types at build time so this package
 * compiles standalone.
 */
interface AstroIntegrationLike {
  name: string;
  hooks: {
    'astro:config:setup'?: (options: ConfigSetupOptions) => void | Promise<void>;
  };
}
interface ConfigSetupOptions {
  updateConfig: (config: Record<string, unknown>) => void;
  injectScript: (
    stage: 'page' | 'page-ssr' | 'before-hydration' | 'head-inline',
    code: string,
  ) => void;
  config: { markdown?: MarkdownConfigLike };
  logger?: { info: (message: string) => void };
}
/** `markdown` config: `remarkPlugins` on Astro 5 and 6, `processor` on Astro 7+. */
interface MarkdownConfigLike {
  remarkPlugins?: unknown[];
  processor?: { name: string; options?: { remarkPlugins?: unknown[] } };
}
type RemarkEntry = [typeof remarkQFabric, RemarkQFabricOptions];

export interface QFabricAstroOptions {
  /** Reserved for site-wide theming and not read yet. Pass `theme` to `BaseLayout`. */
  theme?: 'dark' | 'light' | 'auto';
  /** Load the self-hosted QFabric fonts at document level. Default true. */
  loadFonts?: boolean;
  /**
   * Per-page component loading. `all` (default) loads every component on every
   * page. `auto` is planned and currently behaves like `all`.
   */
  componentLoading?: 'all' | 'auto';
  remark?: RemarkQFabricOptions;
}

/**
 * The QFabric Astro integration. Registers the remark plugin, loads the design
 * tokens and fonts on every page, and adds the component runtime.
 */
export default function qfabric(options: QFabricAstroOptions = {}): AstroIntegrationLike {
  const { loadFonts = true } = options;

  return {
    name: '@qfabric/astro',
    hooks: {
      async 'astro:config:setup'({ updateConfig, injectScript, config, logger }) {
        // Register the remark plugin in the markdown pipeline.
        await registerRemarkPlugin(
          [remarkQFabric, options.remark ?? {}],
          config.markdown ?? {},
          updateConfig,
          logger,
        );

        // Load the design tokens and, unless disabled, the self-hosted fonts.
        injectScript('page-ssr', `import '@qfabric/core/styles/tokens.css';`);
        if (loadFonts) injectScript('page-ssr', `import '@qfabric/astro/styles/fonts.css';`);

        // Load the component runtime. Per-page loading (`auto`) isn't implemented,
        // so every mode loads all components.
        injectScript('page', `import '@qfabric/core';`);
      },
    },
  };
}

/**
 * Add the QFabric remark plugin to the site's markdown pipeline.
 *
 * - Astro 5 and 6: `markdown.remarkPlugins`. `updateConfig` appends arrays, so
 *   only our entry is passed.
 * - Astro 7+: remark plugins run on the `unified` processor from
 *   `@astrojs/markdown-remark`. If the site already uses it, the plugin is added
 *   to it; otherwise the processor is switched to `unified`, since QFabric
 *   directives are a remark extension.
 */
async function registerRemarkPlugin(
  entry: RemarkEntry,
  markdown: MarkdownConfigLike,
  updateConfig: ConfigSetupOptions['updateConfig'],
  logger: ConfigSetupOptions['logger'],
): Promise<void> {
  if (!('processor' in markdown)) {
    updateConfig({ markdown: { remarkPlugins: [entry] } });
    return;
  }

  const current = markdown.processor;
  const existing = current?.name === 'unified' ? current.options?.remarkPlugins : undefined;
  if (existing) {
    // Astro reads processor.options at render time, so adding in place works.
    const present = existing.some((p) => (Array.isArray(p) ? p[0] : p) === remarkQFabric);
    if (!present) existing.push(entry);
    return;
  }

  let unified: typeof import('@astrojs/markdown-remark').unified;
  try {
    ({ unified } = await import('@astrojs/markdown-remark'));
  } catch {
    throw new Error(
      'QFabric directives need the unified Markdown processor, which Astro 7 no longer ' +
        'installs by default. Install it with: npm install @astrojs/markdown-remark',
    );
  }
  updateConfig({ markdown: { processor: unified({ remarkPlugins: [entry] }) } });
  const previous = current?.name ?? 'the default';
  logger?.info(
    `Using the unified Markdown processor instead of "${previous}", because QFabric directives are a remark extension.`,
  );
}

export { COMPONENT_IMPORTS, importsForTags } from './component-map.js';
