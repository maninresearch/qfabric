# @qfabric/astro

The Astro integration for QFabric. It registers the remark plugin, loads the
design tokens and self-hosted fonts, and adds the component runtime to every page,
so a folder of markdown lessons becomes an interactive site.

> Pre-1.0: the API may change between minor versions.

## Install

Works with Astro 5, 6 and 7.

```bash
npm install @qfabric/core @qfabric/astro
```

On Astro 7, also install the remark-based Markdown processor. Astro 7 no longer
includes it by default, and QFabric directives are a remark extension:

```bash
npm install @astrojs/markdown-remark
```

The integration switches `markdown.processor` to `unified()` for you, or adds its
plugin to your `unified()` processor if you already set one.

## Usage

```js
// astro.config.mjs
import { defineConfig } from 'astro/config';
import qfabric from '@qfabric/astro';

export default defineConfig({
  integrations: [qfabric()],
});
```

Wrap pages in the base layout:

```astro
---
import BaseLayout from '@qfabric/astro/layouts/BaseLayout.astro';
---
<BaseLayout title="Superposition">
  <slot />
</BaseLayout>
```

`BaseLayout` takes `title`, `description` and `theme` (`light` by default, `dark`,
or `auto` to follow the reader's system setting).

Web components upgrade themselves when their script loads, so no `client:*`
directives are needed.

## Options

| Option | Default | Description |
| --- | --- | --- |
| `loadFonts` | `true` | Load the self-hosted fonts (Instrument Sans, STIX Two Text, JetBrains Mono). No requests go to third parties. |
| `componentLoading` | `'all'` | Loads every component on every page. Per-page loading (`'auto'`) is planned; for now it also loads every component. |
| `remark` | `{}` | Options passed to `@qfabric/remark-plugin`. |

## License

Apache-2.0
