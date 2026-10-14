import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import process from 'node:process';
import { URL } from 'node:url';
import { siteManifest, privateSiteOrigin } from './site-config.mjs';

const template = { d1: 'DB', r2: null, capabilities: ['mcp'] };
test('ordinary cloud builds need no installation identity', async () => {
  assert.equal(siteManifest(template), null);
  assert.deepEqual(
    JSON.parse(
      await readFile(
        new URL('../apps/cloud/.openai/hosting.template.json', import.meta.url),
        'utf8',
      ),
    ),
    template,
  );
});
test('private export requires an explicit valid identity without modifying the generic template', () => {
  assert.throws(
    () => siteManifest(template, {}, true),
    /explicitly configured/u,
  );
  for (const value of [
    '../appgprj_example',
    'appgprj_example\n',
    ' appgprj_example',
    'https://example.invalid',
    'appgprj_',
    'appgprj_' + 'x'.repeat(129),
  ])
    assert.throws(
      () => siteManifest(template, { SITE_PROJECT_ID: value }, true),
      /Invalid SITE_PROJECT_ID/u,
    );
  assert.deepEqual(
    siteManifest(
      template,
      { SITE_PROJECT_ID: 'appgprj_synthetic_example' },
      true,
    ),
    { project_id: 'appgprj_synthetic_example', ...template },
  );
  assert.equal(Object.hasOwn(template, 'project_id'), false);
  assert.throws(
    () => siteManifest({ ...template, project_id: 'appgprj_embedded' }),
    /generic/u,
  );
});
test('export CLI rejects absent identity before running its build command', async () => {
  const environment = { ...process.env };
  delete environment.SITE_PROJECT_ID;
  const packageJson = JSON.parse(
    await readFile(new URL('../package.json', import.meta.url), 'utf8'),
  );
  assert.ok(
    packageJson.scripts['export:site'].startsWith(
      'node scripts/site-config.mjs && ',
    ),
  );
  await assert.rejects(
    promisify(execFile)(
      process.execPath,
      ['scripts/build-cloud.mjs', '--export-site'],
      { env: environment },
    ),
    /SITE_PROJECT_ID must be explicitly configured/u,
  );
  await assert.rejects(
    promisify(execFile)(process.execPath, ['scripts/site-config.mjs'], {
      env: environment,
    }),
    /SITE_PROJECT_ID must be explicitly configured/u,
  );
});
test('probe allows only explicit generated HTTPS Sites origins', () => {
  assert.equal(
    privateSiteOrigin('https://synthetic-beta.example.chatgpt.site'),
    'https://synthetic-beta.example.chatgpt.site',
  );
  for (const value of [
    undefined,
    '',
    'http://synthetic-beta.example.chatgpt.site',
    'https://user:password@synthetic-beta.example.chatgpt.site',
    'https://synthetic-beta.example.chatgpt.site:8443',
    'https://synthetic-beta.example.chatgpt.site/path',
    'https://synthetic-beta.example.chatgpt.site/?token=x',
    'https://synthetic-beta.example.chatgpt.site/#fragment',
    'https://synthetic-beta.example.chatgpt.site.evil.invalid',
    'https://example.invalid',
  ])
    assert.throws(() => privateSiteOrigin(value), /invalid_origin/u);
});
