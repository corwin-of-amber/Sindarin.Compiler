import { HMatcher } from "analysis/pattern";
import { Hypergraph } from "analysis/hypergraph";
import Edge = Hypergraph.Edge;

export function lexicalScopeAnalysis(peg1: Hypergraph) {
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

  m.l("compound_statement" as LabelPat).e((e) => {
    m.sl(e.target, "lscope" as LabelPat).t((v) => {
      peg2.add([
        {
          label: "lscope",
          sources: [e.sources[1]],
          target: v,
        },
      ]);
    });
  });
  m.l("direct_declarator" as LabelPat).e((e) => {
    if (e.sources[1] && e.sources[1].label == "(") {
      m.sl(e.target, "lscope" as LabelPat).t((v) => {
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

  m.l("block_item_list" as LabelPat).e((e) => {
    const sigmas = e.sources.map((u) => m.sl(u, "sigma" as LabelPat).t_first()),
      lscopes = e.sources.map((u) => m.sl(u, "lscope" as LabelPat).t_first());
    for (let i = 0; i < sigmas.length - 1; ++i) {
      addIf1("next", sigmas[i], sigmas[i + 1]);
    }
    addIf1("id", m.sl(e.target, "lscope" as LabelPat).t_first(), lscopes[0]);
    for (let i = 0; i < lscopes.length - 1; ++i) {
      addIf1("next", lscopes[i], lscopes[i + 1]);
    }
  });

  m.l("function_definition" as LabelPat).e((e) => {
    addIf1(
      "next",
      m.sl(e.target, "lscope" as LabelPat).t_first(),
      m.sl(e.sources[1], "lscope" as LabelPat).t_first()
    );
  });

  m.l("parameter_list" as LabelPat).e((e) => {
    let u = m.sl(e.target, "lscope" as LabelPat).t_first();
    for (const s of e.sources) {
      const v = m.sl(s, "lscope" as LabelPat).t_first();
      if (v) {
        addIf1("next", u, v);
        u = v;
      }
    }
    // connect to function body, if present
    m.l("direct_declarator" as LabelPat).t((dd) => {
      m.sl(dd, "function_definition" as LabelPat).e((fd) =>
        m.sl(fd.sources[2], "lscope" as LabelPat).t((v) => addIf1("id", u, v))
      );
    });
  });

  m.l("selection_statement" as LabelPat).e((e) => {
    switch (e.sources[0].label) {
      case "if":
        const [u, v1, v2] = [e.target, e.sources[4], e.sources[6]].map((u) =>
          m.sl(u, "lscope" as LabelPat).t_first()
        );
        addIf1("id", u, v1);
        addIf1("id", u, v2);
        break;
    }
  });

  m.l("iteration_statement" as LabelPat).e((e) => {
    switch (e.sources[0].label) {
      case "while":
        const [u, v] = [e.target, e.sources[4]].map((u) =>
          m.sl(u, "lscope" as LabelPat).t_first()
        );
        addIf1("id", u, v);
        break;
    }
  });

  m = new HMatcher(peg2);

  m.l("id" as LabelPat).e((e) => {
    peg2.merge(e.incident);
    peg2.remove([e]);
  });

  return peg2;
}
