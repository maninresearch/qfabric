# @qfabric/remark-plugin

## 0.1.0

### Minor Changes

- 52d8580: First public release.

  - `qfabric`: a quantum state-vector math engine (`qfabric/math`) with
    single-, two- and three-qubit gates, parameterized rotations, circuit parsing,
    measurement and symbolic amplitude formatting; the `<qf-state-vector>` and
    `<qf-probability>` web components; and light and dark design tokens.
  - `@qfabric/remark-plugin`: turns `:::component` markdown blocks into `<qf-*>`
    tags, with validated directive names, YAML parameters parsed safely and
    `:::row` / `:::grid` layouts.
  - `@qfabric/astro`: an Astro integration that registers the plugin and loads the
    tokens, self-hosted fonts and components. Works with Astro 5, 6 and 7.
