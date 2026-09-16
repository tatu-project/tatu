const sensitiveQueryNames = new Set([
  'access_token',
  'api_key',
  'apikey',
  'authorization',
  'auth',
  'client_secret',
  'clientsecret',
  'credential',
  'credentials',
  'cookie',
  'hmac',
  'jwt',
  'key',
  'password',
  'passwd',
  'private_key',
  'privatekey',
  'pwd',
  'secret',
  'secretkey',
  'session',
  'session_id',
  'signature',
  'sig',
  'token',
]);

const normalizedQueryName = (value: string) =>
  value.toLocaleLowerCase('en-US').replace(/[^a-z0-9]/g, '');

const hasSensitiveQueryName = (name: string) => {
  const normalized = normalizedQueryName(name);
  return (
    sensitiveQueryNames.has(name.toLocaleLowerCase('en-US')) ||
    sensitiveQueryNames.has(normalized) ||
    normalized.endsWith('token') ||
    normalized.endsWith('secret') ||
    normalized.endsWith('password') ||
    normalized.endsWith('apikey') ||
    normalized.endsWith('credential') ||
    normalized.endsWith('signature')
  );
};

const hasSensitiveQueryValue = (value: string) => {
  const normalized = value.trim();
  if (!normalized) return false;
  if (
    /\b(?:access[_-]?token|api[_-]?key|authorization|bearer|basic|client[_-]?secret|credential|password|passwd|private[_-]?key|secret|token)\b\s*[:=]/i.test(
      normalized,
    )
  )
    return true;
  if (/^(?:bearer|basic|token)\s+\S+/i.test(normalized)) return true;
  if (/^ey[a-z0-9_-]+\.[a-z0-9_-]+\.[a-z0-9_-]+$/i.test(normalized))
    return true;
  return /^(?:sk|pk|ghp|github_pat|xox[baprs]-|ya29|AIza)[a-z0-9_-]{8,}$/i.test(
    normalized,
  );
};

/** Returns true when a URL query could contain a credential or access token. */
export const hasSensitiveUrlQuery = (value: URL | string): boolean => {
  try {
    const url = typeof value === 'string' ? new URL(value) : value;
    for (const [name, queryValue] of url.searchParams) {
      if (hasSensitiveQueryName(name) || hasSensitiveQueryValue(queryValue))
        return true;
    }
  } catch {
    return false;
  }
  return false;
};
