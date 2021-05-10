import { Hypergraph } from "./hypergraph";
import { HMatcher } from "./pattern";
import * as Syntax from "./syntax";
import { getClosestScopeNameRouteDefinition } from "./semantics";
import assert from "assert";
import { lazyFilter, toSubtreeString } from "./utils";

const ASSIGNMENT_EXPRESSIONS: SyntaxToken[] = [
  "VariableDeclaration",
  "BinaryExpression",
  "ReturnStatement",
  "CallExpression",
];

const LINK_TYPES = {
  ASSIGNMENT: "assignment",
  SCOPE: "scope",
  CLASS: "class",
  INVOCATION: "invocation",
  INSTANTIATION: "instantiation",
  PARENT_SCOPE: "parent_scope",
  FIELD: "field",
  SOLVED: "__solved__",
  RETURN_VALUE: "return_value",
};

// TODO: Side effects from invocations
const SUPPORTED_ASSIGNMENT_EXPRESSIONS = new Set(
  ASSIGNMENT_EXPRESSIONS.slice(0, 3)
);

export function performPointsToAnalysis<VData>(
  sourcePeg: Hypergraph<VData>
): Hypergraph<VData> {
  const m = new HMatcher(sourcePeg);

  // 1) Collect assignments
  const assignments = m
    .collectPatternDefinition(
      getClosestScopeNameRouteDefinition(
        {
          labelPred: ASSIGNMENT_EXPRESSIONS,
          resolve: "targets",
        },
        {
          excludedScopes: ["Block", "CatchClause"],
        }
      )
    )
    .map(ANALYSIS_EXPRESSION_FACTORY);

  // 2) Filter supported expressions
  const supportedAssignments = assignments.filter((expr) => {
    return SUPPORTED_ASSIGNMENT_EXPRESSIONS.has(expr.assignmentExpr.label);
  });

  // 3) Add to Andersen graph
  const analysis: PointsToAnalysis<VData> = new AndersenAnalyis(
    sourcePeg._max,
    m
  );
  supportedAssignments.forEach(analysis.addConstraint.bind(analysis));

  // 4) Solve constraints
  const result = analysis.solveConstraints();

  // Profit
  return result;
}

interface AnalysisExpression<VData> {
  assignmentExpr: Edge;
  scope: Vertex<VData>;
  name: string;
  repr: string;
}

const ANALYSIS_EXPRESSION_FACTORY = ([assignmentExpr, scope, _]) =>
  _createAnalysisExpression(assignmentExpr, scope);

function _createAnalysisExpression<VData>(
  assignmentExpr: Vertex<VData>,
  scope: Vertex<VData>
): AnalysisExpression<VData> {
  const { incoming } = assignmentExpr;
  if (!incoming || incoming.length !== 1) {
    throw new Error("Bad vertex");
  }

  // TODO
  const name = "";

  return {
    assignmentExpr: incoming[0],
    scope,
    name,
    repr: toSubtreeString(assignmentExpr),
  };
}

interface PointsToAnalysis<VData> {
  addConstraint(expr: AnalysisExpression<VData>);

  solveConstraints(): Hypergraph<VData>;
}

interface ResolvedConstraint {
  top: Vertex;
  bottom: Vertex;
  type?: string;
}

class AndersenAnalyis<VData> implements PointsToAnalysis<VData> {
  peg: Hypergraph<VData>;
  matcher: HMatcher<VData>;

  constructor(max: number, matcher: HMatcher<VData>) {
    this.peg = new Hypergraph<VData>();
    this.peg._max = max;

    this.matcher = matcher;
  }

