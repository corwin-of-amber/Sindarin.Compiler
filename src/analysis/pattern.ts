import { Hypergraph } from "./hypergraph";
import { lazyFilter, lazyFlatMap } from "./utils";
import { loadPattern, serializePattern } from "./patternSerializer";

function getRouteKey<VData>(route: Route<VData>) {
  return route.map((v) => v.id).join("|");
}

export class HMatcher<VData = any> {
  g: Hypergraph<VData>;

  constructor(g: Hypergraph<VData>) {
    this.g = g;
  }

  private _matched(genf: () => Generator<Edge>) {
    return new Matched(this, genf);
  }

  /**
   * Matches edges by label.
   * @param label
   */
  l(label: LabelPat) {
    const p = toObjectWithLabel(label);
    return this._matched(() => lazyFilter<Edge>(this.g.edges, p));
  }

  /**
   * Matches a specific vertex, and yields outgoing edges
   * @param v
   */
  v(v: { id: number }) {
    const { id } = v;
    const vertex = this.g._get(id);

    function* aux() {
      yield* vertex.outgoing;
    }

    return this._matched(() => aux());
  }

  /**
   * Matches vertices by label, and yields outgoing edges
   * @param label
   */
  vl(label: LabelPat) {
    const p = toObjectWithLabel(label);
    return this._matched(() =>
      lazyFlatMap(
        lazyFilter<Vertex>(this.g.vertices.values(), p),
        function* (v) {
          yield* v.outgoing;
        }
      )
    );
  }

  /**
   * Matches by target
   * @param target path end point
   * @param label label(s) of final edge
   */
  lt(target: Vertex<VData>, label?: LabelPat, excluding?: LabelPat) {
    const p = toObjectWithLabel(label);
    const pExclude = toObjectWithLabel(excluding, { negate: true });

    return this._matched(() =>
      lazyFilter<Edge>(lazyFilter<Edge>(target.incoming, p), pExclude)
    );
  }

  /**
   * Matches by edge source & label.
   * @param source start point
   * @param label
   */
  sl(source: Vertex<VData>, label: LabelPat, excluding?: LabelPat) {
    const p = toObjectWithLabel(label);
    const pExclude = toObjectWithLabel(excluding, { negate: true });

    return this._matched(() =>
      lazyFilter<Edge>(lazyFilter<Edge>(source.outgoing, p), pExclude)
    );
  }

  /**
   * Matches by edge label & target -- reflexive-transitive.
   * @param target path end point
   * @param label label(s) of final edge
   */
  lt_rtc(target: Vertex<VData>, label: LabelPat, excluding?: LabelPat) {
    const p = toObjectWithLabel(label);
    const pExclude = toObjectWithLabel(excluding, { negate: true });

    function* aux(v: Vertex) {
      for (const e of lazyFilter<Edge>(v.incoming, pExclude)) {
        const handled = p(e) ? yield e : false;
        if (!handled) {
          yield* lazyFlatMap(e.sources, aux);
        }
      }
    }

    return this._matched(() => aux(target));
  }

  /**
   * Matches by edge source & label -- reflexive-transitive.
   * @param source start point
   * @param label label(s) of final edge
   */
  sl_rtc(source: Vertex<VData>, label: LabelPat, excluding?: LabelPat) {
    const p = toObjectWithLabel(label);
    const pExclude = toObjectWithLabel(excluding, { negate: true });

    function* aux(v: Vertex) {
      for (const e of lazyFilter<Edge>(v.outgoing, pExclude)) {
        const handled = p(e) ? yield e : false;
        if (!handled) {
          yield* aux(e.target);
        }
      }
    }

    return this._matched(() => aux(source));
  }

