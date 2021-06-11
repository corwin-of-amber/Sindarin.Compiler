import React, { useEffect, useRef, useState } from "react";
import { Hypergraph, HypergraphView } from "analysis/hypergraph";
import { FadeLoader } from "react-spinners";
import config, { graphNodeThreshold } from "config";

export default function PegPanel({ analysisType, ast, highlighted, language }) {
  const viewRef = useRef(null);
  const [numVertices, setNumVertices] = useState(0);
  const [rendering, setRendering] = useState(true);
  const [astGraph, setAstGraph] = useState<Hypergraph>(null);
  const astGraphView = useRef<HypergraphView>(null);
  const lexicalGraphView = useRef<HypergraphView>(null);
  const pointsToGraphView = useRef<HypergraphView>(null);

  function clearCanvas(): void {
    if (viewRef.current) {
      viewRef.current.querySelector("canvas")?.remove();
    }
  }

  function setup() {
    if (highlighted) {
      setAstGraph(new Hypergraph().fromAst(highlighted));
    } else if (ast) {
      setAstGraph(new Hypergraph().fromAst(ast));
    } else {
      clearCanvas();
    }
  }

  useEffect(() => {
    if (!astGraph) {
      return;
    }

    clearCanvas();
    setNumVertices(astGraph.vertices.size);

    if (astGraph.vertices.size > graphNodeThreshold) {
      setRendering(false);
    } else {
      if (viewRef.current) {
        setRendering(true);
        astGraphView.current = astGraph.toVis().render(viewRef.current, () => {
          setRendering(false);

          lexicalGraphView.current &&
            astGraphView.current.removeOverlay(lexicalGraphView.current);
          pointsToGraphView.current &&
            astGraphView.current.removeOverlay(pointsToGraphView.current);

          if (analysisType === "lexical") {
            const lexicalScopeAnalysis = config[language].lexical;
            const lexicalGraph = lexicalScopeAnalysis(astGraph);
            lexicalGraphView.current = lexicalGraph.toVis();
            astGraphView.current.overlay(lexicalGraphView.current);
          }

          if (analysisType === "pointsTo") {
            const pointsToAnalysis = config[language].pointsTo;
            if (pointsToAnalysis) {
              const pointsToGraph = pointsToAnalysis(astGraph);
              pointsToGraphView.current = pointsToGraph.toVis();
              astGraphView.current.overlay(pointsToGraphView.current);
            }
          }
        });
      }
    }
  }, [analysisType, astGraph, language]);

  useEffect(() => {
    setup();
  }, [ast, highlighted]);

  useEffect(() => {
    setup();
  }, []);

  return (
    <div className="panel" id="graph-panel">
      <FadeLoader
        loading={rendering}
        css="position: absolute; top: 50%; left: 50%;"
      />
      <div
        style={{
          display:
            numVertices <= graphNodeThreshold && !rendering ? "block" : "none",
        }}
        ref={viewRef}
        id="graph-container"
      />
      <div
        style={{
          display:
            numVertices > graphNodeThreshold && !rendering ? "block" : "none",
        }}>
        {`Too many vertices: ${numVertices}`}
      </div>
    </div>
  );
}
