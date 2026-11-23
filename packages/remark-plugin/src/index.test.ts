import rehypeStringify from 'rehype-stringify';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { unified } from 'unified';
import { describe, expect, it } from 'vitest';
import remarkQFabric from './index.js';
import { buildComponentTag, parseDirectiveYaml, sanitize } from './transform.js';

function render(md: string): { html: string; components: Set<string> } {
  const components = new Set<string>();
  const file = unified()
    .use(remarkParse)
    .use(remarkQFabric, {
      onComponentsUsed: (c) => {
        for (const tag of c) components.add(tag);
      },
    })
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeStringify, { allowDangerousHtml: true })
    .processSync(md);
  return { html: String(file), components };
}

describe('directive parsing to HTML', () => {
  it('transforms a simple directive into a qf- tag', () => {
    const { html, components } = render(':::bloch-sphere\nstate: "|+⟩"\n:::\n');
    expect(html).toContain('<qf-bloch-sphere');
    expect(html).toContain('state="|+⟩"');
    expect(components.has('qf-bloch-sphere')).toBe(true);
  });

  it('emits boolean params as bare attributes', () => {
    const { html } = render(':::circuit\nqubits: 2\nbuilder: true\n:::\n');
    expect(html).toContain('qubits="2"');
    expect(html).toMatch(/<qf-circuit[^>]*\sbuilder(\s|>)/);
  });

  it('bundles nested params into a JSON config attribute', () => {
    const { html } = render(
      ':::bloch-sphere\nshow:\n  axes: true\n  trail: true\ncolors:\n  vector: "#ff6b6b"\n:::\n',
    );
    expect(html).toContain('config=');
    expect(html).toContain('&quot;axes&quot;:true');
    expect(html).toContain('&quot;vector&quot;:&quot;#ff6b6b&quot;');
  });

  it('comma-joins array toolbox into an attribute', () => {
    const { html } = render(':::circuit\ntoolbox: [H, X, CNOT]\n:::\n');
    expect(html).toContain('toolbox="H,X,CNOT"');
  });

  it('works with zero params', () => {
    const { html } = render(':::bloch-sphere\n:::\n');
    expect(html).toContain('<qf-bloch-sphere></qf-bloch-sphere>');
  });

  it('keeps YAML colons and brackets intact', () => {
    const { html } = render(':::state-vector\nstate: "|0⟩"\nformat: symbolic\n:::\n');
    expect(html).toContain('format="symbolic"');
    expect(html).not.toContain('<dl>'); // no definition-list mangling
  });

  it('leaves surrounding markdown intact', () => {
    const { html } = render('# Title\n\nText before.\n\n:::probability\n:::\n\nText after.\n');
    expect(html).toContain('<h1>Title</h1>');
    expect(html).toContain('<qf-probability></qf-probability>');
    expect(html).toContain('Text after.');
  });
});

describe('layout directives', () => {
  it('wraps a row of components in a div.qf-row', () => {
    const md = ':::row\n\n:::bloch-sphere\n:::\n\n:::probability\n:::\n';
    const { html } = render(md);
    expect(html).toContain('<div class="qf-row">');
    expect(html).toContain('<qf-bloch-sphere>');
    expect(html).toContain('<qf-probability>');
    expect(html.match(/<\/div>/g)?.length).toBe(1);
  });

  it('closes the row at the first non-component content', () => {
    const md =
      ':::row\n\n:::state-vector\n:::\n\n:::probability\n:::\n\nAfter the row.\n\n## Heading\n\n:::state-vector\n:::\n';
    const { html } = render(md);
    const rowEnd = html.indexOf('</div>');
    expect(rowEnd).toBeGreaterThan(html.indexOf('<qf-probability>'));
    expect(rowEnd).toBeLessThan(html.indexOf('After the row.'));
    expect(html.slice(rowEnd)).toContain('<h2>Heading</h2>');
    expect(html.match(/<qf-state-vector>/g)?.length).toBe(2);
  });

  it('starts a new group at each layout marker', () => {
    const md = ':::row\n\n:::probability\n:::\n\n:::grid\n\n:::probability\n:::\n';
    const { html } = render(md);
    expect(html).toMatch(/<div class="qf-row">\s*<qf-probability><\/qf-probability>\s*<\/div>/);
    expect(html).toMatch(/<div class="qf-grid">\s*<qf-probability><\/qf-probability>\s*<\/div>/);
  });

  it('drops an empty layout marker instead of leaving an open div', () => {
    const { html } = render(':::row\n\nJust text.\n');
    expect(html).not.toContain('qf-row');
    expect(html).toContain('Just text.');
  });
});

describe('directive names', () => {
  it('turns an injection attempt in the name into an escaped error card', () => {
    const { html, components } = render(':::x><script>alert(1)</script>\nstate: "|0⟩"\n:::\n');
    expect(html).not.toContain('<script>');
    expect(html).not.toMatch(/<qf-x/);
    expect(html).toContain('qf-error');
    expect(html).toContain('&lt;script&gt;');
    expect(components.size).toBe(0);
  });

  it('rejects a directive with no name', () => {
    const { html } = render(':::\nstate: "|0⟩"\n:::\n');
    expect(html).not.toContain('<qf->');
    expect(html).toContain('missing a name');
  });

  it.each(['-x', 'x-', 'state--vector', '1qubit', 'x_y', 'bloch.sphere', 'a"b'])(
    'rejects ":::%s"',
    (name) => {
      expect(() => buildComponentTag(name, {})).toThrow(/Invalid directive name/);
    },
  );

  it('accepts lowercase names with digits and single hyphens', () => {
    expect(buildComponentTag('state-vector', {}).tag).toBe('qf-state-vector');
    expect(buildComponentTag('q2-sphere', {}).tag).toBe('qf-q2-sphere');
  });

  it('normalizes the name to lowercase', () => {
    const { html, components } = render(':::State-Vector\n:::\n');
    expect(html).toContain('<qf-state-vector></qf-state-vector>');
    expect([...components]).toEqual(['qf-state-vector']);
  });

  it('escapes quotes and ampersands in error cards', () => {
    const { html } = render(':::a"b&c\n:::\n');
    expect(html).toContain('a&quot;b&amp;c');
    expect(html).not.toContain('a"b&c');
  });
});

describe('security', () => {
  it('rejects !!js/function YAML tags', () => {
    expect(() => parseDirectiveYaml('evil: !!js/function "function(){return 1}"')).toThrow();
  });

  it('strips prototype-pollution keys', () => {
    const cleaned = sanitize(JSON.parse('{"__proto__":{"polluted":true},"safe":1}')) as Record<
      string,
      unknown
    >;
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(cleaned.safe).toBe(1);
    expect(Object.getPrototypeOf(cleaned)).toBeNull();
  });

  it('HTML-escapes attribute values', () => {
    const { html } = render(':::state-vector\nstate: "\\"><script>alert(1)</script>"\n:::\n');
    expect(html).not.toContain('<script>alert(1)');
    expect(html).toContain('&lt;script&gt;');
  });
});

describe('validation feedback', () => {
  it('renders an inline error card for malformed YAML', () => {
    const { html } = render(':::bloch-sphere\nstate: "|0⟩\n  bad: [unclosed\n:::\n');
    expect(html).toContain('qf-error');
  });
});
