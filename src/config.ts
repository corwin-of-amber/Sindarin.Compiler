import { lexicalScopeAnalysis as lexicalScopeAnalysisC } from "analysis/C/lexicalScope";
import { lexicalScopeAnalysis as lexicalScopeAnalysisTS } from "analysis/TypeScript/lexicalScope";
import { pointsToAnalysis } from "analysis/TypeScript/pointsTo";
import { C99Parser } from "syntax/c99";
import { TypeScriptParser } from "syntax/typescript-ast";

export const allLanguages: Language[] = ["C", "TypeScript"];
export const allAnalysisTypes: [AnalysisType, string][] = [
  ["none", "None"],
  ["lexical", "Lexical scope"],
  ["pointsTo", "Points-to"],
];

export const graphNodeThreshold = 600;

export default {
  C: {
    parser: new C99Parser(),
    lexical: lexicalScopeAnalysisC,
    pointsTo: null,
    filename: "data/c/bincnt.c",
  },
  TypeScript: {
    parser: new TypeScriptParser(),
    lexical: lexicalScopeAnalysisTS,
    pointsTo: pointsToAnalysis,
    filename: "data/typescript/lib/net_with_complications.ts",
  },
};