  /**
   * Perform complex traversal via a list of PatternDefinition objects
   * @param definitions how to traverse the graph
   */
  resolvePatternDefinitions(
    pattern: RoutePatternDefinition,
    handler: (route: Route<VData>) => void
  ) {
    // TODO: remove
    pattern = loadPattern(serializePattern(pattern));

    const { definitions, firstOnly, unreflexive } = pattern;

    if (!definitions || !definitions.length) {
      throw new Error("Cannot resolve match without definitions");
    }

    const [firstDefinition, ...restOfDefinitions] = definitions;

    const {
      labelPred,
      vertex,
      vertexLabelPat,
      index,
      resolve,
      through,
      modifier,
      excluding,
    } = firstDefinition;
    if (index || through || modifier || excluding) {
      throw new Error(
        "First definition can only define `labelPred`, `vertex`, `vertexLabelPat`, and `resolve`"
      );
    }

    // if ([labelPred, vertexLabelPat, vertex].filter(_ => _).length !== 1) {
    //     throw new Error("First definition can only define one of `labelPred`, `vertex` or `vertexLabelPat`")
    // }

    const startingSet = vertex
      ? this.v(vertex)
      : vertexLabelPat
      ? this.vl(vertexLabelPat)
      : this.l(labelPred);
    const visited = new Set<string>();

    startingSet.resolvePatternDefinitions(handler, restOfDefinitions, {
      vertexLabelPat: vertexLabelPat || vertex?.label,
      visited,
      firstOnly,
      topLevel: true,
      resolve,
      unreflexive,
    });
  }

  /**
   * Run resolvePatternDefinitions and gather results into an array
   */
  collectPatternDefinition(pattern: RoutePatternDefinition): Route<VData>[] {
    const results: Route<VData>[] = [];
    this.resolvePatternDefinitions(pattern, (route: Route<VData>) => {
      results.push(route);
    });

    return results;
  }
}

const THROUGH_TO_METHOD = {
  outgoing: "sl",
  incoming: "lt",
};

const THROUGH_TO_RESOLVE: { [key: string]: "sources" | "targets" } = {
  outgoing: "targets",
  incoming: "sources",
};

interface ObjectWithLabelPredOptions {
  negate?: boolean;
}

export function toObjectWithLabel(
  l: LabelPat,
  options?: ObjectWithLabelPredOptions
): ObjectWithLabel {
  if (options?.negate) {
    const { negate, ...rest } = options;
    const innerPred = toObjectWithLabel(l, rest);
    return (e) => !innerPred(e);
  }

  if (!l) {
    return () => false;
  }

  const labelPred = toLabelPred(l);
  return (e) => labelPred(e.label);
}

export function toLabelPred(l: LabelPat): LabelPred {
  if (typeof l == "string") {
    return (s: string) => s == l;
  } else if (Array.isArray(l)) {
    return (s: string) => l.includes(s);
  } else if (l instanceof Set) {
    return (s: string) => l.has(s);
  } else if (l instanceof RegExp) {
    return (s: string) => s && l.test(s);
  } else {
    return l;
  }
}

export const LANY: LabelPat = () => true;
export const LANY_LABEL: ObjectWithLabel = () => true;

export class Matched<VData = any> {
  matcher: HMatcher<VData>;
  gen: Generator<Edge>;

  constructor(matcher: HMatcher<VData>, genf: () => Generator<Edge>) {
    this.matcher = matcher;
    this.gen = genf();
  }

  e(cont: (e: Edge) => void | boolean) {
    // iterates edges
    for (const e of this.gen) {
      cont(e);
    }
  }

  idx(
    cont: (t: Vertex<VData>) => void | boolean,
    index: number,
    labelPat?: LabelPat
  ) {
    // child vertices
    const p = !labelPat ? LANY_LABEL : toObjectWithLabel(labelPat);
    this.e((e) => {
      const filteredSources = e.sources.filter(p);

      if (filteredSources.length <= index) {
        throw new Error("index out of range");
      }

      cont(filteredSources[index]);
    });
  }

  t(cont: (t: Vertex<VData>) => void | boolean, labelPat?: LabelPat) {
    // iterates edge targets
    const p = !labelPat ? LANY_LABEL : toObjectWithLabel(labelPat);
    this.e((e) => p(e.target) && cont(e.target));
  }

