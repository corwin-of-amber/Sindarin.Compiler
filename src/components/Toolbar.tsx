import React from "react";
import { allAnalysisTypes, allLanguages } from "config";

export default function Toolbar({
  language,
  setLanguage,
  analysisType,
  setAnalysisType,
}): JSX.Element {
  return (
    <div id="toolbar">
      <div className="widget">
        <label>Source language:</label>
        <select
          name="languages"
          id="languages"
          value={language}
          onChange={(event) => {
            setLanguage(event.target.value as Language);
          }}>
          {allLanguages.map((language, index) => (
            <option key={index} value={language}>
              {language}
            </option>
          ))}
        </select>
      </div>
      <div className="widget">
        <label>Analysis: </label>
        <select
          id="analysis-type"
          value={analysisType}
          onChange={(event) => {
            setAnalysisType(event.target.value);
          }}>
          {allAnalysisTypes.map(([type, displayName]) => (
            <option key={type} value={type}>
              {displayName}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
