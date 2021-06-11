import moo from "moo";
import nearley from "nearley";

class SkippingLexer implements nearley.Lexer {
  lexer: moo.Lexer;
  skip: Set<string>;

  constructor(lexer: moo.Lexer) {
    this.lexer = lexer;
    this.skip = new Set(["WS", "COMMENT"]);
  }

  next() {
    do {
      const token = this.lexer.next();
      if (!(token && this.skip.has(token.type))) {
        return token;
      }
    } while (true);
  }

  reset(chunk: any, info: any) {
    this.lexer.reset(chunk, info);
  }
  formatError(token: any, message?: string) {
    return this.lexer.formatError(token, message);
  }
  save() {
    return this.lexer.save();
  }
  has(name: string) {
    return this.lexer.has(name);
  }
}

interface Ast {
  type: string;
  children: Ast[];
  range?: CodeRange;
  text?: string;
}

interface CodeRange {
  startLineNumber: number;
  startColumn: number;
  endLineNumber: number;
  endColumn: number;
}

class Parser extends nearley.Parser {
  initial: any;
  #codeRangeComputer: codeRangeComputer;

  constructor(grammar: any) {
    super(Parser.prepare(grammar));
    this.initial = this.save();
  }

  static prepare(grammar: any) {
    const rigid = grammar.Rigid || [];
    for (const rule of grammar.ParserRules) {
      rule.postprocess = rigid.includes(rule.name)
        ? (data: any[]) => this.unfold(data, rule.name)
        : rule.symbols.length === 1
        ? (data: any[]) => data[0]
        : (data: any[]) => Object.assign(data, { type: rule.name });
    }
    return grammar;
  }

  parse(program: string) {
    this.#codeRangeComputer = new codeRangeComputer(program);
    this.restart();
    this.feed(program);
    // For non-ambigious grammar, this is what we what
    // See: https://nearley.js.org/docs/parser#a-note-on-ambiguity
    const ast = this.results[0];
    this.setRange(ast);
    return this.toTree(ast);
  }

  restart() {
    this.restore(this.initial);
  }

  reportError(token: any) {
    return this.lexer.formatError(token, "Syntax error");
  }

  private toTree(ast: any) {
    if (ast.text) {
      return {
        type: ast.type,
        text: ast.text,
        children: null,
        range: ast.range,
      };
    } else {
      const tree = { type: ast.type, range: ast.range, children: [] };
      for (let i = 0; i < ast.length; i++) {
        tree.children.push(this.toTree(ast[i]));
      }

      return tree;
    }
  }

  private setRange(ast): void {
    if (ast.text) {
      const start = this.#codeRangeComputer.getNumberAndColumnFromPos(
        ast.offset
      );
      const end = this.#codeRangeComputer.getNumberAndColumnFromPos(
        ast.offset + ast.text.length
      );
      ast.range = {
        startLineNumber: start.lineNumber,
        startColumn: start.column,
        endLineNumber: end.lineNumber,
        endColumn: end.column,
      };
    } else {
      for (let i = 0; i < ast.length; i++) {
        this.setRange(ast[i]);
      }

      const firstChild = ast[0],
        lastChild = ast[ast.length - 1];
      ast.range = {
        startLineNumber: firstChild.range.startLineNumber,
        startColumn: firstChild.range.startColumn,
        endLineNumber: lastChild.range.endLineNumber,
        endColumn: lastChild.range.endColumn,
      };
    }
  }

  static unfold(data: any[], type: string) {
    function* iter() {
      for (const d of data) {
        if (d.type === type) {
          yield* d;
        } else {
          yield d;
        }
      }
    }
    return Object.assign([...iter()], { type });
  }
}

// Code below is copied from https://github.com/dsherret/ts-ast-viewer/blob/master/src/utils/LineAndColumnComputer.ts

class ArrayUtils {
  static from<T>(iterator: Iterator<T>) {
    const array: T[] = [];
    while (true) {
      const next = iterator.next();
      if (next.done) {
        return array;
      }
      array.push(next.value);
    }
  }

  static binarySearch<T>(items: readonly T[], compareTo: (value: T) => number) {
    let top = items.length - 1;
    let bottom = 0;

    while (bottom <= top) {
      const mid = Math.floor((top + bottom) / 2);
      const comparisonResult = compareTo(items[mid]);
      if (comparisonResult === 0) {
        return mid;
      } else if (comparisonResult < 0) {
        top = mid - 1;
      } else {
        bottom = mid + 1;
      }
    }

    return -1;
  }

  private constructor() {}
}

interface LineNumberAndColumn {
  pos: number;
  number: number;
  length: number;
}

function createLineNumberAndColumns(text: string) {
  const lineInfos: LineNumberAndColumn[] = [];
  let lastPos = 0;

  for (let i = 0; i < text.length; i++) {
    if (text[i] === "\n") {
      pushLineInfo(i);
    }
  }

  pushLineInfo(text.length);

  return lineInfos;

  function pushLineInfo(pos: number) {
    lineInfos.push({
      pos: lastPos,
      length: pos - lastPos,
      number: lineInfos.length + 1,
    });
    lastPos = pos + 1;
  }
}

/** An efficient way to compute the line and column of a position in a string. */
class codeRangeComputer {
  private readonly lineInfos: LineNumberAndColumn[];

  constructor(public readonly text: string) {
    this.lineInfos = createLineNumberAndColumns(text);
  }

  getNumberAndColumnFromPos(pos: number) {
    if (pos < 0) {
      return { lineNumber: 1, column: 1 };
    }

    const index = ArrayUtils.binarySearch(this.lineInfos, (info) => {
      if (pos < info.pos) {
        return -1;
      }
      if (pos >= info.pos && pos < info.pos + info.length + 1) {
        // `+ 1` is for newline char
        return 0;
      }
      return 1;
    });
    const lineInfo =
      index >= 0
        ? this.lineInfos[index]
        : this.lineInfos[this.lineInfos.length - 1];

    if (lineInfo == null) {
      return { lineNumber: 1, column: 1 };
    }

    return {
      lineNumber: lineInfo.number,
      column: Math.min(pos - lineInfo.pos + 1, lineInfo.length + 1),
    };
  }

  getPosFromLineAndColumn(line: number, column: number) {
    if (this.lineInfos.length === 0 || line < 1) {
      return 0;
    }

    const lineInfo = this.lineInfos[line - 1];
    if (lineInfo == null) {
      const lastLineInfo = this.lineInfos[this.lineInfos.length - 1];
      return lastLineInfo.pos + lastLineInfo.length;
    }
    return lineInfo.pos + Math.min(lineInfo.length, column - 1);
  }
}

export { Parser, SkippingLexer };
export type { Ast, CodeRange };
export default codeRangeComputer;
