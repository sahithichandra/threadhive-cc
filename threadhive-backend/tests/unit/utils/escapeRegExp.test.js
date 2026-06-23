import { describe, it, expect } from "vitest";
import { escapeRegExp } from "../../../src/utils/escapeRegExp.js";

describe("escapeRegExp", () => {
  it("escapes regex metacharacters so they match literally", () => {
    const escaped = escapeRegExp(".*+?^${}()|[]\\");
    // Every metachar should be backslash-prefixed.
    expect(escaped).toBe("\\.\\*\\+\\?\\^\\$\\{\\}\\(\\)\\|\\[\\]\\\\");
  });

  it("leaves ordinary characters untouched", () => {
    expect(escapeRegExp("react hooks 101")).toBe("react hooks 101");
  });

  it("produces a pattern that matches the literal input", () => {
    const input = "c++ (beginner)";
    const regex = new RegExp(escapeRegExp(input), "i");
    expect(regex.test("Learning C++ (beginner) guide")).toBe(true);
    // Not treated as a wildcard / quantifier.
    expect(regex.test("cbeginner")).toBe(false);
  });

  it("does not throw on metacharacter-only input", () => {
    expect(() => new RegExp(escapeRegExp(".*"), "i")).not.toThrow();
    expect(new RegExp(escapeRegExp(".*"), "i").test("literal .* here")).toBe(true);
  });
});
