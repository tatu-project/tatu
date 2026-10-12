import assert from 'node:assert/strict';
import test from 'node:test';
import {
  mkdir,
  mkdtemp,
  readFile,
  writeFile,
  readdir,
  rm,
  symlink,
  rename,
} from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import process from 'node:process';
import { createSiteSnapshot, copySiteSnapshot } from './site-export.mjs';

async function fixture(context) {
  const workspace = await mkdtemp(join(tmpdir(), 'tatu-export-test-'));
  context.after(async () => {
    assert.ok(workspace.startsWith(join(tmpdir(), 'tatu-export-test-')));
    await rm(workspace, { recursive: true, force: true });
  });
  const artifact = join(workspace, 'artifact');
  await mkdir(join(artifact, '.openai/drizzle/meta'), { recursive: true });
  await mkdir(join(artifact, 'server'));
  await writeFile(
    join(artifact, 'server/index.js'),
    "export default {fetch(){return new Response('fixture');},scheduled(){}};\n",
  );
  await writeFile(
    join(artifact, '.openai/hosting.json'),
    JSON.stringify({
      project_id: 'appgprj_test1234567890',
      d1: 'DB',
      r2: null,
      capabilities: ['mcp'],
    }),
  );
  await writeFile(
    join(artifact, '.openai/drizzle/meta/_journal.json'),
    JSON.stringify({
      version: '7',
      dialect: 'sqlite',
      entries: [
        {
          idx: 0,
          version: '6',
          when: 1791763200000,
          tag: '0001_workspace',
          breakpoints: true,
        },
      ],
    }),
  );
  await writeFile(
    join(artifact, '.openai/drizzle/0001_workspace.sql'),
    'CREATE TABLE sample (id TEXT PRIMARY KEY);\n',
  );
  await mkdir(join(workspace, 'tmp'));
  return { workspace, artifact };
}
test('fresh snapshots exclude planted environment files and stale undeclared SQL without changing old exports', async (context) => {
  const { workspace, artifact } = await fixture(context);
  const previous = join(workspace, 'tmp/cloudsite');
  await mkdir(previous);
  await writeFile(join(previous, '.env'), 'existing-user-configuration');
  await writeFile(join(artifact, '.env'), 'not-for-export');
  await writeFile(
    join(artifact, '.openai/drizzle/0999_stale.sql'),
    'CREATE TABLE stale (id TEXT);',
  );
  const first = await createSiteSnapshot(artifact, workspace);
  const second = await createSiteSnapshot(artifact, workspace);
  assert.notEqual(first.directory, second.directory);
  assert.notEqual(first.directory, previous);
  assert.equal(
    await readFile(join(previous, '.env'), 'utf8'),
    'existing-user-configuration',
  );
  assert.deepEqual(
    (await readdir(join(first.directory, 'dist/.openai/drizzle'))).sort(),
    ['0001_workspace.sql', 'meta'],
  );
  assert.deepEqual(
    first.files.sort(),
    [
      '.openai/hosting.json',
      'README.md',
      'dist/.openai/drizzle/0001_workspace.sql',
      'dist/.openai/drizzle/meta/_journal.json',
      'dist/.openai/hosting.json',
      'dist/server/index.js',
    ].sort(),
  );
  assert.equal((await readdir(first.directory)).includes('.env'), false);
});
test('checkout copy rejects unrelated files before overwriting known files and preserves Git metadata', async (context) => {
  const { workspace, artifact } = await fixture(context);
  const snapshot = await createSiteSnapshot(artifact, workspace);
  const checkout = join(workspace, 'tmp/cloudsite');
  await mkdir(join(checkout, '.git'), { recursive: true });
  await writeFile(
    join(checkout, '.git/config'),
    'private-metadata-not-read-or-rewritten',
  );
  await writeFile(join(checkout, 'README.md'), 'existing-readme');
  await writeFile(join(checkout, '.env'), 'existing-user-configuration');
  await assert.rejects(
    copySiteSnapshot(snapshot.directory, checkout, workspace),
    /Unrelated export file preserved/u,
  );
  assert.equal(
    await readFile(join(checkout, 'README.md'), 'utf8'),
    'existing-readme',
  );
  assert.equal(
    await readFile(join(checkout, '.env'), 'utf8'),
    'existing-user-configuration',
  );
  assert.equal(
    await readFile(join(checkout, '.git/config'), 'utf8'),
    'private-metadata-not-read-or-rewritten',
  );
});
test('declared-only checkout copy succeeds and leaves legitimate Git metadata unchanged', async (context) => {
  const { workspace, artifact } = await fixture(context);
  const snapshot = await createSiteSnapshot(artifact, workspace);
  const checkout = join(workspace, 'tmp/cloudsite');
  await mkdir(join(checkout, '.git'), { recursive: true });
  await writeFile(join(checkout, '.git/config'), 'preserved');
  const copied = await copySiteSnapshot(
    snapshot.directory,
    checkout,
    workspace,
  );
  assert.equal(copied.projectId, 'appgprj_test1234567890');
  assert.equal(
    await readFile(join(checkout, '.git/config'), 'utf8'),
    'preserved',
  );
  assert.equal(
    await readFile(join(checkout, 'dist/server/index.js'), 'utf8'),
    await readFile(join(artifact, 'server/index.js'), 'utf8'),
  );
});
test('artifact and checkout directory symlinks are rejected without writing through them', async (context) => {
  const { workspace, artifact } = await fixture(context);
  const outside = join(workspace, 'outside');
  await mkdir(outside);
  await writeFile(join(outside, 'index.js'), 'external-file-preserved');
  const kind = process.platform === 'win32' ? 'junction' : 'dir';
  const snapshot = await createSiteSnapshot(artifact, workspace);
  const checkout = join(workspace, 'tmp/cloudsite');
  await mkdir(checkout);
  await symlink(outside, join(checkout, 'dist'), kind);
  await assert.rejects(
    copySiteSnapshot(snapshot.directory, checkout, workspace),
    /Symbolic links/u,
  );
  assert.equal(
    await readFile(join(outside, 'index.js'), 'utf8'),
    'external-file-preserved',
  );
  await rename(join(artifact, 'server'), join(artifact, 'original-server'));
  await symlink(outside, join(artifact, 'server'), kind);
  await assert.rejects(
    createSiteSnapshot(artifact, workspace),
    /Symbolic links/u,
  );
  assert.equal(
    await readFile(join(outside, 'index.js'), 'utf8'),
    'external-file-preserved',
  );
});
test('a symlink in a snapshot ancestor cannot bypass the workspace boundary', async (context) => {
  const { workspace, artifact } = await fixture(context);
  const snapshot = await createSiteSnapshot(artifact, workspace);
  const linked = join(workspace, 'tmp/linked-snapshot');
  await symlink(
    snapshot.directory,
    linked,
    process.platform === 'win32' ? 'junction' : 'dir',
  );
  const checkout = join(workspace, 'tmp/cloudsite');
  await mkdir(checkout);
  await assert.rejects(
    copySiteSnapshot(linked, checkout, workspace),
    /Symbolic links/u,
  );
  assert.deepEqual(await readdir(checkout), []);
});
