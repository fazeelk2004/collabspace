import { describe, it, expect } from "vitest";
import {
  registerSchema,
  createTaskSchema,
  moveTaskSchema,
  inviteMemberSchema,
  requestUploadSchema,
  chatMessageSchema,
  MAX_FILE_SIZE,
} from "@/lib/validations";

describe("registerSchema", () => {
  it("accepts a valid registration", () => {
    expect(
      registerSchema.safeParse({
        name: "Ada Lovelace",
        email: "ada@example.com",
        password: "secure123",
      }).success
    ).toBe(true);
  });

  it("rejects weak passwords", () => {
    const noNumber = registerSchema.safeParse({
      name: "Ada",
      email: "ada@example.com",
      password: "onlyletters",
    });
    const tooShort = registerSchema.safeParse({
      name: "Ada",
      email: "ada@example.com",
      password: "a1",
    });
    expect(noNumber.success).toBe(false);
    expect(tooShort.success).toBe(false);
  });

  it("rejects invalid emails", () => {
    expect(
      registerSchema.safeParse({ name: "Ada", email: "not-an-email", password: "secure123" })
        .success
    ).toBe(false);
  });
});

describe("createTaskSchema", () => {
  it("applies defaults and accepts minimal input", () => {
    const result = createTaskSchema.parse({ columnId: "col1", title: "Ship it" });
    expect(result.priority).toBe("MEDIUM");
  });

  it("rejects an empty title and unknown priority", () => {
    expect(createTaskSchema.safeParse({ columnId: "col1", title: "" }).success).toBe(false);
    expect(
      createTaskSchema.safeParse({ columnId: "col1", title: "x", priority: "MAXIMUM" }).success
    ).toBe(false);
  });

  it("coerces date strings", () => {
    const result = createTaskSchema.parse({
      columnId: "col1",
      title: "With due date",
      dueDate: "2026-07-01T00:00:00.000Z",
    });
    expect(result.dueDate).toBeInstanceOf(Date);
  });
});

describe("moveTaskSchema", () => {
  it("requires a finite position", () => {
    expect(moveTaskSchema.safeParse({ columnId: "c", position: 1500.5 }).success).toBe(true);
    expect(moveTaskSchema.safeParse({ columnId: "c", position: Infinity }).success).toBe(false);
    expect(moveTaskSchema.safeParse({ columnId: "c" }).success).toBe(false);
  });
});

describe("inviteMemberSchema", () => {
  it("never allows inviting as OWNER", () => {
    expect(
      inviteMemberSchema.safeParse({ email: "a@b.com", role: "OWNER" }).success
    ).toBe(false);
    expect(
      inviteMemberSchema.safeParse({ email: "a@b.com", role: "ADMIN" }).success
    ).toBe(true);
  });
});

describe("requestUploadSchema", () => {
  it("enforces the size limit", () => {
    expect(
      requestUploadSchema.safeParse({
        fileName: "big.pdf",
        fileType: "application/pdf",
        fileSize: MAX_FILE_SIZE + 1,
      }).success
    ).toBe(false);
  });

  it("rejects disallowed file types", () => {
    expect(
      requestUploadSchema.safeParse({
        fileName: "evil.exe",
        fileType: "application/x-msdownload",
        fileSize: 1024,
      }).success
    ).toBe(false);
  });

  it("accepts an allowed image", () => {
    expect(
      requestUploadSchema.safeParse({
        fileName: "screenshot.png",
        fileType: "image/png",
        fileSize: 1024,
      }).success
    ).toBe(true);
  });
});

describe("chatMessageSchema", () => {
  it("rejects empty and oversized messages", () => {
    expect(chatMessageSchema.safeParse({ body: "" }).success).toBe(false);
    expect(chatMessageSchema.safeParse({ body: "x".repeat(5001) }).success).toBe(false);
    expect(chatMessageSchema.safeParse({ body: "hello" }).success).toBe(true);
  });
});
