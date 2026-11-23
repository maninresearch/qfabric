import yaml from 'js-yaml';

/**
 * Top-level params that map to individual HTML attributes.
 * Everything else (nested objects/arrays) goes into a JSON `config` attribute.
 */
const INDIVIDUAL_ATTRS = new Set([
  'state',
  'qubits',
  'interactive',
  'builder',
  'bind',
  'id',
  'persist',
  'loop',
  'duration',
  'size',
  'theme',
  'toolbox',
  'resize',
  'format',
  'print',
  'precision',
  'qubit',
]);

/** Boolean params rendered as bare presence attributes when truthy. */
const BOOLEAN_ATTRS = new Set(['interactive', 'builder', 'persist', 'loop', 'resize', 'print']);

/** Layout directive names. Not web components; they become plain divs. */
export const LAYOUT_DIRECTIVES: Record<string, string> = {
  row: 'qf-row',
  grid: 'qf-grid',
};

/**
 * Valid directive names: lowercase letters and digits, optionally joined by
 * single hyphens, starting with a letter (e.g. `state-vector`). The name becomes
 * part of a tag name, so anything else is rejected rather than escaped.
 */
const DIRECTIVE_NAME = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

/**
 * Normalize and validate a directive name. Returns the lowercase name, or throws
 * with a message that is safe to show once HTML-escaped.
 */
export function validateDirectiveName(name: string): string {
  const normalized = name.trim().toLowerCase();
  if (!normalized) {
    throw new Error('Directive is missing a name, like ":::state-vector".');
  }
  if (!DIRECTIVE_NAME.test(normalized)) {
    throw new Error(
      `Invalid directive name ":::${name.trim()}". Use lowercase letters, digits and hyphens, like ":::state-vector".`,
    );
  }
  return normalized;
}

/** HTML-escape an attribute value. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Recursively strip prototype-pollution keys from a parsed config object.
 * Runs on the plain object js-yaml returns before it is ever
 * merged or stringified.
 */
export function sanitize<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((v) => sanitize(v)) as unknown as T;
  }
  if (value && typeof value === 'object') {
    const clean: Record<string, unknown> = Object.create(null);
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
      clean[key] = sanitize(val);
    }
    return clean as unknown as T;
  }
  return value;
}

/**
 * Parse a directive's raw YAML body.
 *
 * Security: keep this schema. `JSON_SCHEMA` permits only strings,
 * numbers, booleans, nulls, arrays and objects. No `!!js/function` or other
 * custom tags that would execute code on the build server.
 */
export function parseDirectiveYaml(body: string): Record<string, unknown> {
  const trimmed = body.trim();
  if (!trimmed) return {};
  const parsed = yaml.load(trimmed, { schema: yaml.JSON_SCHEMA });
  if (parsed === null || parsed === undefined) return {};
  if (typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`Directive body must be a YAML mapping, got ${typeof parsed}.`);
  }
  return sanitize(parsed as Record<string, unknown>);
}

function serializeAttrValue(value: unknown): string | null {
  if (Array.isArray(value)) return value.join(',');
  if (value === null || value === undefined) return null;
  return String(value);
}

export interface BuiltTag {
  /** The `qf-` tag name, e.g. `qf-state-vector`. */
  tag: string;
  /** The full opening+closing HTML string. */
  html: string;
}

/**
 * Build the `<qf-name ...>` HTML for a component directive. Simple params become
 * individual attributes; complex/nested params are bundled into a single JSON
 * `config` attribute. Individual attributes win over config. Throws on an
 * invalid directive name (see `validateDirectiveName`).
 */
export function buildComponentTag(name: string, params: Record<string, unknown>): BuiltTag {
  const tag = `qf-${validateDirectiveName(name)}`;
  const attrs: string[] = [];
  const config: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(params)) {
    const isSimple =
      INDIVIDUAL_ATTRS.has(key) &&
      (typeof value !== 'object' || value === null || Array.isArray(value));

    if (isSimple) {
      if (BOOLEAN_ATTRS.has(key)) {
        if (value === true) attrs.push(key);
        else if (value !== false) attrs.push(`${key}="${escapeHtml(String(value))}"`);
        continue;
      }
      const serialized = serializeAttrValue(value);
      if (serialized !== null) attrs.push(`${key}="${escapeHtml(serialized)}"`);
    } else {
      config[key] = value;
    }
  }

  if (Object.keys(config).length > 0) {
    // JSON.stringify handles escaping of the JSON itself; escapeHtml guards the
    // attribute context (quotes/angle brackets).
    attrs.push(`config="${escapeHtml(JSON.stringify(config))}"`);
  }

  const attrStr = attrs.length ? ` ${attrs.join(' ')}` : '';
  return { tag, html: `<${tag}${attrStr}></${tag}>` };
}
