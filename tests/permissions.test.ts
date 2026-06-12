import { describe, it, expect } from "vitest";
import { roleAtLeast, can, type RoleName } from "@/lib/permissions-client";

describe("role hierarchy", () => {
  it("orders roles correctly", () => {
    expect(roleAtLeast("OWNER", "ADMIN")).toBe(true);
    expect(roleAtLeast("ADMIN", "OWNER")).toBe(false);
    expect(roleAtLeast("MEMBER", "MEMBER")).toBe(true);
    expect(roleAtLeast("VIEWER", "MEMBER")).toBe(false);
  });

  const matrix: Array<[RoleName, boolean, boolean, boolean, boolean]> = [
    // role, view, contribute, manage, own
    ["OWNER", true, true, true, true],
    ["ADMIN", true, true, true, false],
    ["MEMBER", true, true, false, false],
    ["VIEWER", true, false, false, false],
  ];

  it.each(matrix)("%s permissions", (role, view, contribute, manage, own) => {
    expect(can.view(role)).toBe(view);
    expect(can.contribute(role)).toBe(contribute);
    expect(can.manage(role)).toBe(manage);
    expect(can.own(role)).toBe(own);
  });
});
