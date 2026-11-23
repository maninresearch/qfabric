import type { Html, Root, RootContent } from 'mdast';
import type { Plugin } from 'unified';
import type { Processor } from 'unified';
import { type QFabricDirective, qfabricFromMarkdown } from './from-markdown.js';
import { qfabricMicromark } from './syntax.js';
import {
  LAYOUT_DIRECTIVES,
  buildComponentTag,
  escapeHtml,
  parseDirectiveYaml,
} from './transform.js';

export { qfabricMicromark } from './syntax.js';
export { qfabricFromMarkdown, type QFabricDirective } from './from-markdown.js';
export * from './transform.js';

export interface RemarkQFabricOptions {
  /**
   * Called once per file with the set of `qf-*` tag names it uses, for example
   * to load only those components on that page.
   */
  onComponentsUsed?: (tags: Set<string>, file: unknown) => void;
}

/** Build an inline error card shown where the component would be. */
function errorCard(message: string): string {
  const safe = escapeHtml(message);
  const style =
    'border:1px solid var(--qf-error,#b3261e);border-radius:6px;padding:12px;' +
    'color:var(--qf-error,#b3261e);font-family:var(--qf-font-mono,monospace);font-size:13px;';
  return `<div class="qf-error" role="alert" style="${style}">QFabric directive error: ${safe}</div>`;
}

/**
 * Remark plugin: transforms `:::name` directive nodes into `<qf-*>` HTML and
 * `:::row` / `:::grid` markers into wrapper divs. Registers the QFabric
 * micromark + from-markdown extensions on the processor.
 */
const remarkQFabric: Plugin<[RemarkQFabricOptions?], Root> = function remarkQFabric(options = {}) {
  const self = this as unknown as Processor;
  const data = self.data() as Record<string, unknown[]>;
  data.micromarkExtensions ??= [];
  data.fromMarkdownExtensions ??= [];
  data.micromarkExtensions.push(qfabricMicromark);
  data.fromMarkdownExtensions.push(qfabricFromMarkdown);

  return (tree: Root, file: unknown) => {
    const used = new Set<string>();
    const seenIds = new Set<string>();

    transformChildren(tree.children, used, seenIds, file);

    if (options.onComponentsUsed) options.onComponentsUsed(used, file);
    const fileData = (file as { data?: Record<string, unknown> })?.data;
    if (fileData) fileData.qfabricComponents = used;
  };
};

/** Layout class for a directive node, or undefined if it is not a layout marker. */
function layoutClass(node: RootContent | undefined): string | undefined {
  if (node?.type !== 'qfabricDirective') return undefined;
  return LAYOUT_DIRECTIVES[(node as unknown as QFabricDirective).name.toLowerCase()];
}

/**
 * Transform a node list in place.
 *
 * A layout marker (`:::row` / `:::grid`) groups the component directives that
 * directly follow it. The group ends at the first node that is not a component
 * directive (a paragraph, a heading, another marker), so prose after a row is
 * never pulled into it. Each group becomes one self-contained HTML node.
 */
function transformChildren(
  children: RootContent[],
  used: Set<string>,
  seenIds: Set<string>,
  file: unknown,
): void {
  for (let i = 0; i < children.length; i++) {
    const node = children[i];
    if (!node || node.type !== 'qfabricDirective') continue;

    const cls = layoutClass(node);
    if (!cls) {
      children[i] = componentNode(node as unknown as QFabricDirective, node, used, seenIds, file);
      continue;
    }

    // Collect the run of component directives after the marker.
    let end = i + 1;
    while (
      end < children.length &&
      children[end]?.type === 'qfabricDirective' &&
      !layoutClass(children[end])
    ) {
      end++;
    }
    const members = children.slice(i + 1, end) as RootContent[];
    const name = (node as unknown as QFabricDirective).name;

    if (members.length === 0) {
      warn(file, `:::${name} has no components directly after it, so it was ignored.`);
      children.splice(i, 1);
      i--;
      continue;
    }

    const inner = members
      .map((m) => componentNode(m as unknown as QFabricDirective, m, used, seenIds, file).value)
      .join('\n');
    const group: Html = {
      type: 'html',
      value: `<div class="${cls}">\n${inner}\n</div>`,
      position:
        node.position && members[members.length - 1]?.position
          ? {
              start: node.position.start,
              end: (members[members.length - 1] as RootContent).position!.end,
            }
          : node.position,
    };
    children.splice(i, end - i, group);
  }
}

function componentNode(
  directive: QFabricDirective,
  original: RootContent,
  used: Set<string>,
  seenIds: Set<string>,
  file: unknown,
): Html {
  try {
    const params = parseDirectiveYaml(directive.value);

    const id = params.id;
    if (typeof id === 'string') {
      if (seenIds.has(id)) {
        warn(file, `Duplicate component id "${id}" on the same page (invalid HTML).`);
      }
      seenIds.add(id);
    }

    const { tag, html } = buildComponentTag(directive.name, params);
    used.add(tag);
    return htmlNode(html, original);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    warn(file, `:::${directive.name}: ${message}`);
    return htmlNode(errorCard(`:::${directive.name}: ${message}`), original);
  }
}

function htmlNode(value: string, position: RootContent): Html {
  return { type: 'html', value, position: position.position };
}

function warn(file: unknown, message: string): void {
  const f = file as { message?: (m: string) => void };
  if (typeof f?.message === 'function') f.message(`[qfabric] ${message}`);
}

export default remarkQFabric;
