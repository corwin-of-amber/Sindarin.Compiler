import React, { useState } from "react";
import type { Ast } from "syntax/parser";
import { FadeLoader } from "react-spinners";

interface AstPanelProps {
  ast: Ast | null;
  highlighted: Ast;
  parseErrorMsg: string;
  setHighlighted: (ast?: Ast) => void;
}

export default function AstPanel(props: AstPanelProps) {
  return (
    <div className="panel" id="ast-panel">
      {props.ast ? (
        <TreeView
          tree={props.ast}
          depth={0}
          highlighted={props.highlighted}
          setHighlighted={props.setHighlighted}
        />
      ) : (
        <FadeLoader
          loading={!props.parseErrorMsg}
          css="position: absolute; top: 50%; left: 50%;"
        />
      )}
      <div
        id="parse-error"
        style={{ display: props.parseErrorMsg ? "block" : "none" }}>
        {props.parseErrorMsg}
      </div>
    </div>
  );
}

function TreeView(props: {
  tree: Ast;
  depth: number;
  highlighted: Ast;
  setHighlighted: (ast?: Ast) => void;
}): JSX.Element {
  const [expanded, setExpanded] = useState(false);

  if (!props.tree) {
    return <span />;
  } else {
    return (
      <div
        className="node-wrapper"
        style={{ transform: `translate(${props.depth + 15}px)` }}>
        <span
          className="hoverable"
          onClick={() => {
            setExpanded(!expanded);
          }}
          style={{
            visibility:
              props.tree.children && props.tree.children.length >= 1
                ? "visible"
                : "hidden",
            textAlign: "center",
          }}>
          {expanded ? "▾ " : "‣ "}
        </span>
        <span
          className={props.tree.range != null ? "node hoverable" : "node"}
          style={{
            filter: props.tree === props.highlighted ? "invert(50%)" : "none",
          }}
          onClick={() => {
            if (props.tree.range == null) {
              return;
            }
            if (props.tree === props.highlighted) {
              props.setHighlighted();
            } else {
              props.setHighlighted(props.tree);
            }
          }}>
          {props.tree.type}
        </span>
        {props.tree.children && props.tree.children.length
          ? props.tree.children.map((child: Ast, i: number) => (
              <div style={{ display: expanded ? "block" : "none" }} key={i}>
                <TreeView
                  tree={child}
                  depth={props.depth + 1}
                  highlighted={props.highlighted}
                  setHighlighted={props.setHighlighted}
                />
              </div>
            ))
          : null}
      </div>
    );
  }
}
