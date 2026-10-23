import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { deployConfig, parseJsonc } from './cloud-deploy-config.mjs';

const template = {
    name: 'tatu',
    workers_dev: false,
    triggers: { crons: ['* * * * *'] },
    d1_databases: [
      { binding: 'DB', database_name: 'tatu', database_id: 'REPLACE' },
    ],
    vars: { AUTH_MODE: 'cloudflare-access' },
  },
  valid = {
    TATU_D1_DATABASE_ID: '00000000-0000-4000-8000-000000000000',
    TATU_SITE_ORIGIN: 'https://tatu.example.workers.dev',
  };

test('deploy config defaults to Telegram-only, workers.dev and no Cron', () => {
  const config = deployConfig(template, valid);
  assert.equal(config.d1_databases[0].database_id, valid.TATU_D1_DATABASE_ID);
  assert.equal(config.workers_dev, true);
  assert.deepEqual(config.triggers.crons, []);
  assert.deepEqual(config.vars, {
    AUTH_MODE: 'telegram-only',
    SITE_ORIGIN: 'https://tatu.example.workers.dev',
    SCHEDULER_ENABLED: 'false',
  });
  assert.equal(template.d1_databases[0].database_id, 'REPLACE');
});

test('scheduler and Access modes are explicit and validated', () => {
  const config = deployConfig(template, {
    ...valid,
    TATU_SITE_ORIGIN: 'https://tatu.example.com',
    TATU_SCHEDULER_ENABLED: 'true',
    TATU_AUTH_MODE: 'cloudflare-access',
    TATU_ACCESS_TEAM_DOMAIN: 'team.cloudflareaccess.com',
    TATU_ACCESS_AUDIENCE: 'aud',
  });
  assert.equal(config.workers_dev, false);
  assert.deepEqual(config.triggers.crons, ['* * * * *']);
  assert.equal(config.vars.ACCESS_TEAM_DOMAIN, 'team.cloudflareaccess.com');
  for (const overrides of [
    { TATU_D1_DATABASE_ID: 'nao-e-uuid' },
    { TATU_D1_DATABASE_ID: undefined },
    { TATU_SITE_ORIGIN: 'https://u:p@tatu.example.com' },
    { TATU_SITE_ORIGIN: 'https://tatu.example.com/?x=1' },
    { TATU_SITE_ORIGIN: 'https://tatu.example.com/#x' },
    { TATU_SITE_ORIGIN: 'http://tatu.example.com' },
    { TATU_SITE_ORIGIN: 'https://tatu.example.com/app' },
    { TATU_AUTH_MODE: 'sites' },
    { TATU_SCHEDULER_ENABLED: 'yes' },
    { TATU_AUTH_MODE: 'cloudflare-access' },
  ])
    assert.throws(() => deployConfig(template, { ...valid, ...overrides }));
});

test('the real wrangler.jsonc template parses and is not mutated', () => {
  const real = parseJsonc(
    readFileSync(
      new URL('../apps/cloud/wrangler.jsonc', import.meta.url),
      'utf8',
    ),
  );
  const before = JSON.stringify(real);
  const config = deployConfig(real, valid);
  assert.equal(JSON.stringify(real), before);
  assert.equal(config.d1_databases[0].migrations_dir, 'migrations');
  assert.equal(config.main, 'dist/server/index.js');
  assert.deepEqual(config.ai, { binding: 'AI' });
  assert.equal(config.vars.ACCESS_AUDIENCE, undefined);
});
