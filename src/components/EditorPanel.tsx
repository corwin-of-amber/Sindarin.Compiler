import React, { useEffect, useRef, useState } from "react";
import MonacoEditor from "react-monaco-editor";
import type { Ast } from "syntax/parser";
import { FadeLoader } from "react-spinners";

interface EditorPanelProps {
  code: string;
  language: string;
  highlighted: Ast;
  setCode: (code: string) => void;
}

export default function EditorPanel(props: EditorPanelProps) {
  const editor = useRef(null);
  const [deltaDecorations, setDeltaDecorations] = useState([]);
  const [loading, setLoading] = useState(true);
  const unhighlightedRange = {
    startLineNumber: 0,
    startColumn: 0,
    endLineNumber: 0,
    endColumn: 0,
  };
  const [highlightedRange, setHighlightedRange] = useState(unhighlightedRange);

  useEffect(() => {
    if (!editor.current) {
      return;
    }

    if (props.highlighted && props.highlighted.range) {
      setHighlightedRange(props.highlighted.range);
    } else {
      setHighlightedRange(unhighlightedRange);
    }
  }, [props.code, props.highlighted]);

  useEffect(() => {
    setDeltaDecorations(
      editor.current.deltaDecorations(deltaDecorations, [
        {
          range: highlightedRange,
          options: { className: "editorRangeHighlight" },
        },
      ])
    );
  }, [highlightedRange]);

  return (
    <div className="panel">
      <FadeLoader
        loading={loading}
        css="position: absolute; top: 50%; left: 50%;"
      />
      <div id="editor-panel" style={{ display: loading ? "none" : "block" }}>
        <MonacoEditor
          language={props.language.toLowerCase()}
          value={props.code}
          theme="vs"
          options={{
            minimap: {
              enabled: false,
            },
            automaticLayout: true,
            quickSuggestions: false,
            occurrencesHighlight: false,
            selectionHighlight: false,
            codeLens: false,
            suggestOnTriggerCharacters: false,
            scrollBeyondLastLine: false,
            hideCursorInOverviewRuler: true,
            renderLineHighlightOnlyWhenFocus: true,
            overviewRulerBorder: false,
          }}
          onChange={(newValue) => {
            props.setCode(newValue);
          }}
          editorDidMount={(monacoEditor) => {
            editor.current = monacoEditor;
            monacoEditor.onDidChangeModelContent(() => {
              setLoading(false);
              monacoEditor.setPosition({ lineNumber: 1, column: 1 });
            });
            monacoEditor.onDidChangeModelLanguage(() => {
              setLoading(true);
            });
          }}
        />
      </div>
    </div>
  );
}
