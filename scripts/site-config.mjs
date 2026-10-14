import process from 'node:process';
import { resolve } from 'node:path';
import { pathToFileURL, URL } from 'node:url';

export function siteManifest(template, environment = {}, required = false) {
  if (
    !template ||
    Object.keys(template).some(
      (key) => !['d1', 'r2', 'capabilities'].includes(key),
    ) ||
    template.d1 !== 'DB' ||
    template.r2 !== null ||
    !Array.isArray(template.capabilities) ||
    template.capabilities.length !== 1 ||
    template.capabilities[0] !== 'mcp'
  )
    throw new Error('Invalid generic Site storage declaration.');
  const projectId = environment.SITE_PROJECT_ID;
  if (projectId === undefined || projectId === '') {
    if (required)
      throw new Error(
        'SITE_PROJECT_ID must be explicitly configured for Site export.',
      );
    return null;
  }
  if (
    typeof projectId !== 'string' ||
    !/^appgprj_[a-zA-Z0-9_]{1,128}$/u.test(projectId)
  )
    throw new Error('Invalid SITE_PROJECT_ID.');
  return { project_id: projectId, ...template };
}

export function privateSiteOrigin(value) {
  if (typeof value !== 'string') throw new Error('invalid_origin');
  let origin;
  try {
    origin = new URL(value);
  } catch {
    throw new Error('invalid_origin');
  }
  if (
    origin.protocol !== 'https:' ||
    origin.username ||
    origin.password ||
    origin.port ||
    origin.pathname !== '/' ||
    origin.search ||
    origin.hash ||
    !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.chatgpt\.site$/u.test(
      origin.hostname,
    )
  )
    throw new Error('invalid_origin');
  return origin.origin;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  siteManifest(
    { d1: 'DB', r2: null, capabilities: ['mcp'] },
    process.env,
    true,
  );
}
