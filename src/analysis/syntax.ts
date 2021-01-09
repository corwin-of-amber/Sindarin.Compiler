import * as SetOps from "../infra/setops";

// TODO: SYNTAX = { ... }, SYNCAT = new Set(Object.values(SYNTAX))
export const VARIABLE_DECLARATION = "VariableDeclaration";

export const SYNCAT = /* should be all syntactic edge types */
    new Set(["SyntaxList", "PropertyAccessExpression", "CallExpression",
        VARIABLE_DECLARATION, "VariableDeclarationList", "FirstStatement",
        "BinaryExpression", "BreakStatement", "NewExpression",
        "ThrowStatement", "IfStatement", "ExpressionStatement",
        "Block", "WhileStatement", "MethodDeclaration"]);
export const SCOPES = ['ClassDeclaration', 'MethodDeclaration', 'Block'];
export const EXPRESSIONS = SetOps.diff(SYNCAT, SCOPES);
