import fs from "fs";

const IDENTIFIER = /[_a-zA-Z][_a-zA-Z0-9]*/;
const KEYWORDS = {};
const OPERATORS = {};

const GRAMMAR = {
  Lexer: undefined,
  ParserRules: [],
  ParserStart: "translation_unit",
};

function matchExact(s, re) {
  return s.replace(re, "") === "";
}

function importFlex(lfile) {
  const txt = fs.readFileSync(lfile, "utf-8");

  for (const mo of txt.matchAll(/"([^\n"]*)?".*return\((.*?)\)/g)) {
    if (matchExact(mo[1], IDENTIFIER)) {
      KEYWORDS[mo[2]] = mo[1];
    } else if (!["CONSTANT", "STRING_LITERAL"].includes(mo[2])) {
      OPERATORS[mo[2][0] == "'" ? mo[1] : mo[2]] = mo[1];
    }
  }
}

function importBison(yfile) {
  const txt = fs.readFileSync(yfile, "utf-8");

  const SPECIAL = ["IDENTIFIER", "CONSTANT"];

  function el(spec) {
    if (
      Object.prototype.hasOwnProperty.call(KEYWORDS, spec) ||
      Object.prototype.hasOwnProperty.call(OPERATORS, spec) ||
      SPECIAL.includes(spec)
    ) {
      return { type: spec };
    } else if (spec.startsWith("'") && spec.endsWith("'")) {
      return { literal: spec.slice(1, -1) };
    } else {
      return spec;
    }
  }

  for (const mo of txt.matchAll(/\n([a-z_]+)\s*:\s*([^]*?)\s*;\n/g)) {
    for (const prod of mo[2].split(/\s*[|]\s*/)) {
      GRAMMAR.ParserRules.push({
        name: mo[1],
        symbols: prod.split(/\s+/).map(el),
      });
    }
  }
}

importFlex("src/assets/c99.l");
importBison("src/assets/c99.y");

fs.writeFileSync(
  "src/syntax/c99.json",
  JSON.stringify({ OPERATORS, KEYWORDS, GRAMMAR })
);
