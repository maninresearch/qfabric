// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import '../components/probability/qf-probability.js';
import '../components/state-vector/qf-state-vector.js';

type Lit = HTMLElement & { updateComplete: Promise<boolean> };

async function mount<T extends Lit>(html: string): Promise<T> {
  document.body.innerHTML = html;
  const el = document.body.firstElementChild as T;
  await el.updateComplete;
  return el;
}

/** Rendered shadow text with whitespace removed, e.g. "1√2|0⟩+1√2|1⟩". */
const rendered = (el: Element) => (el.shadowRoot?.textContent ?? '').replace(/\s+/g, '');

afterEach(() => {
  document.body.innerHTML = '';
});

describe('state changes after the first render', () => {
  it('redraws when the state property changes', async () => {
    const el = await mount<Lit & { state: string }>(
      '<qf-state-vector state="|0⟩"></qf-state-vector>',
    );
    expect(rendered(el)).toContain('|0⟩');

    el.state = '|1⟩';
    await el.updateComplete;
    expect(rendered(el)).toContain('|1⟩');
    expect(rendered(el)).not.toContain('|0⟩');
  });

  it('redraws when the state attribute changes', async () => {
    const el = await mount<Lit>('<qf-state-vector state="|0⟩"></qf-state-vector>');
    el.setAttribute('state', '|+⟩');
    await el.updateComplete;
    expect(rendered(el)).toContain('|0⟩');
    expect(rendered(el)).toContain('|1⟩');
  });

  it('redraws when gates are set', async () => {
    const el = await mount<Lit & { gates: string[] }>(
      '<qf-probability state="|00⟩"></qf-probability>',
    );
    el.gates = ['H 0', 'CNOT 0 1'];
    await el.updateComplete;
    const bars = [...(el.shadowRoot?.querySelectorAll('title') ?? [])].map((t) => t.textContent);
    expect(bars.filter((t) => t?.includes('50%'))).toHaveLength(2);
  });

  it('applies a theme change in the same update', async () => {
    const el = await mount<Lit & { theme: string }>('<qf-state-vector></qf-state-vector>');
    el.theme = 'dark';
    await el.updateComplete;
    expect(el.getAttribute('data-resolved-theme')).toBe('dark');
  });
});
