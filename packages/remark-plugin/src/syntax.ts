import { markdownLineEnding, markdownSpace } from 'micromark-util-character';
import type { Code, Effects, Extension, State, TokenizeContext } from 'micromark-util-types';

/**
 * QFabric directive micromark extension.
 *
 * Tokenizes block-level `:::name` directives and captures everything up to the
 * closing `:::` as raw text, never as markdown. remark-directive isn't used
 * because it would parse the YAML body as markdown and mangle colons, brackets
 * and pipes.
 *
 * Two shapes (kept flow-correct: every directive ends at a line boundary):
 *  - Component directives (`:::state-vector` ... `:::`): a body is captured raw
 *    until the closing `:::` fence (or end of file).
 *  - Layout markers (`:::row`, `:::grid`): single-line markers with no body and
 *    no closing fence; they end at their own line ending so following sibling
 *    directives parse independently.
 *
 * `:::` inside fenced code blocks is ignored, because micromark does not run
 * flow constructs inside code.
 */

const COLON = 58;

/** Register our custom token names with micromark's type map. */
declare module 'micromark-util-types' {
  interface TokenTypeMap {
    qfDirective: 'qfDirective';
    qfDirectiveFenceOpen: 'qfDirectiveFenceOpen';
    qfDirectiveFenceClose: 'qfDirectiveFenceClose';
    qfDirectiveName: 'qfDirectiveName';
    qfDirectiveContent: 'qfDirectiveContent';
  }
}

/** Directive names that are bare single-line layout markers. */
const LAYOUT_MARKERS = new Set(['row', 'grid']);

/** Partial: matches a closing fence: exactly `:::` then spaces then EOL/EOF. */
function tokenizeClose(this: TokenizeContext, effects: Effects, ok: State, nok: State): State {
  let count = 0;
  return start;

  function start(code: Code): State | undefined {
    if (code !== COLON) return nok(code);
    effects.enter('qfDirectiveFenceClose');
    return colon(code);
  }
  function colon(code: Code): State | undefined {
    if (code === COLON) {
      effects.consume(code);
      count++;
      return colon;
    }
    if (count < 3) return nok(code);
    return after(code);
  }
  function after(code: Code): State | undefined {
    if (markdownSpace(code)) {
      effects.consume(code);
      return after;
    }
    if (code === null || markdownLineEnding(code)) {
      effects.exit('qfDirectiveFenceClose');
      return ok(code);
    }
    return nok(code);
  }
}

const closeConstruct = { tokenize: tokenizeClose, partial: true };

function tokenizeDirective(this: TokenizeContext, effects: Effects, ok: State, nok: State): State {
  let name = '';
  return start;

  function start(code: Code): State | undefined {
    if (code !== COLON) return nok(code);
    effects.enter('qfDirective');
    effects.enter('qfDirectiveFenceOpen');
    effects.consume(code);
    return open2;
  }
  function open2(code: Code): State | undefined {
    if (code !== COLON) return nok(code);
    effects.consume(code);
    return open3;
  }
  function open3(code: Code): State | undefined {
    if (code !== COLON) return nok(code);
    effects.consume(code);
    effects.exit('qfDirectiveFenceOpen');
    return nameStart;
  }
  function nameStart(code: Code): State | undefined {
    if (code === null || markdownLineEnding(code)) return afterOpenLine(code);
    if (markdownSpace(code)) {
      effects.consume(code);
      return nameStart;
    }
    effects.enter('qfDirectiveName');
    return nameInner(code);
  }
  function nameInner(code: Code): State | undefined {
    if (code === null || markdownLineEnding(code)) {
      effects.exit('qfDirectiveName');
      return afterOpenLine(code);
    }
    if (typeof code === 'number' && code > 0) name += String.fromCharCode(code);
    effects.consume(code);
    return nameInner;
  }
  function afterOpenLine(code: Code): State | undefined {
    // Bare layout marker: end at the opening line ending, leaving it for flow.
    if (LAYOUT_MARKERS.has(name.trim().toLowerCase())) {
      effects.exit('qfDirective');
      return ok(code);
    }
    if (code === null) {
      effects.exit('qfDirective');
      return ok(code);
    }
    effects.enter('lineEnding');
    effects.consume(code);
    effects.exit('lineEnding');
    return effects.attempt(closeConstruct, onClose, captureLineStart);
  }
  function captureLineStart(code: Code): State | undefined {
    if (code === null) {
      effects.exit('qfDirective');
      return ok(code);
    }
    effects.enter('qfDirectiveContent');
    return captureLine(code);
  }
  function captureLine(code: Code): State | undefined {
    if (code === null) {
      effects.exit('qfDirectiveContent');
      effects.exit('qfDirective');
      return ok(code);
    }
    if (markdownLineEnding(code)) {
      effects.consume(code); // newline belongs to the raw content
      effects.exit('qfDirectiveContent');
      return effects.attempt(closeConstruct, onClose, captureLineStart);
    }
    effects.consume(code);
    return captureLine;
  }
  function onClose(code: Code): State | undefined {
    effects.exit('qfDirective');
    return ok(code);
  }
}

const directiveConstruct = { tokenize: tokenizeDirective, concrete: true };

/** The micromark extension: a flow construct triggered by `:` at line start. */
export const qfabricMicromark: Extension = {
  flow: { [COLON]: directiveConstruct },
};
