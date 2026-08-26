import { describe, it, expect } from "vitest";
import { isRoleSufficient } from "./roles";

describe("isRoleSufficient", () => {
  it("allows equal roles", () => {
    expect(isRoleSufficient("ADMIN", "ADMIN")).toBe(true);
  });

  it("allows a higher role for a lower requirement", () => {
    expect(isRoleSufficient("OWNER", "MEMBER")).toBe(true);
  });

  it("rejects a lower role for a higher requirement", () => {
    expect(isRoleSufficient("MEMBER", "ADMIN")).toBe(false);
    expect(isRoleSufficient("ADMIN", "OWNER")).toBe(false);
  });
});
