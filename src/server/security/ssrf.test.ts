import { describe, it, expect } from "vitest";
import { isBlockedIpv4, isBlockedIpv6, isBlockedIp } from "./ssrf";

describe("isBlockedIpv4", () => {
  it("blocks the cloud metadata address", () => {
    expect(isBlockedIpv4("169.254.169.254")).toBe(true);
  });

  it("blocks private RFC1918 ranges", () => {
    expect(isBlockedIpv4("10.0.0.5")).toBe(true);
    expect(isBlockedIpv4("172.16.5.1")).toBe(true);
    expect(isBlockedIpv4("192.168.1.1")).toBe(true);
  });

  it("blocks loopback", () => {
    expect(isBlockedIpv4("127.0.0.1")).toBe(true);
  });

  it("allows a public address", () => {
    expect(isBlockedIpv4("93.184.216.34")).toBe(false);
  });

  it("does not false-positive on addresses that merely start similarly", () => {
    // 172.32.x.x is outside the 172.16.0.0/12 range (172.16-172.31)
    expect(isBlockedIpv4("172.32.0.1")).toBe(false);
  });
});

describe("isBlockedIpv6", () => {
  it("blocks loopback and unique-local", () => {
    expect(isBlockedIpv6("::1")).toBe(true);
    expect(isBlockedIpv6("fd00::1")).toBe(true);
  });

  it("allows a public IPv6 address", () => {
    expect(isBlockedIpv6("2606:4700:4700::1111")).toBe(false);
  });
});

describe("isBlockedIp", () => {
  it("dispatches to the right family", () => {
    expect(isBlockedIp("127.0.0.1")).toBe(true);
    expect(isBlockedIp("::1")).toBe(true);
    expect(isBlockedIp("8.8.8.8")).toBe(false);
  });
});
