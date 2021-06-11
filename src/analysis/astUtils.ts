import { Ast } from "syntax/parser";
import { Hypergraph } from "./hypergraph";

/**
 * Curried filter decorator for continuations (convenience function).
 * @param pred filter predicate
 */
export function filtered<T>(pred: (t: T) => boolean) {
  return <S>(cont: (t: T) => S) =>
    (t: T) =>
      pred(t) ? cont(t) : undefined;
}

export function byLabel<T extends { label: string }>(label: string | string[]) {
  if (!Array.isArray(label)) {
    label = [label];
  }
  return filtered<T>((u) => label.includes(u.label));
}

/**
 * Ast-specific functionality.
 * (Ideally, all the data should be in the graph, but sometimes it is not.)
 */
export namespace HAst {
  export function by<D extends { ast: Ast }>(pred: (ast: Ast) => boolean) {
    return filtered<Hypergraph.Vertex<D>>((u) => {
      const ast = u.data?.ast;
      return !!ast && pred(ast);
    });
  }

  export function byNodeType<D extends { ast: Ast }>(nodeType: string) {
    return by<D>((ast) => ast.type === nodeType);
  }
}
