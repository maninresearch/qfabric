# @qfabric/remark-plugin

The markdown authoring layer for QFabric. Turns `:::component` blocks with YAML
parameters into QFabric `<qf-*>` web component tags.

> Pre-1.0: the API may change between minor versions.

It does **not** use `remark-directive`. A custom micromark extension captures
each block's body as raw text, so YAML colons, brackets and pipes are never
mangled.

## Install

```bash
npm install @qfabric/remark-plugin
```

## Usage

```js
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import rehypeStringify from 'rehype-stringify';
import remarkQFabric from '@qfabric/remark-plugin';

const html = String(
  await unified()
    .use(remarkParse)
    .use(remarkQFabric)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeStringify, { allowDangerousHtml: true })
    .process('# Demo\n\n:::probability\nstate: "|+⟩"\n:::\n'),
);
```

Authors write:

```markdown
:::state-vector
state: "|+⟩"
format: decimal
:::
```

…and get `<qf-state-vector state="|+⟩" format="decimal"></qf-state-vector>`.

The plugin maps any `:::name` block to a `<qf-name>` tag; the components
themselves come from `@qfabric/core`. `:::row` and `:::grid` lay out the component
blocks directly after them side by side. The group ends at the first line of
ordinary markdown.

Most sites should use [`@qfabric/astro`](../astro), which wires this plugin into
an Astro project.

## Security

YAML is parsed only with `JSON_SCHEMA` (no code execution), directive names are
validated, attribute values are HTML-escaped, and config objects are stripped of
prototype-pollution keys. See the repository's `SECURITY.md`.

## License

Apache-2.0
