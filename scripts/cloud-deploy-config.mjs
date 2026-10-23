import process from 'node:process';
import console from 'node:console';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL, URL } from 'node:url';

const AUTH_MODES = new Set(['telegram-only', 'cloudflare-access']);

/** Strips whole-line // comments and trailing commas from the JSONC template. */
export function parseJsonc(text) {
  return JSON.parse(
    text.replace(/^\s*\/\/.*$/gmu, '').replace(/,(\s*[}\]])/gu, '$1'),
  );
}

/**
 * Builds a private deploy configuration from apps/cloud/wrangler.jsonc and
 * operator-supplied values, so account-specific IDs never live in Git.
 */
export function deployConfig(template, environment = {}) {
  const database = environment.TATU_D1_DATABASE_ID;
  if (
    typeof database !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u.test(
      database,
    )
  )
    throw new Error('TATU_D1_DATABASE_ID precisa ser o UUID do banco D1.');
  let origin;
  try {
    origin = new URL(String(environment.TATU_SITE_ORIGIN ?? ''));
  } catch {
    origin = null;
  }
  if (
    !origin ||
    origin.protocol !== 'https:' ||
    origin.username ||
    origin.password ||
    origin.pathname !== '/' ||
    origin.search ||
    origin.hash
  )
    throw new Error(
      'TATU_SITE_ORIGIN precisa ser uma origem HTTPS sem caminho.',
    );
  const mode = environment.TATU_AUTH_MODE || 'telegram-only';
  if (!AUTH_MODES.has(mode))
    throw new Error(
      'TATU_AUTH_MODE precisa ser telegram-only ou cloudflare-access.',
    );
  const scheduler = environment.TATU_SCHEDULER_ENABLED || 'false';
  if (scheduler !== 'true' && scheduler !== 'false')
    throw new Error('TATU_SCHEDULER_ENABLED precisa ser true ou false.');
  const vars = {
    AUTH_MODE: mode,
    SITE_ORIGIN: origin.origin,
    SCHEDULER_ENABLED: scheduler,
  };
  if (mode === 'cloudflare-access') {
    const team = environment.TATU_ACCESS_TEAM_DOMAIN,
      audience = environment.TATU_ACCESS_AUDIENCE;
    if (
      typeof team !== 'string' ||
      !/^[a-z0-9-]+\.cloudflareaccess\.com$/u.test(team) ||
      typeof audience !== 'string' ||
      !audience ||
      audience.length > 256
    )
      throw new Error(
        'cloudflare-access exige TATU_ACCESS_TEAM_DOMAIN e TATU_ACCESS_AUDIENCE.',
      );
    vars.ACCESS_TEAM_DOMAIN = team;
    vars.ACCESS_AUDIENCE = audience;
  }
  const workersDev = new URL(origin.origin).hostname.endsWith('.workers.dev');
  return {
    ...template,
    workers_dev: workersDev,
    // The minute Cron only runs when scheduled delivery is explicitly enabled.
    triggers: { crons: scheduler === 'true' ? template.triggers.crons : [] },
    d1_databases: template.d1_databases.map((database_) => ({
      ...database_,
      database_id: database,
    })),
    vars,
  };
}

const invoked =
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (invoked) {
  try {
    const template = parseJsonc(
      readFileSync(
        new URL('../apps/cloud/wrangler.jsonc', import.meta.url),
        'utf8',
      ),
    );
    writeFileSync(
      new URL('../apps/cloud/wrangler.deploy.jsonc', import.meta.url),
      `${JSON.stringify(deployConfig(template, process.env), null, 2)}\n`,
    );
    console.log('apps/cloud/wrangler.deploy.jsonc gerado.');
  } catch (error) {
    console.error(
      error instanceof Error ? error.message : 'Configuração inválida.',
    );
    process.exitCode = 1;
  }
}