  addConstraint(expr: AnalysisExpression<VData>) {
    const { assignmentExpr, scope } = expr;
    const { label } = assignmentExpr;

    switch (label) {
      case "VariableDeclaration": {
        // Catch clause Exception arg
        if (assignmentExpr.sources.length === 1) {
          return;
        }

        // fallthrough
      }
      case "BinaryExpression": {
        const [left, op, right] = _parseBinaryExpression(assignmentExpr, false);

        if (op !== "=") {
          // Reject non-assignement binary expressions
          return;
        }

        if (_isArrayLiteralVertex(left)) {
          this._addMultiAssignConstraint(expr, left, right);
          return;
        }

        // TODO: Remove
        console.log(
          toSubtreeString(left, " ", true),
          " = ",
          toSubtreeString(right, " ", true)
        );

        this._resolveWriteConstraint(scope, left, right);
        return;
      }
      case "ReturnStatement": {
        const scopeVertex = this._resolveScope(scope);
        const returnValueVertex = _parseReturnStatement(assignmentExpr);

        // No return value - implicitly undefined
        if (!returnValueVertex) {
          return;
        }

        const returnConstraint = this._resolveConstraint(
          returnValueVertex,
          scope
        );

        this._link(
          LINK_TYPES.RETURN_VALUE,
          returnConstraint.bottom,
          scopeVertex
        );
        return;
      }
      default: {
        throw new Error(`Unsupported type ${label}`);
      }
    }
  }

  solveConstraints(): Hypergraph<VData> {
    const ptaMatcher = new HMatcher(this.peg);

    // resolve dynamic this-pointers (if we can)
    ptaMatcher.resolvePatternDefinitions(
      {
        firstOnly: true,
        definitions: [
          { vertexLabelPat: "this" },
          {
            labelPred: LINK_TYPES.CLASS,
            through: "outgoing",
            modifier: "rtc",
          },
        ],
      },
      ([thisVertex, classVertex]) => {
        this._link(LINK_TYPES.SOLVED, thisVertex, classVertex);
      }
    );

    // Propagate return value through invocations
    // TODO: deal with non-instance functions as well
    // TODO: treat different objects differently..
    ptaMatcher.resolvePatternDefinitions(
      {
        definitions: [
          { labelPred: LINK_TYPES.INVOCATION, resolve: "targets" }, // Find vertices assigned by invocations
          { labelPred: LINK_TYPES.INVOCATION, through: "incoming" }, // Find incoming invocations
          {
            vertexLabelPat: "this",
            labelPred: LINK_TYPES.FIELD,
            through: "outgoing",
          }, // Find defining instance
          { labelPred: LINK_TYPES.SOLVED, through: "outgoing" }, // Find class declaration
          { labelPred: LINK_TYPES.CLASS, through: "incoming" }, // Find relevant method declaration
          { labelPred: LINK_TYPES.RETURN_VALUE, through: "incoming" }, // Get return value
        ],
      },
      (route) => {
        const [variable, method1, _1, _2, method2, returnValue] = route;

        // TODO: allow query language to do this
        if (method1.label !== method2.label) {
          return;
        }

        this._link(LINK_TYPES.SOLVED, returnValue, variable);
      }
    );

    // TODO: Resolve all special link types

    // Propagate constraints based on assignments
    // TODO: combine into RTC modifier somehow...
    while (true) {
      const changed = false;

      ptaMatcher.resolvePatternDefinitions(
        {
          unreflexive: true,
          definitions: [
            { labelPred: [LINK_TYPES.SOLVED, LINK_TYPES.ASSIGNMENT] },
            {
              labelPred: [LINK_TYPES.SOLVED, LINK_TYPES.ASSIGNMENT],
              through: "outgoing",
            },
            { labelPred: LINK_TYPES.ASSIGNMENT, through: "outgoing" },
          ],
        },
        ([src, _, target]) => {
          this._link(LINK_TYPES.SOLVED, src, target);
        }
      );

      if (!changed) {
        break;
      }
    }

    return this.peg;
  }

