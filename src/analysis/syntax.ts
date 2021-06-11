import * as SetOps from "infra/setops";

export const ALL = new Set<TypeScriptSyntaxToken>([
  "ClassDeclaration",
  "MethodDeclaration",
  "Constructor",
  "Block",
  // "block",
  "CatchClause",
  "SyntaxList",
  "VariableDeclaration",
  "VariableDeclarationList",
  "FirstStatement",
  "Parameter",
  "ArrowFunction",
  "ReturnStatement",
  "CallExpression",
  "BinaryExpression",
  "ArrayLiteralExpression",
  "ObjectLiteralExpression",
  "TypeAssertionExpression",
  "BreakStatement",
  "PropertyAccessExpression",
  "NewExpression",
  "ThrowStatement",
  "IfStatement",
  "ExpressionStatement",
  "WhileStatement",
  "ParenthesizedExpression",
]);

export const SCOPES: TypeScriptSyntaxToken[] = [
  "ClassDeclaration",
  "MethodDeclaration",
  "Block",
  "CatchClause",
  "Constructor",
];

export const EXPRESSIONS = SetOps.diff(ALL, SCOPES);

export function isSyntaxToken(token): boolean {
  return ALL.has(token);
}

export const isNonSyntaxToken = (token) => !isSyntaxToken(token);

export const RESERVED_KEYWORDS = new Set(["class", "function"]);
