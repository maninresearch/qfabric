import type { Literal } from 'mdast';
import type {
  CompileContext,
  Extension as FromMarkdownExtension,
  Token,
} from 'mdast-util-from-markdown';

/**
 * A raw QFabric directive node in the mdast tree. `name` is the directive name
 * (`state-vector`, `row`) and `value` is the raw, unparsed body text (YAML
 * for component directives, empty for bare layout markers).
 */
export interface QFabricDirective extends Literal {
  type: 'qfabricDirective';
  name: string;
}

declare module 'mdast' {
  interface RootContentMap {
    qfabricDirective: QFabricDirective;
  }
  interface PhrasingContentMap {
    qfabricDirective: QFabricDirective;
  }
}

/** mdast-util-from-markdown extension turning directive tokens into nodes. */
export const qfabricFromMarkdown: FromMarkdownExtension = {
  enter: {
    qfDirective(this: CompileContext, token: Token) {
      this.enter({ type: 'qfabricDirective', name: '', value: '' } as QFabricDirective, token);
    },
  },
  exit: {
    qfDirectiveName(this: CompileContext, token: Token) {
      const node = this.stack[this.stack.length - 1] as unknown as QFabricDirective;
      node.name = this.sliceSerialize(token).trim().split(/\s+/)[0] ?? '';
    },
    qfDirectiveContent(this: CompileContext, token: Token) {
      const node = this.stack[this.stack.length - 1] as unknown as QFabricDirective;
      node.value += this.sliceSerialize(token);
    },
    qfDirective(this: CompileContext, token: Token) {
      this.exit(token);
    },
  },
};
