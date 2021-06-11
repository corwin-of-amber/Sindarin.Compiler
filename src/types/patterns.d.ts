type Route<VData> = Vertex<VData>[];

type VertexId = number;

interface Vertex<VData = any> {
  id: VertexId;
  label: string;
  incoming: Edge[];
  outgoing: Edge[];
  data?: VData;
}

interface Edge {
  label: string;
  sources: Vertex[];
  target: Vertex;
}

type LabelPat =
  | SyntaxToken
  | SyntaxToken[]
  | Set<SyntaxToken>
  | RegExp
  | LabelPred;
type LabelPred = (l: string) => boolean;
type ObjectWithLabel = (obj: { label: string }) => boolean;

interface PatternDefinitionPayload {
  vertexLabelPat?: LabelPat; // Pattern for vertex label matching
  visited?: Set<string>; // Visited nodes by `getRouteKey`
  firstOnly?: boolean;
  topLevel?: boolean; // Is Top Level of search
  resolve?: "sources" | "targets";
  unreflexive?: boolean;
}

/*
The main object for the Pattern Definition API
It contains options to modify the matching process (firstOnly, unreflexive)
Also contains the array of definitions - which result the in the vertices returned in the matched Route
 */
interface RoutePatternDefinition {
  definitions?: PatternDefinition[];
  firstOnly?: boolean; // Get only first route (per stating-set element)
  unreflexive?: boolean; // If true - don't match a vertex with itself
}

/*
The basic block of pattern matching
It matches a single vertex
 */
interface PatternDefinition {
  // Options to find a vertex to match
  vertex?: { id: VertexId; label: string }; // For first definition only!
  labelPred?: LabelPat; // Label matcher (against an edge)
  index?: number; // Child vertex resolution

  // Matching modifiers - change the way we match
  through?: "incoming" | "outgoing"; // Traversal direction
  resolve?: "sources" | "targets"; // Resolution node direction (defaults to sources) - because we initially match edges
  modifier?: "rtc"; // Traversal type
  excluding?: LabelPat; // Exclude labels (don't go throw them, important with RTC)
  vertexLabelPat?: LabelPat; // Filter for vertices label (in addition to edge matching)
}
