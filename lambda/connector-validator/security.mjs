/**
 * SSRF prevention — validates URLs against an allowlist.
 */

const ALLOWED_HOSTS = [
  'api.github.com',
  'github.com',
  '*.atlassian.net',
  '*.jira.com',
  '*.amazonaws.com',
  '*.anthropic.com',
];

export function isAllowedHost(url) {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();

    // Block private/internal IPs
    if (isPrivateIP(hostname)) return false;

    return ALLOWED_HOSTS.some(pattern => {
      if (pattern.startsWith('*.')) {
        const suffix = pattern.slice(2);
        return hostname.endsWith(suffix) || hostname === suffix;
      }
      return hostname === pattern;
    });
  } catch {
    return false;
  }
}

function isPrivateIP(hostname) {
  // Block common private IP patterns
  const privatePatterns = [
    /^localhost$/i,
    /^127\./,
    /^10\./,
    /^172\.(1[6-9]|2\d|3[01])\./,
    /^192\.168\./,
    /^0\./,
    /^169\.254\./,  // link-local / metadata
    /^fc00:/i,       // IPv6 private
    /^fe80:/i,       // IPv6 link-local
    /^\[::1\]$/,     // IPv6 loopback
  ];
  return privatePatterns.some(p => p.test(hostname));
}