  private _addMultiAssignConstraint(
    expr: AnalysisExpression<VData>,
    left: Vertex<VData>,
    right: Vertex<VData>
  ) {
    const leftExpressions = _parseArrayLiteralVertex(
      left
    ) as Hypergraph.Vertex[];
    const rightExpressions = _parseArrayLiteralVertex(
      right
    ) as Hypergraph.Vertex[];

    assert(leftExpressions.length === rightExpressions.length);

    const fakeEquals = new Hypergraph.Vertex<VData>(null);
    fakeEquals.label = "=";

    // Create fake simpler assignments
    for (let i = 0; i < leftExpressions.length; ++i) {
      // TODO: with less boilerplate :-/
      const fakeAssignment = new Hypergraph.Vertex<VData>(null);
      fakeAssignment.incoming = [
        new Hypergraph.Edge("BinaryExpression", [
          leftExpressions[i],
          fakeEquals,
          rightExpressions[i],
        ]),
      ];

      this.addConstraint(_createAnalysisExpression(fakeAssignment, expr.scope));
    }
  }

  private _resolveWriteConstraint(scope, left, right: Vertex<VData>): Vertex {
    const scopeVertex = this._resolveScope(scope);
    const readConstraint = this._resolveConstraint(right, scopeVertex);
    const writeConstraint = this._resolveConstraint(left, scopeVertex);

    assert(!writeConstraint.type);

    // Connect read and write
    const linkType = readConstraint.type || LINK_TYPES.ASSIGNMENT;
    this._link(linkType, readConstraint.bottom, writeConstraint.bottom);

    // Connect objects to scope
    [readConstraint, writeConstraint].forEach(({ top, bottom, type }) => {
      // Don't connect bottom to scope if this is not an assignment constraint
      const v = type ? top : top || bottom;

      if (!v) {
        return;
      }

      // Already connected to scope
      if (v.outgoing.some((_) => _.label === LINK_TYPES.SCOPE)) {
        return;
      }

      // Allow same name under different scopes
      if (!isGlobalName(v.label) && scopeVertex) {
        this._link(LINK_TYPES.SCOPE, v, scopeVertex);
      }
    });

    return readConstraint.bottom;
  }

  private _resolveScope(vertex: Vertex<VData>): Vertex {
    const { label, outgoing } = vertex;
    const scopeVertex = this._getVertexByLabel(label);

    assert(outgoing.length === 1);

    const parentScopeDefinitions = getClosestScopeNameRouteDefinition({
      vertex,
    });
    const parentScopeMatches = this.matcher.collectPatternDefinition(
      parentScopeDefinitions
    );

    if (parentScopeMatches.length) {
      assert(parentScopeMatches.length === 1);

      const [[_, parentScope]] = parentScopeMatches;
      const parentScopeVertex = this._resolveScope(parentScope);

      const [__, label] = getOutgoingEdgeAndLabel(parentScope);
      const linkType =
        label === "ClassDeclaration"
          ? LINK_TYPES.CLASS
          : LINK_TYPES.PARENT_SCOPE;
      this._link(linkType, scopeVertex, parentScopeVertex);
    }

    return scopeVertex;
  }

