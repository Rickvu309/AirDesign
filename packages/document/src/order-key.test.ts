import { describe, expect, it } from "vitest";
import { orderKeyBetween } from "./order-key.js";

describe("orderKeyBetween", () => {
  it("returns the first key when both ends are open", () => {
    expect(orderKeyBetween(null, null)).toBe("a0");
  });

  it("returns a key after the lower bound", () => {
    const first = orderKeyBetween(null, null);
    const second = orderKeyBetween(first, null);
    expect(first < second).toBe(true);
  });

  it("returns a key before the upper bound", () => {
    const first = orderKeyBetween(null, null);
    const before = orderKeyBetween(null, first);
    expect(before < first).toBe(true);
  });

  it("returns a key strictly between two keys", () => {
    const first = orderKeyBetween(null, null);
    const second = orderKeyBetween(first, null);
    const middle = orderKeyBetween(first, second);
    expect(first < middle).toBe(true);
    expect(middle < second).toBe(true);
  });

  it("rejects bounds that are not in order", () => {
    const key = orderKeyBetween(null, null);
    expect(() => orderKeyBetween(key, key)).toThrow(/>=/);
  });
});
