import { describe, it, expect } from "vitest";
import { slugify, getInitials, extractMentionIds, renderMentionsPlain } from "@/lib/utils";

describe("slugify", () => {
  it("produces url-safe slugs with a random suffix", () => {
    const slug = slugify("Acme Inc.!");
    expect(slug).toMatch(/^acme-inc-[a-z0-9]{6}$/);
  });

  it("handles non-latin/empty names", () => {
    expect(slugify("!!!")).toMatch(/^[a-z0-9]{6}$/);
  });
});

describe("getInitials", () => {
  it("takes the first letters of up to two words", () => {
    expect(getInitials("Ada Lovelace")).toBe("AL");
    expect(getInitials("Plato")).toBe("P");
    expect(getInitials("Anna Maria von Berg")).toBe("AM");
  });
});

describe("mentions", () => {
  const body = "Hey @[Ada Lovelace](ckabc123) and @[Bob](ckdef456), check this. @[Ada Lovelace](ckabc123)";

  it("extracts unique user ids from mention tokens", () => {
    expect(extractMentionIds(body).sort()).toEqual(["ckabc123", "ckdef456"]);
  });

  it("ignores plain @ text", () => {
    expect(extractMentionIds("email me @ work")).toEqual([]);
  });

  it("renders tokens back to readable text", () => {
    expect(renderMentionsPlain("Hi @[Ada](ck1)!")).toBe("Hi @Ada!");
  });
});
