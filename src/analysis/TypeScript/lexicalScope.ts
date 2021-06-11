import { Hypergraph } from "analysis/hypergraph";
import { HMatcher } from "analysis/pattern";
import { EXPRESSIONS } from "analysis/syntax";
import { resolveLexicalScope } from "analysis/semantics";

export function lexicalScopeAnalysis(sourcePeg: Hypergraph) {
  const scopeResolutionPeg = new Hypergraph();
  scopeResolutionPeg._max = sourcePeg._max;

  const m = new HMatcher(sourcePeg);
  m.l(EXPRESSIONS).s(
    resolveLexicalScope.bind(null, sourcePeg, scopeResolutionPeg)
  );

  return scopeResolutionPeg;
}
