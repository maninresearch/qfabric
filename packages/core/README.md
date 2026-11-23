# qfabric

The QFabric engine: framework-agnostic web components (Lit 3 and Shadow DOM) and
a quantum state-vector math engine.

> Pre-1.0: the API may change between minor versions.

## Install

```bash
npm install qfabric
```

## Components

Import only the components you use:

```js
import 'qfabric/state-vector';
import 'qfabric/probability';
```

```html
<qf-state-vector state="|+⟩"></qf-state-vector>
<qf-probability state="|+⟩"></qf-probability>
```

Or register everything at once:

```js
import 'qfabric';
```

| Element | Shows | Useful attributes |
| --- | --- | --- |
| `<qf-state-vector>` | The state in ket notation, with stacked symbolic amplitudes | `state`, `format` (`symbolic` or `decimal`), `precision`, `show-global-phase`, `show-label` |
| `<qf-probability>` | A bar chart of measurement probabilities | `state`, `show-all`, `top-n`, `show-label` |

`show-label` adds a caption row with the component name and qubit count.

## Math engine

The math engine has no DOM dependencies and is exported on its own:

```js
import { runCircuit, parseCircuit, measure } from 'qfabric/math';

const bell = runCircuit(2, parseCircuit(['H 0', 'CNOT 0 1']));
bell.probabilities(); // Float64Array [0.5, 0, 0, 0.5]
measure(bell).bitstring; // "00" or "11"
```

## Theming

Components read `--qf-*` CSS custom properties and fall back to built-in values,
so they render without any stylesheet. For the full design (page typography,
light and dark themes) load the tokens once at the document level:

```js
import 'qfabric/styles/tokens.css';
```

Light is the default. Set `data-theme="dark"` on `<html>` (or any ancestor) for
dark, or leave it unset to follow the reader's system setting. The tokens file
loads no fonts. It names Instrument Sans, STIX Two Text and JetBrains Mono, with
system fallbacks; `@qfabric/astro` self-hosts all three.

## License

Apache-2.0
