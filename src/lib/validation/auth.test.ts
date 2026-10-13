import { describe, expect, it } from "vitest";
import {
  emailSchema,
  newPasswordSchema,
  passwordSchema,
  signInCodeSchema,
} from "./auth";

describe("emailSchema", () => {
  it("accepts and tidies an email address", () => {
    expect(emailSchema.parse("  Jo.Smith@Example.co.uk ")).toBe(
      "jo.smith@example.co.uk",
    );
  });

  it("asks for an email when it's empty", () => {
    const result = emailSchema.safeParse("   ");
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("Enter your email address");
  });

  it("explains the format when it's wrong", () => {
    const result = emailSchema.safeParse("jo.smith");
    expect(result.error?.issues[0]?.message).toMatch(/right format/);
  });
});

describe("signInCodeSchema", () => {
  it("accepts 6 digits, ignoring spaces", () => {
    expect(signInCodeSchema.parse("123456")).toBe("123456");
    expect(signInCodeSchema.parse(" 123 456 ")).toBe("123456");
  });

  it.each(["12345", "1234567", "abcdef", "12345a"])("rejects %j", (code) => {
    expect(signInCodeSchema.safeParse(code).success).toBe(false);
  });

  it("asks for the code when it's empty", () => {
    expect(signInCodeSchema.safeParse("").error?.issues[0]?.message).toBe(
      "Enter the 6-digit code from the email",
    );
  });
});

describe("passwordSchema", () => {
  it("asks for a password when it's empty", () => {
    expect(passwordSchema.safeParse("").error?.issues[0]?.message).toBe(
      "Enter your password",
    );
  });

  it("accepts any password up to 72 characters", () => {
    expect(passwordSchema.safeParse("x").success).toBe(true);
    expect(passwordSchema.safeParse("x".repeat(72)).success).toBe(true);
    expect(passwordSchema.safeParse("x".repeat(73)).success).toBe(false);
  });
});

describe("newPasswordSchema", () => {
  it("accepts a long password typed the same twice", () => {
    const password = "paper fox crop weekend";
    expect(
      newPasswordSchema.safeParse({ password, confirm: password }).success,
    ).toBe(true);
  });

  it("asks for at least 12 characters", () => {
    const result = newPasswordSchema.safeParse({
      password: "short",
      confirm: "short",
    });
    expect(result.error?.issues[0]?.path).toEqual(["password"]);
    expect(result.error?.issues[0]?.message).toMatch(/at least 12 characters/);
  });

  it("explains when the two don't match", () => {
    const result = newPasswordSchema.safeParse({
      password: "paper fox crop weekend",
      confirm: "paper fox crop weekends",
    });
    expect(result.error?.issues[0]?.path).toEqual(["confirm"]);
    expect(result.error?.issues[0]?.message).toMatch(/don't match/);
  });

  it("refuses passwords over 72 characters", () => {
    const password = "x".repeat(73);
    expect(
      newPasswordSchema.safeParse({ password, confirm: password }).success,
    ).toBe(false);
  });
});
