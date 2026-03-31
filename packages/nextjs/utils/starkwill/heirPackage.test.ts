import { describe, expect, it } from "vitest";
import {
  HEIR_PACKAGE_VERSION,
  buildHeirPackage,
  packageMatchesMerkleRoot,
  parseHeirPackage,
  serializeHeirPackage,
} from "./heirPackage";

describe("heirPackage", () => {
  it("builds and parses a normalized package", () => {
    const pkg = buildHeirPackage({
      vault: "0x0123",
      secret: "0x0042",
      weightBps: 5000,
      commitments: ["0x01", "0x0002"],
      merkleRoot: "0x0abc",
    });

    expect(pkg).toEqual({
      version: HEIR_PACKAGE_VERSION,
      vault: "0x123",
      secret: "0x42",
      weight_bps: 5000,
      commitments: ["0x1", "0x2"],
      merkle_root: "0xabc",
    });

    expect(parseHeirPackage(serializeHeirPackage(pkg))).toEqual({
      version: HEIR_PACKAGE_VERSION,
      vault: "0x123",
      secret: "0x42",
      weightBps: 5000,
      commitments: ["0x1", "0x2"],
      merkleRoot: "0xabc",
    });
  });

  it("rejects missing required fields", () => {
    expect(() => parseHeirPackage(JSON.stringify({
      version: HEIR_PACKAGE_VERSION,
      vault: "0x123",
      secret: "0x42",
      weight_bps: 5000,
    }))).toThrow("commitments");
  });

  it("rejects unsupported versions", () => {
    expect(() => parseHeirPackage(JSON.stringify({
      version: 99,
      vault: "0x123",
      secret: "0x42",
      weight_bps: 5000,
      commitments: ["0x1"],
      merkle_root: "0xabc",
    }))).toThrow("expected version");
  });

  it("rejects invalid weight ranges", () => {
    expect(() => buildHeirPackage({
      vault: "0x123",
      secret: "0x42",
      weightBps: 0,
      commitments: ["0x1"],
      merkleRoot: "0xabc",
    })).toThrow("weight_bps");
  });

  it("checks imported packages against live merkle roots", () => {
    const parsed = parseHeirPackage(JSON.stringify({
      version: HEIR_PACKAGE_VERSION,
      vault: "0x123",
      secret: "0x42",
      weight_bps: 5000,
      commitments: ["0x1"],
      merkle_root: "0xabc",
    }));

    expect(packageMatchesMerkleRoot(parsed, "0x0abc")).toBe(true);
    expect(packageMatchesMerkleRoot(parsed, "0xdef")).toBe(false);
    expect(packageMatchesMerkleRoot(parsed, null)).toBe(false);
  });
});
