module.exports = {
    env: {
        browser: true
    },
    extends: [
        "eslint:recommended",
        "plugin:react/recommended",
        "plugin:@typescript-eslint/eslint-recommended",
        "plugin:react-hooks/recommended",
        "plugin:prettier/recommended",
        "prettier"
    ],
    globals: {
        Atomics: "readonly",
        SharedArrayBuffer: "readonly"
    },
    ignorePatterns: ["*.html", "*.md", "*.scss", "*.css", "*.json", "*.l", "*.y"],
    parser: "@typescript-eslint/parser",
    parserOptions: {
        ecmaFeatures: {
            "jsx": true
        },
        ecmaVersion: 2021,
        sourceType: "module"
    },
    plugins: [
        "react",
        "@typescript-eslint",
        "prettier"
    ],
    root: true,
    rules: {
        "curly": "error",
        "no-unused-vars": "warn",
        "react-hooks/rules-of-hooks": "error",
        "react-hooks/exhaustive-deps": "warn",
        "react/prop-types": "warn",
    },
    settings: {
        react: {
            version: "detect"
        }
    }
};