export const HEIR_PACKAGE_VERSION = 1;

export interface HeirPackage {
  version: number;
  vault: string;
  secret: string;
  weight_bps: number;
  commitments: string[];
  merkle_root: string;
}

export interface ParsedHeirPackage {
  version: number;
  vault: string;
  secret: string;
  weightBps: number;
  commitments: string[];
  merkleRoot: string;
}

interface BuildHeirPackageParams {
  vault: string;
  secret: string;
  weightBps: number;
  commitments: string[];
  merkleRoot: string;
}

function normalizeHex(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Invalid package: ${fieldName} is required.`);
  }

  const trimmed = value.trim();
  const normalized = trimmed.startsWith("0x") ? trimmed : `0x${trimmed}`;

  try {
    return `0x${BigInt(normalized).toString(16)}`;
  } catch {
    throw new Error(`Invalid package: ${fieldName} must be a hex string.`);
  }
}

function normalizeWeightBps(value: unknown): number {
  if (typeof value !== "number" && typeof value !== "string") {
    throw new Error("Invalid package: weight_bps is required.");
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 10_000) {
    throw new Error("Invalid package: weight_bps must be an integer between 1 and 10000.");
  }

  return parsed;
}

export function buildHeirPackage({
  vault,
  secret,
  weightBps,
  commitments,
  merkleRoot,
}: BuildHeirPackageParams): HeirPackage {
  return {
    version: HEIR_PACKAGE_VERSION,
    vault: normalizeHex(vault, "vault"),
    secret: normalizeHex(secret, "secret"),
    weight_bps: normalizeWeightBps(weightBps),
    commitments: commitments.map(commitment => normalizeHex(commitment, "commitment")),
    merkle_root: normalizeHex(merkleRoot, "merkle_root"),
  };
}

export function serializeHeirPackage(pkg: HeirPackage): string {
  return JSON.stringify(pkg, null, 2);
}

export function parseHeirPackage(raw: string): ParsedHeirPackage {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Failed to parse file.");
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("Invalid package: expected an object.");
  }

  const pkg = parsed as Record<string, unknown>;
  if (pkg.version !== HEIR_PACKAGE_VERSION) {
    throw new Error(`Invalid package: expected version ${HEIR_PACKAGE_VERSION}.`);
  }

  if (!Array.isArray(pkg.commitments) || pkg.commitments.length === 0) {
    throw new Error("Invalid package: commitments must be a non-empty array.");
  }

  return {
    version: HEIR_PACKAGE_VERSION,
    vault: normalizeHex(pkg.vault, "vault"),
    secret: normalizeHex(pkg.secret, "secret"),
    weightBps: normalizeWeightBps(pkg.weight_bps),
    commitments: pkg.commitments.map(commitment => normalizeHex(commitment, "commitment")),
    merkleRoot: normalizeHex(pkg.merkle_root, "merkle_root"),
  };
}

export function packageMatchesMerkleRoot(pkg: ParsedHeirPackage, merkleRoot: string | null): boolean {
  if (!merkleRoot) return false;

  try {
    return BigInt(pkg.merkleRoot) === BigInt(merkleRoot);
  } catch {
    return false;
  }
}
