/** High-confidence credential detector for bounded text fields. */
const assignment =
  /\b(?:api[_-]?key|access[_-]?token|authorization|bearer|client[_-]?secret|password|private[_-]?key|secret[_-]?key|session[_-]?id|credential|token)\b\s*[:=]\s*["'`]?([A-Za-z0-9_./+=:-]{8,})/iu;
const assignmentRedact =
  /(\b(?:api[_-]?key|access[_-]?token|authorization|bearer|client[_-]?secret|password|private[_-]?key|secret[_-]?key|session[_-]?id|credential|token)\b\s*[:=]\s*["'`]?)([A-Za-z0-9_./+=:-]{8,})/giu;
const scheme = /\b(?:bearer|basic|token)\s+([A-Za-z0-9_./+=:-]{8,})\b/iu;
const schemeRedact = /\b(?:bearer|basic|token)\s+([A-Za-z0-9_./+=:-]{8,})\b/giu;
const jwt = /\bey[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/u;
const jwtRedact =
  /\bey[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/gu;
const userinfo = /\bhttps?:\/\/[^\s/@:]+:[^\s/@]+@[^\s]+/iu;
const userinfoRedact = /\bhttps?:\/\/[^\s/@:]+:[^\s/@]+@[^\s]+/giu;
const knownPrefix =
  /\b(?:sk|pk|ghp|github_pat|xox[baprs]-|ya29|AIza)[A-Za-z0-9_-]{8,}\b/iu;
const knownPrefixRedact =
  /\b(?:sk|pk|ghp|github_pat|xox[baprs]-|ya29|AIza)[A-Za-z0-9_-]{8,}\b/giu;

export const hasTextSecret = (value: unknown): value is string =>
  typeof value === 'string' &&
  (assignment.test(value) ||
    scheme.test(value) ||
    jwt.test(value) ||
    userinfo.test(value) ||
    knownPrefix.test(value));

/** Redacts only substrings recognized by this deliberately narrow policy. */
export const redactTextSecrets = (value: string): string =>
  value
    .replace(assignmentRedact, '$1[REDACTED]')
    .replace(schemeRedact, (match) =>
      match.replace(/([A-Za-z0-9_./+=:-]{8,})$/u, '[REDACTED]'),
    )
    .replace(jwtRedact, '[REDACTED]')
    .replace(userinfoRedact, (match) => match.replace(/:\S+@/u, ':[REDACTED]@'))
    .replace(knownPrefixRedact, '[REDACTED]');
