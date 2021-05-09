import { C99Parser } from "./syntax/c99";
import { TypeScriptParser } from "./syntax/typescript-ast";

import { Hypergraph } from "./analysis/hypergraph";
import { HMatcher, Memento } from "./analysis/pattern";

import Edge = Hypergraph.Edge;
import Vertex = Hypergraph.Vertex;
import { EXPRESSIONS, SCOPES } from "./analysis/syntax";
import { resolveLexicalScope } from "./analysis/semantics";
import { performPointsToAnalysis } from "./analysis/pta";
import { byLabel, HAst } from "./analysis/astUtils";
import byNodeType = HAst.byNodeType;

function semanticAnalysis_C(peg1: Hypergraph) {
  const peg2 = new Hypergraph();

  peg2._max = peg1._max;

  const S = ["expression_statement"],
    L = [
      "expression_statement",
      "function_definition",
      "declaration",
      "parameter_declaration",
      "direct_declarator",
      "compound_statement",
      "iteration_statement",
      "selection_statement",
      "iteration_statement",
    ];

  let m = new HMatcher(peg1);

  m.l(S).t((u) => {
    peg2.add([{ label: "sigma", sources: [u], target: -1 }]);
  });
  m.l(L).t((u) => {
    peg2.add([{ label: "lscope", sources: [u], target: -1 }]);
  });

  m.l("compound_statement").e((e) => {
    m.sl(e.target, "lscope").t((v) => {
      peg2.add([
        {
          label: "lscope",
          sources: [e.sources[1]],
          target: v,
        },
      ]);
    });
  });
  m.l("direct_declarator").e((e) => {
    if (e.sources[1] && e.sources[1].label == "(") {
      m.sl(e.target, "lscope").t((v) => {
        peg2.add([
          {
            label: "lscope",
            sources: [e.sources[2]],
            target: v,
          },
        ]);
      });
    }
  });

  function addIf1(label: string, u?: Vertex, v?: Vertex) {
    if (u && v) {
      peg2.add([new Edge(label, [u], v)]);
    }
  }

  m.l("block_item_list").e((e) => {
    const sigmas = e.sources.map((u) => m.sl(u, "sigma").t_first()),
      lscopes = e.sources.map((u) => m.sl(u, "lscope").t_first());
    for (let i = 0; i < sigmas.length - 1; ++i) {
      addIf1("next", sigmas[i], sigmas[i + 1]);
    }
    addIf1("id", m.sl(e.target, "lscope").t_first(), lscopes[0]);
    for (let i = 0; i < lscopes.length - 1; ++i) {
      addIf1("next", lscopes[i], lscopes[i + 1]);
    }
  });

  m.l("function_definition").e((e) => {
    addIf1(
      "next",
      m.sl(e.target, "lscope").t_first(),
      m.sl(e.sources[1], "lscope").t_first()
    );
  });

  m.l("parameter_list").e((e) => {
    let u = m.sl(e.target, "lscope").t_first();
    for (const s of e.sources) {
      const v = m.sl(s, "lscope").t_first();
      if (v) {
        addIf1("next", u, v);
        u = v;
      }
    }
    // connect to function body, if present
    m.l("direct_declarator").t((dd) => {
      m.sl(dd, "function_definition").e((fd) =>
        m.sl(fd.sources[2], "lscope").t((v) => addIf1("id", u, v))
      );
    });
  });

  m.l("selection_statement").e((e) => {
    switch (e.sources[0].label) {
      case "if":
        var [u, v1, v2] = [e.target, e.sources[4], e.sources[6]].map((u) =>
          m.sl(u, "lscope").t_first()
        );
        addIf1("id", u, v1);
        addIf1("id", u, v2);
        break;
    }
  });

  m.l("iteration_statement").e((e) => {
    switch (e.sources[0].label) {
      case "while":
        var [u, v] = [e.target, e.sources[4]].map((u) =>
          m.sl(u, "lscope").t_first()
        );
        addIf1("id", u, v);
        break;
    }
  });

  m = new HMatcher(peg2);

  m.l("id").e((e) => {
    peg2.merge(e.incident);
    peg2.remove([e]);
  });

  return peg2;
}

function semanticAnalysis_TS(sourcePeg: Hypergraph) {
  const scopeResolutionPeg = new Hypergraph();
  scopeResolutionPeg._max = sourcePeg._max;

  const m = new HMatcher(sourcePeg);
  m.l(EXPRESSIONS).s(
    resolveLexicalScope.bind(null, sourcePeg, scopeResolutionPeg)
  );

  return scopeResolutionPeg;
}

// peg3 = performPointsToAnalysis(peg1);
// const ID = byNodeType("Identifier");

// class SourceNavigator {
//   ast: AstPanel;
//   peg: Hypergraph;

//   constructor(ast: AstPanel, peg: Hypergraph) {
//     this.ast = ast;
//     this.peg = peg;
//   }

//   findImports() {
//     const m = new HMatcher(this.peg),
//       res = [];
//     m.l("ImportClause").t((u) => {
//       if (u.data?.ast) {
//         res.push(u.data.ast);
//       }
//     });
//     return res;
//   }

//   gotoDecl(declType: string, name: string) {
//     const m = new HMatcher(this.peg),
//       mm = new Memento(),
//       res = [];

//     mm.e("e")(m.l(declType)).s(
//       ID(
//         byLabel(name)(() => {
//           res.push(mm.edges["e"].target.data.ast);
//         })
//       )
//     );

//     const declTree = res[0];
//     if (!declTree) {
//       return;
//     }

//     this.ast.focus(declTree);
//   }

//   gotoClass(name: string) {
//     this.gotoDecl("ClassDeclaration", name);
//   }

//   gotoMethod(name: string) {
//     this.gotoDecl("MethodDeclaration", name);
//   }
// }

const config = {
  C: {
    parser: new C99Parser(),
    seman: semanticAnalysis_C,
    filename: "data/c/bincnt.c",
  },
  TypeScript: {
    parser: new TypeScriptParser(),
    seman: semanticAnalysis_TS,
    filename: "data/typescript/lib/net_with_complications.ts",
  },
};

import React from "react";
import ReactDOM from "react-dom";
import App from "./components/App";

ReactDOM.render(<App config={config} />, document.getElementById("app"));