  s(cont: (t: Vertex<VData>) => void | boolean, labelPat?: LabelPat) {
    // iterates edge sources
    const p = !labelPat ? LANY_LABEL : toObjectWithLabel(labelPat);
    this.e((e) => {
      for (const u of lazyFilter<Vertex>(e.sources, p)) {
        cont(u);
      }
    });
  }

  si(idx: number, cont: (t: Vertex<VData>) => void | boolean) {
    // iterates edge sources with given index
    this.e((e) => {
      const u = e.sources[idx];
      u && cont(u);
    });
  }

  first<T>(f: (e: Edge) => T) {
    for (const e of this.gen) {
      const va = f(e);
      if (va) {
        return va;
      }
    }
  }

  t_first() {
    return this.first((e) => e.target);
  }

  s_first(idx: number = 0) {
    return this.first((e) => e.sources[idx]);
  }

  resolvePatternDefinitions(
    handler: (route: Vertex<VData>[]) => void,
    definitions: PatternDefinition[],
    payload: PatternDefinitionPayload,
    route?: Route<VData>
  ): boolean {
    const [nextDefinition, ...restOfDefinitions] =
      definitions && definitions.length ? definitions : [null];
    const { labelPred, vertex, index, through, modifier, excluding } =
      nextDefinition || {};
    const {
      vertexLabelPat,
      visited,
      firstOnly,
      topLevel,
      resolve,
      unreflexive,
    } = payload;

    const methodBase = THROUGH_TO_METHOD[through];
    const method = modifier ? `${methodBase}_${modifier}` : methodBase;
    const isRouteDone = !nextDefinition;

    if (!isRouteDone) {
      if (vertex) {
        throw new Error("Inner match definitions cannot define `vertex`");
      }

      if (!through && index === undefined) {
        throw new Error(
          "Inner non-index match definitions must define `through`"
        );
      }

      if (resolve && resolve !== "sources" && resolve !== "targets") {
        throw new Error(
          "`resolve` must be 'sources' or 'targets' (or undefined)"
        );
      }

      // Index mode
      if (index !== undefined) {
        if (through || modifier || excluding || vertexLabelPat) {
          throw new Error("Illegal definition for index resolution");
        }
      } else {
        if (!this.matcher[method]) {
          throw new Error(`Method ${method} does not exist on HMatcher`);
        }
      }
    }

    let found = false;

    const routeHandler = (u) => {
      if (!topLevel && found && firstOnly) {
        return;
      }

      // Prevent direct links for the same vertex
      if (unreflexive && route && route[route.length - 1] === u) {
        return;
      }

      const extendedRoute = route ? [...route, u] : [u];

      // Dedupe routes
      const routeKey = getRouteKey(extendedRoute);
      if (visited.has(routeKey)) {
        return;
      }

      visited.add(routeKey);

      // Not done yet
      if (!isRouteDone) {
        const subquery: Matched<VData> =
          index !== undefined
            ? this.matcher.v(u)
            : this.matcher[method](u, labelPred, excluding);

        const nextPayload: PatternDefinitionPayload = {
          ...payload,
          vertexLabelPat: nextDefinition.vertexLabelPat,
          topLevel: false,
          resolve: nextDefinition.resolve || THROUGH_TO_RESOLVE[through],
        };

        found = subquery.resolvePatternDefinitions(
          handler,
          restOfDefinitions,
          nextPayload,
          extendedRoute
        );
        return;
      }

      found = true;
      handler(extendedRoute);
      return;
    };

    if (index !== undefined) {
      this.idx(routeHandler, index, labelPred);
    } else if (resolve === "targets") {
      this.t(routeHandler, vertexLabelPat);
    } else {
      this.s(routeHandler, vertexLabelPat);
    }

    return found;
  }
}

export class Memento {
  edges: { [key: string]: Edge } = {};

  /** @oops I'd like to use a static type with `keyof` here somehow */

  e(key: string) {
    const self = this;
    return <VData>(m: Matched<VData>) =>
      new Matched<VData>(m.matcher, function* () {
        for (const e of m.gen) {
          self.edges[key] = e;
          yield e;
        }
      });
  }
}
