// Server-side URL validation for the website connector.
// Runs before every outbound fetch (initial submit, redirects, discovery links).
// The Cloudflare Worker runtime does not expose a reliable DNS resolver, so we
// enforce guards on the hostname literal and reject anything that could point
// at a private network, loopback, link-local, or reserved range. Workers'
// outbound fetch also refuses private ranges, so this is defense in depth.

import { IntegrationError } from "../../errors";

const ALLOWED_SCHEMES = new Set(["http:", "https:"]);

// Reserved hostnames we never allow.
const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "ip6-localhost",
  "ip6-loopback",
  "broadcasthost",
]);

const BLOCKED_TLDS = [".local", ".internal", ".localhost", ".onion", ".test", ".invalid", ".example"];

function isIpv4Literal(host: string): number[] | null {
  const parts = host.split(".");
  if (parts.length !== 4) return null;
  const nums: number[] = [];
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p)) return null;
    const n = Number(p);
    if (n < 0 || n > 255) return null;
    nums.push(n);
  }
  return nums;
}

function isPrivateIpv4(nums: number[]): boolean {
  const [a, b] = nums;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 192 && b === 0 && nums[2] === 2) return true; // TEST-NET-1
  if (a === 198 && (b === 18 || b === 19)) return true;
  if (a === 198 && b === 51 && nums[2] === 100) return true;
  if (a === 203 && b === 0 && nums[2] === 113) return true;
  if (a >= 224) return true; // multicast + reserved
  return false;
}

function isBlockedIpv6(host: string): boolean {
  const h = host.toLowerCase().replace(/^\[|\]$/g, "");
  if (h === "::" || h === "::1") return true;
  if (h.startsWith("fe80:")) return true; // link-local
  if (h.startsWith("fc") || h.startsWith("fd")) return true; // unique local fc00::/7
  if (h.startsWith("ff")) return true; // multicast
  if (h.startsWith("::ffff:")) {
    const v4 = h.slice("::ffff:".length);
    const nums = isIpv4Literal(v4);
    if (nums && isPrivateIpv4(nums)) return true;
  }
  return false;
}

export interface SafeUrl {
  href: string;
  origin: string;
  hostname: string;
  pathname: string;
  url: URL;
}

export function validatePublicUrl(rawUrl: string): SafeUrl {
  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    throw new IntegrationError("invalid_url", "URL is not well formed");
  }

  if (!ALLOWED_SCHEMES.has(url.protocol)) {
    throw new IntegrationError("unsupported_scheme", "Only http and https are allowed");
  }
  if (url.username || url.password) {
    throw new IntegrationError("invalid_url", "URLs with embedded credentials are not allowed");
  }

  const host = url.hostname.toLowerCase();
  if (!host) throw new IntegrationError("invalid_url", "URL has no hostname");

  if (BLOCKED_HOSTNAMES.has(host)) {
    throw new IntegrationError("blocked_private_network", "Hostname refers to a private network");
  }
  if (BLOCKED_TLDS.some((suffix) => host.endsWith(suffix))) {
    throw new IntegrationError("blocked_private_network", "Hostname uses a reserved TLD");
  }

  const v4 = isIpv4Literal(host);
  if (v4) {
    if (isPrivateIpv4(v4)) {
      throw new IntegrationError("blocked_private_network", "IPv4 literal is in a reserved range");
    }
  } else if (host.includes(":") || host.startsWith("[")) {
    if (isBlockedIpv6(host)) {
      throw new IntegrationError("blocked_private_network", "IPv6 literal is in a reserved range");
    }
  } else {
    // Hostname must look like a real DNS name (at least one dot).
    if (!host.includes(".")) {
      throw new IntegrationError("blocked_private_network", "Hostname is not publicly resolvable");
    }
  }

  // Normalize.
  url.hash = "";
  return {
    href: url.href,
    origin: url.origin,
    hostname: host,
    pathname: url.pathname || "/",
    url,
  };
}

export function sameRegistrableHost(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

// Convert a raw href discovered inside a page into a validated same-origin URL.
// Returns null when the link is external, opaque, or unsafe.
export function resolveSameOriginLink(
  base: SafeUrl,
  href: string,
): SafeUrl | null {
  if (!href) return null;
  const trimmed = href.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("#") || trimmed.startsWith("mailto:") || trimmed.startsWith("tel:") || trimmed.startsWith("javascript:")) {
    return null;
  }
  let resolved: string;
  try {
    resolved = new URL(trimmed, base.href).toString();
  } catch {
    return null;
  }
  let safe: SafeUrl;
  try {
    safe = validatePublicUrl(resolved);
  } catch {
    return null;
  }
  if (!sameRegistrableHost(safe.hostname, base.hostname)) return null;
  return safe;
}