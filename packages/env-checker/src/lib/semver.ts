export interface ParsedVersion {
  major: number;
  minor: number;
  patch: number;
  raw: string;
}

export function extractVersion(raw: string): string | null {
  const match = raw.match(/(\d+)\.(\d+)(?:\.(\d+))?/);
  if (!match) return null;
  const major = match[1];
  const minor = match[2];
  const patch = match[3] ?? "0";
  return `${major}.${minor}.${patch}`;
}

export function parseSemver(input: string): ParsedVersion | null {
  const cleaned = input.trim().replace(/^v/i, "");
  const match = cleaned.match(/^(\d+)(?:\.(\d+))?(?:\.(\d+))?/);
  if (!match) return null;
  return {
    major: parseInt(match[1], 10),
    minor: match[2] !== undefined ? parseInt(match[2], 10) : 0,
    patch: match[3] !== undefined ? parseInt(match[3], 10) : 0,
    raw: input.trim()
  };
}

export function compareSemver(a: string | ParsedVersion, b: string | ParsedVersion): number {
  const parsedA = typeof a === "string" ? parseSemver(a) : a;
  const parsedB = typeof b === "string" ? parseSemver(b) : b;

  if (!parsedA || !parsedB) return 0;

  if (parsedA.major !== parsedB.major) {
    return parsedA.major > parsedB.major ? 1 : -1;
  }
  if (parsedA.minor !== parsedB.minor) {
    return parsedA.minor > parsedB.minor ? 1 : -1;
  }
  if (parsedA.patch !== parsedB.patch) {
    return parsedA.patch > parsedB.patch ? 1 : -1;
  }
  return 0;
}

function satisfiesSingle(version: ParsedVersion, condition: string): boolean {
  const cond = condition.trim();
  if (!cond || cond === "*") return true;

  // Wildcards: 18.x or 18.*
  const wildcardMatch = cond.match(/^(\d+)(?:\.([xX*]))?(?:\.([xX*]))?$/);
  if (wildcardMatch) {
    const major = parseInt(wildcardMatch[1], 10);
    return version.major === major;
  }

  // Caret: ^1.2.3 -> >=1.2.3 <2.0.0 (or <(major+1).0.0)
  if (cond.startsWith("^")) {
    const target = parseSemver(cond.slice(1));
    if (!target) return false;
    if (compareSemver(version, target) < 0) return false;
    if (target.major > 0) {
      return version.major === target.major;
    }
    if (target.minor > 0) {
      return version.minor === target.minor;
    }
    return version.patch === target.patch;
  }

  // Tilde: ~1.2.3 -> >=1.2.3 <1.3.0
  if (cond.startsWith("~")) {
    const target = parseSemver(cond.slice(1));
    if (!target) return false;
    if (compareSemver(version, target) < 0) return false;
    return version.major === target.major && version.minor === target.minor;
  }

  // Operators: >=, <=, >, <, =, !=
  const opMatch = cond.match(/^(>=|<=|>|<|=|!=)\s*(.+)$/);
  if (opMatch) {
    const op = opMatch[1];
    const target = parseSemver(opMatch[2]);
    if (!target) return false;
    const cmp = compareSemver(version, target);
    switch (op) {
      case ">=":
        return cmp >= 0;
      case "<=":
        return cmp <= 0;
      case ">":
        return cmp > 0;
      case "<":
        return cmp < 0;
      case "=":
        return cmp === 0;
      case "!=":
        return cmp !== 0;
      default:
        return false;
    }
  }

  // Exact match
  const exact = parseSemver(cond);
  if (!exact) return false;
  return compareSemver(version, exact) === 0;
}

export function satisfiesRange(versionStr: string, rangeStr: string): boolean {
  const parsed = parseSemver(versionStr);
  if (!parsed) return false;

  const orBranches = rangeStr.split("||").map((branch) => branch.trim());

  return orBranches.some((branch) => {
    // Space-separated AND clauses (e.g., ">=18.0.0 <22.0.0")
    const andClauses = branch
      .replace(/(>=|<=|>|<|=|!=)\s+/g, "$1")
      .split(/\s+/)
      .filter(Boolean);

    return andClauses.every((clause) => satisfiesSingle(parsed, clause));
  });
}
