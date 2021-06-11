import { v1 as uuidv1 } from "uuid";
import { Node, Edge, Options, Network, IdType } from "vis-network";
import { DataSet } from "vis-data";
import type { Ast } from "../syntax/parser";

class Hypergraph<VData = any> {
  vertices: Map<Hypergraph.VertexId, Hypergraph.Vertex<VData>> = new Map();
  edges: Hypergraph.Edge[] = [];

  _max: Hypergraph.VertexId = 0;

  get nodes() {
    const v = new Set<Hypergraph.Vertex<VData>>();
    for (const e of this.edges) {
      for (const u of e.incident) {
        v.add(u);
      }
    }
    return v;
  }

  add(edges: Hypergraph.EdgeData[]) {
    const vmap = new Map<Hypergraph.VertexId, Hypergraph.Vertex<VData>>(),
      get = (u: Hypergraph.VertexId | Hypergraph.Vertex<VData>) => {
        if (typeof u === "number") {
          if (u > 0) {
            return this._get(u);
          } else {
            let v = vmap.get(u);
            if (!v) {
              v = this._fresh();
              vmap.set(u, v);
            }
            return v;
          }
        } else {
          if (!this.vertices.get(u.id)) {
            this.vertices.set(u.id, u);
          }
          return u;
        }
      };
    for (const e of edges) {
      for (const u of [e.target, ...e.sources]) {
        if (typeof u === "number") {
          this._max = Math.max(this._max, u);
        }
      }
    }
    const added = edges.map((ed) => {
      const e = new Hypergraph.Edge(
        ed.label,
        ed.sources.map(get),
        get(ed.target)
      );
      e.sources.forEach((u) => u.outgoing.push(e));
      e.target.incoming.push(e);
      return e;
    });
    this.edges.push(...added);
    return added;
  }

  remove(edges: Hypergraph.Edge[]) {
    for (const e of edges) {
      e.target.incoming = e.target.incoming.filter((ue) => ue !== e);
      for (const u of e.sources) {
        u.outgoing = u.outgoing.filter((ue) => ue !== e);
      }
    }
    this.edges = this.edges.filter((e) => !edges.includes(e));
  }

  merge(vertices: Hypergraph.Vertex<VData>[]) {
    const rep = vertices[0];
    for (const u of vertices.slice(1)) {
      for (const e of u.incoming) {
        e.target = rep;
        rep.incoming.push(e);
      }
      for (const e of u.outgoing) {
        e.sources = e.sources.map((v) => (u === v ? rep : v));
        rep.outgoing.push(e);
      }
      this.vertices.delete(u.id);
    }
  }

  fromAst(ast: Ast) {
    let c: Hypergraph.VertexId = this._max;
    const aux = (ast: Ast) => {
      const root = ++c,
        u = this._get(root);
      // @ts-ignore
      if (ast.children) {
        // @ts-ignore

        const subs = ast.children.map(aux);
        this.add([{ label: ast.type || "", sources: subs, target: root }]);
      } else {
        // @ts-ignore
        u.label = ast.text;
      }
      u.data = (<any>{ ast }) as VData; /** @oops */
      return root;
    };
    aux(ast);
    this._max = c;
    return this;
  }

  _get(id: Hypergraph.VertexId) {
    let v = this.vertices.get(id);
    if (!v) {
      v = new Hypergraph.Vertex(id);
      this.vertices.set(id, v);
    }
    return v;
  }

  _fresh(label?: string) {
    const u = new Hypergraph.Vertex(++this._max);
    u.label = label;

    this.vertices.set(u.id, u);
    return u;
  }

  toVis(edgeNodeProfile = null) {
    const nodes = new DataSet<CustomizedNode>(
      [...this.vertices.values()].map((u) => {
        return {
          id: u.id,
          innerNode: false,
          label: u.label || `${u.id}`,
          shape: "box",
          token: u.label ? true : false,
          ...(u.label ? LIT : DUMMY),
        };
      })
    );

    // Collect edges
    const edges = new DataSet<Edge>([]);

    for (const e of this.edges) {
      const nucleus = uuidv1();
      nodes.add([{ id: nucleus, label: e.label, ...edgeNodeProfile }]);
      edges.add([
        { from: nucleus, to: e.target.id, ...TO },
        ...e.sources.map((v) => ({ from: v.id, to: nucleus, ...FROM })),
      ]);
    }

    return new HypergraphView(this, {
      nodes: nodes,
      edges: edges,
    });
  }
}

interface CustomizedNode extends Node {
  token: boolean;
  innerNode: boolean;
}

namespace Hypergraph {
  export type VertexId = number;

  export class Vertex<Data = any> {
    id: VertexId;
    label: string;
    data: Data;
    incoming: Edge[] = [];
    outgoing: Edge[] = [];
    constructor(id: VertexId) {
      this.id = id;
    }
  }

  export class Edge {
    label: string;
    sources: Vertex[];
    target: Vertex;
    constructor(label: string, sources: Vertex[], target: Vertex = null) {
      this.label = label;
      this.sources = sources;
      this.target = target;
    }
    get incident() {
      return [this.target, ...this.sources];
    }
  }

  export type EdgeData = {
    label: string;
    sources: (Vertex | VertexId)[];
    target: Vertex | VertexId;
  };
}

