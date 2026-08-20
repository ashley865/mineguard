import { promises as dns } from "dns";
import net from "net";

// Applied to every admin-configured outbound URL the server fetches on its own
// initiative — AI_API_BASE_URL, SECURITY_ALERT_WEBHOOK_URL, and custom API key testUrls
// (see lib/customApiKeys.ts). Without this, an Owner/IT Manager account (or anyone who
// compromises one) could point any of these at the server's own internal network —
// 127.0.0.1, a private 10.x/172.16.x/192.168.x range, or a cloud metadata endpoint like
// 169.254.169.254 — and use MineGuard's own server as an SSRF pivot to reach infrastructure
// that isn't otherwise internet-reachable.
export class UnsafeUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsafeUrlError";
  }
}

function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => !Number.isInteger(p) || p < 0 || p > 255)) return true;
  const [a, b] = parts;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true; // link-local, includes the cloud metadata endpoint
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // carrier-grade NAT
  if (a >= 224) return true; // multicast / reserved
  return false;
}

function isPrivateIPv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === "::1" || lower === "::") return true;
  if (/^fe[89ab][0-9a-f]:/.test(lower)) return true; // link-local fe80::/10
  if (/^f[cd][0-9a-f]{2}:/.test(lower)) return true; // unique local fc00::/7
  if (lower.startsWith("::ffff:")) {
    const v4 = lower.split(":").pop()!;
    if (v4.includes(".")) return isPrivateIPv4(v4);
  }
  return false;
}

/**
 * Throws UnsafeUrlError if the URL is malformed, non-HTTPS, or resolves to a
 * private/loopback/link-local/reserved address. Returns the parsed URL otherwise.
 *
 * Note: this checks the hostname's DNS resolution at call time — it does not pin that
 * resolved IP for the actual request that follows, so a narrow DNS-rebinding window
 * exists between this check and the caller's fetch(). Acceptable here because every
 * caller is an admin-supplied integration URL behind an authenticated, role-gated
 * (Owner/IT Manager) endpoint, not an anonymous or high-frequency surface.
 */
export async function assertSafeExternalUrl(rawUrl: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new UnsafeUrlError("Not a valid URL");
  }
  if (url.protocol !== "https:") {
    throw new UnsafeUrlError("Only https:// URLs are allowed");
  }
  const hostname = url.hostname;
  if (hostname.toLowerCase() === "localhost") {
    throw new UnsafeUrlError("Requests to localhost are not allowed");
  }

  const literalVersion = net.isIP(hostname);
  let addresses: string[];
  if (literalVersion) {
    addresses = [hostname];
  } else {
    try {
      addresses = (await dns.lookup(hostname, { all: true })).map((r) => r.address);
    } catch {
      throw new UnsafeUrlError("Could not resolve hostname");
    }
  }
  if (addresses.length === 0) throw new UnsafeUrlError("Could not resolve hostname");

  for (const address of addresses) {
    const version = net.isIP(address);
    if (version === 4 && isPrivateIPv4(address)) {
      throw new UnsafeUrlError("Requests to private or internal addresses are not allowed");
    }
    if (version === 6 && isPrivateIPv6(address)) {
      throw new UnsafeUrlError("Requests to private or internal addresses are not allowed");
    }
  }

  return url;
}