  private _resolveConstraint(
    vertex: Vertex<VData>,
    scope?: Vertex
  ): ResolvedConstraint {
    // TODO: deal with context (e.g. Call Expression)
    const [edge, label] = getEdgeAndLabel(vertex);

    // Simple name vertex
    if (!edge) {
      // TODO: deal with special values - this, null, undefined
      const vertex = this._getVertexByLabel(label, scope);
      return { top: null, bottom: vertex };
    }

    switch (label) {
      case "NewExpression": {
        const { type } = _parseNewExpression(edge);

        // TODO: args!
        return this._createNewMemoryLocation(type.label, scope);
      }
      case "ObjectLiteralExpression": {
        const properties = _parseObjectLiteralVertex(edge);

        // TODO: work this out (since there are more reads)
        assert(properties.length === 0);

        // TODO: args!
        return this._createNewMemoryLocation(Object.name, scope);
      }
      case "PropertyAccessExpression": {
        const { base, prop } = _parsePropertyAccessExpression(edge);
        const {
          bottom: baseBottom,
          top: baseTop,
          type: baseType,
        } = this._resolveConstraint(base, scope);
        const {
          bottom: propBottom,
          top: propTop,
          type: propType,
        } = this._resolveConstraint(prop, scope);

        assert(!baseType);
        assert(!propType);
        assert(!propTop);

        // TODO: add field link
        this._link(LINK_TYPES.FIELD, propBottom, baseBottom);

        return { top: baseTop || baseBottom, bottom: propBottom };
      }
      case "CallExpression": {
        const { caller, args } = _parseCallExpression(edge);
        const { bottom, top, type } = this._resolveConstraint(caller, scope);

        // TODO: deal with args

        assert(!type);

        return { bottom, top, type: LINK_TYPES.INVOCATION };
      }
      case "ArrowFunction": {
        // TODO: bind `this` inside arrow
        // TODO: parse it and give it a name?
        const vertex = this._getVertexByLabel("undefined", scope);
        return { top: null, bottom: vertex };
      }
      case "ParenthesizedExpression": {
        const vertex = _parseParanthesizedExpression(edge);
        return this._resolveConstraint(vertex, scope);
      }
      case "BinaryExpression": {
        const [left, op, right] = _parseBinaryExpression(edge);

        // TODO: support multiple reads
        assert(op === "=");

        const vertex = this._resolveWriteConstraint(scope, left, right);
        return { top: null, bottom: vertex };
      }
      default:
        throw Error(`Don't know what to do wih ${label} vertex`);
    }
  }

  private _getVertexByLabel(label: string, scope?: Vertex): Vertex {
    const vertices = Array.from(
      lazyFilter(this.peg.vertices.values(), (v) => v.label === label)
    );

    // Known name - verify that the scope is the same
    const relevantVertices = vertices.filter((vertex) => {
      const { outgoing } = vertex;

      // If this is global/class scope name and is used as field - we don't want this vertex
      if (!scope && outgoing.some((_) => _.label === LINK_TYPES.FIELD)) {
        return false;
      }

      const scopeEdges = outgoing.filter((_) => _.label === LINK_TYPES.SCOPE);

      // Some objects won't have a scope, like null or classes
      if (scopeEdges.length === 0) {
        return !scope;
      }

      assert(scopeEdges.length === 1);

      const existingScope = scopeEdges[0].target;
      return scope === existingScope;
    });

    assert(relevantVertices.length <= 1);

    return relevantVertices[0] || this.peg._fresh(label);
  }

  private _createNewMemoryLocation(
    type: string,
    scope?: Vertex
  ): ResolvedConstraint {
    // TODO: include data like line, ctor args etc...

    const vertex = this._getVertexByLabel(type, scope);
    return { top: null, bottom: vertex, type: LINK_TYPES.INSTANTIATION };
  }

  private _link(type: string, source, target: Vertex) {
    // TODO: get rid of this
    if (
      this.peg.edges.some(
        (e) =>
          e.label === type &&
          e.target === target &&
          e.sources.indexOf(source) !== -1
      )
    ) {
      return;
    }

    this.peg.add([
      new Hypergraph.Edge(type, [source], target as Hypergraph.Vertex),
    ]);
  }
}

// TODO: move into syntax or something!
const GLOBAL_NAMES = new Set(["null", "undefined"]);

function isGlobalName(name: string): boolean {
  return GLOBAL_NAMES.has(name);
}

function _isArrayLiteralVertex(vertex: Vertex): boolean {
  return (
    vertex.incoming &&
    vertex.incoming.length === 1 &&
    vertex.incoming[0].label === "ArrayLiteralExpression"
  );
}

function _parseArrayLiteralVertex(vertex: Vertex): Vertex[] {
  assert(_isArrayLiteralVertex(vertex));

  // TODO: with pattern syntax
  const [edge] = vertex.incoming;
  assert(edge.sources.length === 3);

  const [lparan, syntaxList, rparan] = edge.sources;
  assert(lparan.label === "[");
  assert(rparan.label === "]");

  return _parseSyntaxList(syntaxList);
}

