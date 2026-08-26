import { describe, it, expect } from "vitest";
import { encryptCredential, decryptCredential, maskCredential } from "./crypto";

const secret = "test-encryption-key-not-for-production-use";

describe("encryptCredential / decryptCredential", () => {
  it("round-trips a value", () => {
    const encrypted = encryptCredential("sk-ant-super-secret-key", secret);
    expect(decryptCredential(encrypted, secret)).toBe("sk-ant-super-secret-key");
  });

  it("never stores the plaintext in the encrypted output", () => {
    const encrypted = encryptCredential("sk-ant-super-secret-key", secret);
    expect(encrypted).not.toContain("sk-ant-super-secret-key");
  });

  it("produces a different ciphertext each time (random IV)", () => {
    const a = encryptCredential("same-value", secret);
    const b = encryptCredential("same-value", secret);
    expect(a).not.toBe(b);
  });

  it("fails to decrypt with the wrong key", () => {
    const encrypted = encryptCredential("secret-value", secret);
    expect(() => decryptCredential(encrypted, "a-completely-different-key")).toThrow();
  });

  it("detects tampering via the auth tag", () => {
    const encrypted = encryptCredential("secret-value", secret);
    const [iv, authTag, ciphertext] = encrypted.split(":");
    const tampered = [iv, authTag, ciphertext!.slice(0, -2) + "00"].join(":"); // safe: encryptCredential always produces 3 ":"-joined segments
    expect(() => decryptCredential(tampered, secret)).toThrow();
  });
});

describe("maskCredential", () => {
  it("shows only the last 4 characters", () => {
    expect(maskCredential("sk-ant-abcdef1234")).toBe("••••1234");
  });

  it("fully masks very short values", () => {
    expect(maskCredential("ab")).toBe("••••");
  });
});
