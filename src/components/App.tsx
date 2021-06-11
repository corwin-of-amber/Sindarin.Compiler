import React, { useEffect, useState } from "react";
import config from "config";
import Resizer from "./Resizer";
import EditorPanel from "./EditorPanel";
import Toolbar from "./Toolbar";
import AstPanel from "./AstPanel";
import PegPanel from "./PegPanel";

export default function App() {
  const [ast, setAst] = useState(null);
  const [code, setCode] = useState("");
  const [highlighted, setHighlighted] = useState(null);
  const [language, setLanguage] = useState<Language>("TypeScript");
  const [parseErrorMsg, setParseErrorMsg] = useState("");
  const [analysisType, setAnalysisType] = useState<AnalysisType>("none");

  useEffect(() => {
    if (!code) {
      return;
    }
    try {
      const parser = config[language].parser;
      setAst(parser.parse(code));
      setParseErrorMsg("");
    } catch (e) {
      setAst(null);
      setParseErrorMsg(e.toString());
    }
    setHighlighted(null);
  }, [code]);

  useEffect(() => {
    setAst(null);
    fetch(config[language].filename).then(async (res) => {
      res.text().then(setCode);
    });
  }, [language]);

  return (
    <div id="ide">
      <Toolbar
        language={language}
        setLanguage={setLanguage}
        analysisType={analysisType}
        setAnalysisType={setAnalysisType}
      />
      <div id="panel-wrapper">
        <EditorPanel
          code={code}
          highlighted={highlighted}
          language={language}
          setCode={setCode}
        />
        <Resizer />
        <AstPanel
          ast={ast}
          highlighted={highlighted}
          parseErrorMsg={parseErrorMsg}
          setHighlighted={setHighlighted}
        />
        <Resizer />
        <PegPanel
          analysisType={analysisType}
          ast={ast}
          language={language}
          highlighted={highlighted}
        />
      </div>
    </div>
  );
}