function _parseObjectLiteralVertex(edge: Edge): Vertex[] {
  assert(edge.label === "ObjectLiteralExpression");

  const [lparan, syntaxList, rparan] = edge.sources;
  assert(lparan.label === "{");
  assert(rparan.label === "}");

  // TODO: this may be completely wrong (try with actual properties)
  return _parseSyntaxList(syntaxList);
}

function _parseSyntaxList(vertex: Vertex): Vertex[] {
  const [edge, label] = getEdgeAndLabel(vertex);
  assert(label === "SyntaxList");

  return edge.sources.filter((_) => _.label !== ",");
}

function _parsePropertyAccessExpression(
  edge: Edge
): { base: Vertex; prop: Vertex } {
  assert(edge.label === "PropertyAccessExpression");
  assert(edge.sources.length === 3);

  const [base, dot, prop] = edge.sources;
  assert(dot.label === ".");

  return {
    base,
    prop,
  };
}

function _parseCallExpression(edge: Edge): { caller: Vertex; args: Vertex[] } {
  assert(edge.label === "CallExpression");
  assert(edge.sources.length === 4);

  const [caller, lparan, args, rparan] = edge.sources;

  assert(lparan.label === "(");
  assert(rparan.label === ")");

  return {
    caller,
    args: _parseSyntaxList(args),
  };
}

function _parseNewExpression(edge: Edge): { type: Vertex } {
  assert(edge.label === "NewExpression");
  assert(edge.sources.length === 2);

  // TODO: what about args?
  const [newKeyword, type] = edge.sources;

  assert(newKeyword.label === "new");

  // TODO: include defining file etc
  return {
    type,
  };
}

function _parseReturnStatement(edge: Edge): Vertex {
  assert(edge.label === "ReturnStatement");
  assert(edge.sources.length >= 2);

  const [returnKeyword, ...rest] = edge.sources;

  assert(returnKeyword.label === "return");

  // Get rid of semicolon
  if (rest[rest.length - 1].label === ";") {
    rest.pop();
  }

  // No return value - implicitly undefined
  if (rest.length === 0) {
    return null;
  }

  assert(rest.length === 1);
  return rest[0];
}

function _parseParanthesizedExpression(edge: Edge): Vertex {
  assert(edge.label === "ParenthesizedExpression");
  assert(edge.sources.length === 3);

  const [lparan, subexpression, rparan] = edge.sources;

  assert(lparan.label === "(");
  assert(rparan.label === ")");

  return subexpression;
}

function _parseBinaryExpression(
  edge: Edge,
  assertType = true
): [Vertex, string, Vertex] {
  if (assertType) {
    assert(edge.label === "BinaryExpression");
  }

  assert(edge.sources.length === 3);

  const [left, op, right] = edge.sources;

  return [stripGibberish(left), op.label, stripGibberish(right)];
}

function stripGibberish(vertex: Vertex): Vertex {
  const [edge, label] = getEdgeAndLabel(vertex);
  if (!edge) {
    return vertex;
  }

  const { sources } = edge;

  switch (label) {
    case "TypeAssertionExpression":
      // TODO: with pattern syntax
      assert(sources.length === 4);
      return sources[3];
    default:
      return vertex;
  }
}

function getEdgeAndLabel(vertex: Vertex): [Edge, string] {
  return _getEdgeAndLabel(vertex, vertex.incoming);
}

function _getEdgeAndLabel(vertex: Vertex, edgeGroup: Edge[]): [Edge, string] {
  if (!edgeGroup || edgeGroup.length !== 1) {
    return [null, vertex.label];
  }

  assert(edgeGroup.length === 1);

  const [edge] = edgeGroup;
  return [edge, edge.label];
}

function getOutgoingEdgeAndLabel(vertex: Vertex): [Edge, string] {
  return _getEdgeAndLabel(vertex, vertex.outgoing);
}
