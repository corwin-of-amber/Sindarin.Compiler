type TypeScriptSyntaxToken =
  | "ClassDeclaration"
  | "MethodDeclaration"
  | "Constructor"
  | "CatchClause"
  | "SyntaxList"
  | "VariableDeclaration"
  | "VariableDeclarationList"
  | "FirstStatement"
  | "Parameter"
  | "ArrowFunction"
  | "ReturnStatement"
  | "CallExpression"
  | "BinaryExpression"
  | "ArrayLiteralExpression"
  | "ObjectLiteralExpression"
  | "TypeAssertionExpression"
  | "BreakStatement"
  | "PropertyAccessExpression"
  | "NewExpression"
  | "ThrowStatement"
  | "IfStatement"
  | "ExpressionStatement"
  | "Block"
  | "WhileStatement"
  | "ParenthesizedExpression";

// TODO: put more languages here
type SyntaxToken = TypeScriptSyntaxToken;