const NUCLEUS = {
    shape: "box",
    color: "#cca",
    shapeProperties: { borderRadius: 99 },
    font: { color: "#212121" },
  },
  TO = {
    arrows: { to: { enabled: true, scaleFactor: 0.5 } },
    color: "#997",
    length: 1,
  },
  FROM = {
    arrows: { middle: { enabled: true, scaleFactor: 0.5 } },
    color: "#997",
    length: 1,
  },
  DUMMY = {
    color: "#7bb2e8",
    shapeProperties: { borderRadius: 5 },
    font: { color: "#212121" },
  },
  LIT = {
    color: "#9d9",
    shapeProperties: { borderRadius: 0 },
    font: { color: "#212121" },
  },
  FAINT = {
    color: {
      background: "#ddd",
      border: "#bbb",
      highlight: { background: "#ddd", border: "#bbb" },
    },
    font: { color: "#ccc" },
  },
  HIE = {
    hierarchical: {
      direction: "DU",
      sortMethod: "directed",
      levelSeparation: 75,
    },
  },
  PHY = {
    physics: {
      enabled: true,
      solver: "repulsion",
      minVelocity: 4,
      timestep: 1,
      hierarchicalRepulsion: {
        nodeDistance: 50,
        avoidOverlap: 1,
      },
    },
  };

interface VisSelection {
  edges: string[];
  nodes: Array<string | number>;
}

class HypergraphView {
  peg: Hypergraph;
  data: HypergraphView.Data;
  basePeg: Hypergraph;
  baseData: HypergraphView.Data;

  options: Options = {
    layout: {
      improvedLayout: false,
      ...HIE,
    },
    interaction: {
      zoomSpeed: 0.3,
    },
    ...PHY,
  };
  network: Network;

  constructor(peg: Hypergraph, data: HypergraphView.Data) {
    this.peg = peg;
    this.basePeg = peg;
    this.data = data;
    this.baseData = data;
    if (this.data.options) {
      this.options = this.data.options;
    }
  }

  render(on: HTMLElement, callback?) {
    this.network = new Network(on, this.data, this.options);
    this.network.on("stabilizationIterationsDone", callback);

    return this;
  }

  nail() {
    this.network.storePositions();
    this.network.setOptions({ layout: { hierarchical: { enabled: false } } });
    this.data.nodes.update(
      this.data.nodes.getIds().map((id) => ({ id, fixed: true }))
    );
    this.network.setOptions({ physics: { solver: "repulsion" } });
  }

  fade() {
    this.data.nodes.update(
      this.data.nodes.getIds().map((id) => ({ id, ...FAINT }))
    );
    this.data.edges.update(
      this.data.edges
        .getIds()
        .map((id) => ({ id, color: "#ccc", smooth: false }))
    );
  }

  merge(that: HypergraphView) {
    that.data.nodes.forEach((u) => {
      if (!this.data.nodes.get(u.id)) {
        this.data.nodes.add(u);
      }
    });
    that.data.edges.forEach((e) => {
      this.data.edges.add(e);
    });
  }

  untangle() {
    for (const row of this.iterLevels()) {
      this.sortHorizontally(row);
    }
  }

  *iterLevels() {
    const yvisited = new Set<number>();
    for (const u of Object.values(this._nodes)) {
      if (!yvisited.has(u.y)) {
        yvisited.add(u.y);
        yield this.getLevel(u.id);
      }
    }
  }

  selectLevel(node?: IdType) {
    this.network.selectNodes(this.getLevel(node).map((u) => u.id));
  }

  getLevel(node?: IdType) {
    if (!node) {
      node = this.network.getSelectedNodes()[0];
      if (!node) {
        return;
      }
    }
    const pos = this.network.getPosition(node);
    return Object.values(this._nodes).filter((u) => u.y == pos.y);
  }

  sortHorizontally(nodes: Node[]) {
    if (!nodes) {
      const _m = this._nodes;
      nodes = this.network.getSelectedNodes().map((id) => _m[id]);
    }
    const posx = nodes.map((u) => u.x).sort((x1, x2) => x1 - x2);
    for (const i in nodes) {
      this.network.moveNode(nodes[i].id, posx[i], nodes[i].y);
    }
  }

  get _nodes() {
    /** @oops */
    return (<any>this.network).body.nodes as { [id: string]: CustomizedNode };
  }

  get _edges() {
    /** @oops */
    return (<any>this.network).body.edges as { [id: string]: Edge };
  }

  overlay(overlayView: HypergraphView, disableBase = true) {
    this.nail();

    if (disableBase) {
      this.fade();
    }

    this.merge(overlayView);
  }

  removeOverlay(overlayView: HypergraphView) {
    this.nail();

    overlayView.data.nodes.forEach((u) => {
      this.data.nodes.remove(u);
    });
    overlayView.data.edges.forEach((e) => {
      this.data.edges.remove(e);
    });

    // Restore to the original view
    this.baseData.nodes.update(
      this.baseData.nodes.map((node) => {
        if (node.token) {
          return { id: node.id, fixed: false, ...LIT };
        } else if (node.innerNode) {
          return { id: node.id, fixed: false, ...NUCLEUS };
        } else {
          return { id: node.id, fixed: false, ...DUMMY };
        }
      })
    );
    this.baseData.edges.update(
      this.baseData.edges.getIds().map((id) => ({ id, ...TO }))
    );
  }
}

namespace HypergraphView {
  export type Data = {
    nodes: DataSet<CustomizedNode, "id">;
    edges: DataSet<Edge, "id">;
    options?: Options /* not strictly part of the data, but returned from e.g. parseDOTNetwork */;
  };
}

export { Hypergraph, HypergraphView };
