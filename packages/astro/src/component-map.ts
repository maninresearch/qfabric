/**
 * Maps each `qf-*` tag to the `qfabric` entry point that registers it, so a
 * page can import only the components it uses. Add a row when a new component
 * ships its own entry point.
 */
export const COMPONENT_IMPORTS: Record<string, string> = {
  'qf-state-vector': 'qfabric/state-vector',
  'qf-probability': 'qfabric/probability',
};

/** Resolve the import specifiers for a set of used `qf-*` tags. */
export function importsForTags(tags: Iterable<string>): string[] {
  const specs = new Set<string>();
  for (const tag of tags) {
    const spec = COMPONENT_IMPORTS[tag];
    if (spec) specs.add(spec);
  }
  return [...specs];
}
