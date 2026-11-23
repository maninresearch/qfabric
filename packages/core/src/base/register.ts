/**
 * Double-registration guard.
 *
 * Every component registers through this helper, so importing both `@qfabric/core`
 * and `@qfabric/core/state-vector` (or the same component twice) never throws
 * `NotSupportedError: 'qf-…' already defined`.
 */
export function defineElement(tag: string, ctor: CustomElementConstructor): void {
  if (typeof customElements === 'undefined') return; // SSR / Node: no-op
  if (!customElements.get(tag)) {
    customElements.define(tag, ctor);
  }
}
