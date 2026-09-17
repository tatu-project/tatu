/**
 * Returns true when a runtime object contains no enumerable string keys
 * outside the supplied allowlist. Arrays and null are never considered
 * records, so callers can safely use this at JSON/provider boundaries.
 */
export const hasOnlyKeys = (
  value: unknown,
  allowedKeys: readonly string[],
): value is Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const allowed = new Set(allowedKeys);
  return Object.keys(value).every((key) => allowed.has(key));
};

/** Returns true when a runtime object has exactly the supplied enumerable keys. */
export const hasExactKeys = (
  value: unknown,
  expectedKeys: readonly string[],
): value is Record<string, unknown> =>
  hasOnlyKeys(value, expectedKeys) &&
  Object.keys(value).length === new Set(expectedKeys).size;
