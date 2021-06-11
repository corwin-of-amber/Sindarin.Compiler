import { isScopeName } from "./semantics";

const FLAG_MAP = {
  fo: "firstOnly",
  unrefx: "unreflexive",
};

const ARROW_MAP = {
  "->": "outgoing",
  "<-": "incoming",
};

// Kinda had no other choice for serialization to work
const KNOWN_FUNCTIONS = {
  isScopeName: isScopeName,
};

export function loadPattern(patternString: string): RoutePatternDefinition {
  const routeSplit = patternString.split("||");
  console.assert(routeSplit.length === 2);

  const flagValues = routeSplit[0].split("-").reduce(
    (pv, cv) => {
      return {
        ...pv,
        [FLAG_MAP[cv]]: true,
      };
    },
    Object.values(FLAG_MAP).reduce((pv, cv) => {
      return {
        ...pv,
        [cv]: false, // Assume missing flag => false
      };
    }, {})
  );

  const definitions = routeSplit[1].split("#").map(loadDefinition);

  return {
    ...flagValues,
    definitions,
  };
}

function loadDefinition(definitionString: string): PatternDefinition {
  const defSplit = definitionString.split(" ");
  console.assert(defSplit.length === 4);

  const [labelPred, vertexPred, arrowPart, modifiers] = defSplit;
  const arrow = arrowPart.substr(0, 2);

  const vertexPredSplit = vertexPred.split(":");

  const vertexPredPattern: PatternDefinition =
    vertexPredSplit.length === 2
      ? {
          // TODO: merge both of these
          vertex:
            vertexPredSplit[0] === "*"
              ? undefined
              : { id: parseInt(vertexPredSplit[0]), label: vertexPredSplit[1] },
          vertexLabelPat:
            vertexPredSplit[0] === "*" ? vertexPredSplit[1] : undefined,
        }
      : {};

  return {
    labelPred:
      labelPred === "undefined"
        ? undefined
        : KNOWN_FUNCTIONS[labelPred] || JSON.parse(labelPred),
    ...vertexPredPattern,

    through: ARROW_MAP[arrow],
    modifier: arrowPart[2] === "*" ? "rtc" : undefined,

    ...JSON.parse(modifiers),
  };
}

export function serializePattern(pattern: RoutePatternDefinition): string {
  const { firstOnly, unreflexive, definitions } = pattern;

  const serializedDefinitions = definitions.map(serializeDefinition);

  const flags = [
    _resolveFlag("firstOnly", firstOnly),
    _resolveFlag("unreflexive", unreflexive),
  ]
    .filter((_) => _)
    .join("-");
  return `${flags}||${serializedDefinitions.join("#")}`;
}

function serializeDefinition(def: PatternDefinition): string {
  return Array.from(_serializeDefinition(def)).join(" ");
}

function* _serializeDefinition(def: PatternDefinition) {
  const {
    labelPred,
    vertex,
    vertexLabelPat,
    index,
    through,
    resolve,
    modifier,
    excluding,
  } = def;

  if (typeof labelPred === "function") {
    console.assert(KNOWN_FUNCTIONS[labelPred.name]);
    yield labelPred.name;
  } else {
    yield `${JSON.stringify(labelPred)}`;
  }

  if (vertex) {
    yield `${vertex.id}:${vertex.label}`;
  } else if (vertexLabelPat) {
    yield `*:${vertexLabelPat}`;
  } else {
    yield "*";
  }

  const arrow = _resolveArrow(through);
  const arrowModifier = modifier === "rtc" ? "*" : "";
  yield `${arrow}${arrowModifier}`;

  const specialModifiers = Object.fromEntries(
    Object.entries({
      resolve,
      excluding,
      index,
      vertexLabelPat,
    }).filter(([k, v]) => v !== undefined)
  );

  yield JSON.stringify(specialModifiers);
}

function _resolveArrow(through: string): string {
  return _resolveFromMap(ARROW_MAP, through, true) || "";
}

function _resolveFlag(name: string, value?: boolean): string {
  return _resolveFromMap(FLAG_MAP, name, value || false);
}

function _resolveFromMap(map: any, name: string, value?: boolean): string {
  return (
    value &&
    Object.entries(map)
      .filter(([k, v]) => v === name)
      .map(([k, v]) => k)[0]
  );
}
