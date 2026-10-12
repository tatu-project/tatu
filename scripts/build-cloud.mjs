import { build } from 'esbuild';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';
import console from 'node:console';
import { Buffer } from 'node:buffer';
import { createSiteSnapshot } from './site-export.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const cloud = resolve(root, 'apps/cloud');
const output = resolve(cloud, 'dist');
await mkdir(resolve(output, 'server'), { recursive: true });
await mkdir(resolve(output, '.openai/drizzle/meta'), { recursive: true });
const result = await build({
  absWorkingDir: cloud,
  tsconfig: resolve(cloud, 'tsconfig.json'),
  entryPoints: [resolve(cloud, 'src/index.ts')],
  outfile: resolve(output, 'server/index.js'),
  bundle: true,
  platform: 'browser',
  format: 'esm',
  target: 'es2022',
  metafile: true,
  conditions: ['worker', 'browser'],
  legalComments: 'none',
});
for (const entry of Object.values(result.metafile.outputs)) {
  if (entry.imports.length)
    throw new Error(
      'Worker artifact must not have external or native Node imports.',
    );
}
const manifest = JSON.parse(
  await readFile(resolve(cloud, '.openai/hosting.json'), 'utf8'),
);
if (
  !manifest.project_id ||
  manifest.d1 !== 'DB' ||
  !manifest.capabilities.includes('mcp')
)
  throw new Error('Cloud identity/storage declaration is incomplete.');
await writeFile(
  resolve(output, '.openai/hosting.json'),
  `${JSON.stringify(manifest, null, 2)}\n`,
);
const migrations = (await readdir(resolve(cloud, 'migrations')))
  .filter((name) => /^\d{4}_[\w-]+\.sql$/u.test(name))
  .sort();
const entries = [];
for (const [index, name] of migrations.entries()) {
  const original = await readFile(resolve(cloud, 'migrations', name), 'utf8');
  // Match the supported Sites Drizzle migration artifact without adding a runtime ORM.
  const statements = original
    .split(';')
    .map((statement) => statement.trim())
    .filter(Boolean);
  await writeFile(
    resolve(output, '.openai/drizzle', name),
    `${statements.join(';\n--> statement-breakpoint\n')};\n`,
  );
  entries.push({
    idx: index,
    version: '6',
    when: Date.UTC(2026, 9, 12) + index,
    tag: name.slice(0, -4),
    breakpoints: true,
  });
}
await writeFile(
  resolve(output, '.openai/drizzle/meta/_journal.json'),
  `${JSON.stringify({ version: '7', dialect: 'sqlite', entries }, null, 2)}\n`,
);
const source = await readFile(resolve(output, 'server/index.js'), 'utf8');
const worker = await import(
  `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`
);
if (
  typeof worker.default?.fetch !== 'function' ||
  typeof worker.default?.scheduled !== 'function'
)
  throw new Error('Worker must expose fetch and scheduled handlers.');
console.log(
  `Cloud Worker built: ${Buffer.byteLength(source)} bytes, ${migrations.length} schema migrations; no external native imports.`,
);
if (process.argv.includes('--export-site')) {
  console.log(JSON.stringify(await createSiteSnapshot(output, root)));
}
