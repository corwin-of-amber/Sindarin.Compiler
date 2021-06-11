import {
  createSourceFile,
  SyntaxKind,
  isToken,
  SourceFile,
  Node,
  ScriptTarget,
} from "typescript";
import codeRangeComputer from "./parser";
import { Ast } from "./parser";

class TypeScriptParser {
  #codeRangeComputer: codeRangeComputer;

  constructor() {
    this.#codeRangeComputer = new codeRangeComputer("");
  }

  parse(program: string) {
    const src = createSourceFile(
      "this-program.ts",
      program,
      ScriptTarget.Latest
    );
    this.#codeRangeComputer = new codeRangeComputer(program);
    // Remove EndOfFileToken
    return this.postprocessSourceFile(src);
  }

  postprocessSourceFile(src: SourceFile): Ast {
    return this.postprocessAst(src, src);
  }

  postprocessAst(u: Node, src: SourceFile) {
    const kind = SyntaxKind[u.kind];
    if (isToken(u)) {
      return {
        type: kind,
        text: u.getText(src),
        range: this.getRange(u),
        _ts: u,
        children: null,
      };
    } else {
      const children: any = u
        .getChildren(src)
        .map((s) => this.postprocessAst(s, src));
      return {
        type: kind,
        _ts: u,
        range: this.getRange(u),
        children,
      };
    }
  }

  getRange(u: Node) {
    const start = this.#codeRangeComputer.getNumberAndColumnFromPos(u.pos);
    const end = this.#codeRangeComputer.getNumberAndColumnFromPos(u.end);
    return {
      startLineNumber: start.lineNumber,
      startColumn: start.column,
      endLineNumber: end.lineNumber,
      endColumn: end.column,
    };
  }
}

export { TypeScriptParser };
