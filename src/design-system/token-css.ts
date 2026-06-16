import { component, motion, radius, shadow, spacing, zIndex } from "./tokens";

interface TokenRecord {
  [key: string]: string | number | TokenRecord;
}

function kebab(value: string) {
  return value.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`);
}

function flattenTokens(prefix: string, value: TokenRecord): Array<[string, string]> {
  return Object.entries(value).flatMap(([key, nested]) => {
    const name = `${prefix}-${kebab(key)}`;
    if (typeof nested === "string" || typeof nested === "number") return [[name, String(nested)]];
    return flattenTokens(name, nested);
  });
}

export function createCssVariableBlock(selector: string, tokens: TokenRecord = {
  space: spacing,
  radius,
  shadow,
  motion,
  z: zIndex,
  component,
}) {
  const declarations = flattenTokens("", tokens)
    .map(([name, value]) => `  --${name.slice(1)}: ${value};`)
    .join("\n");
  return `${selector} {\n${declarations}\n}`;
}

export { component, motion, radius, shadow, spacing, zIndex };
