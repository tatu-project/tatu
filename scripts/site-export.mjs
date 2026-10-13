import {
  lstat,
  realpath,
  readFile,
  readdir,
  mkdir,
  mkdtemp,
  writeFile,
} from 'node:fs/promises';
import { resolve, dirname, sep, join, relative } from 'node:path';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import process from 'node:process';
import console from 'node:console';

const normalizedPath = (value, paths = path) =>
  paths.toNamespacedPath(paths.resolve(value));
export const isStrictDescendant = (root, target, paths = path) => {
  const displacement = paths.relative(
    normalizedPath(root, paths),
    normalizedPath(target, paths),
  );
  return (
    displacement !== '' &&
    displacement !== '..' &&
    !displacement.startsWith(`..${paths.sep}`) &&
    !paths.isAbsolute(displacement)
  );
};
const segmentsFor = (relative) => {
  const segments = relative.split('/');
  if (
    segments.some(
      (segment) => !/^[\w.-]+$/u.test(segment) || ['.', '..'].includes(segment),
    )
  )
    throw new Error('Invalid export path.');
  return segments;
};
export async function checkedPath(root, relative = '', allowMissing = false) {
  const absoluteRoot = resolve(root);
  const rootInfo = await lstat(absoluteRoot);
  if (!rootInfo.isDirectory() || rootInfo.isSymbolicLink())
    throw new Error('Export root must be a real directory.');
  const canonicalRoot = await realpath(absoluteRoot);
  let current = absoluteRoot;
  for (const segment of relative ? segmentsFor(relative) : []) {
    current = join(current, segment);
    let info;
    try {
      info = await lstat(current);
    } catch (error) {
      if (allowMissing && error.code === 'ENOENT') continue;
      throw error;
    }
    if (info.isSymbolicLink())
      throw new Error('Symbolic links are forbidden in Site exports.');
    if (!isStrictDescendant(canonicalRoot, await realpath(current)))
      throw new Error('Export path escaped its root.');
  }
  return current;
}
const verifiedFile = async (root, relative, maximum = 2097152) => {
  const path = await checkedPath(root, relative);
  const info = await lstat(path);
  if (!info.isFile() || info.size > maximum)
    throw new Error(`Invalid declared export file: ${relative}`);
  return readFile(path);
};
export async function declaredArtifact(root) {
  const manifestBytes = await verifiedFile(root, '.openai/hosting.json', 16384);
  const manifest = JSON.parse(manifestBytes.toString('utf8'));
  if (
    typeof manifest.project_id !== 'string' ||
    !/^appgprj_[a-zA-Z0-9_]+$/u.test(manifest.project_id) ||
    manifest.d1 !== 'DB' ||
    !Array.isArray(manifest.capabilities) ||
    !manifest.capabilities.includes('mcp')
  )
    throw new Error('Invalid Site identity/storage declaration.');
  const journalBytes = await verifiedFile(
    root,
    '.openai/drizzle/meta/_journal.json',
    32768,
  );
  const journal = JSON.parse(journalBytes.toString('utf8'));
  if (
    journal.dialect !== 'sqlite' ||
    journal.version !== '7' ||
    !Array.isArray(journal.entries) ||
    journal.entries.length < 1 ||
    journal.entries.length > 100
  )
    throw new Error('Invalid declared migration journal.');
  const files = new Map([
    ['server/index.js', await verifiedFile(root, 'server/index.js', 5242880)],
    ['.openai/hosting.json', manifestBytes],
    ['.openai/drizzle/meta/_journal.json', journalBytes],
  ]);
  const tags = new Set();
  for (const [index, entry] of journal.entries.entries()) {
    if (
      entry.idx !== index ||
      !/^\d{4}_[\w-]+$/u.test(entry.tag) ||
      tags.has(entry.tag) ||
      !Number.isSafeInteger(entry.when) ||
      entry.breakpoints !== true
    )
      throw new Error('Invalid migration entry.');
    tags.add(entry.tag);
    const relative = `.openai/drizzle/${entry.tag}.sql`;
    files.set(relative, await verifiedFile(root, relative));
  }
  return { files, manifest };
}
async function treeMatches(root, approvedFiles, allowGit = false) {
  await checkedPath(root);
  const approved = new Set(approvedFiles);
  const walk = async (relative = '') => {
    const directory = await checkedPath(root, relative);
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const name = relative ? `${relative}/${entry.name}` : entry.name;
      const path = await checkedPath(root, name);
      const info = await lstat(path);
      if (allowGit && name === '.git' && info.isDirectory()) continue;
      if (info.isDirectory()) {
        if (![...approved].some((file) => file.startsWith(`${name}/`)))
          throw new Error(`Unrelated export directory preserved: ${name}`);
        await walk(name);
      } else if (!info.isFile() || !approved.has(name))
        throw new Error(`Unrelated export file preserved: ${name}`);
    }
  };
  await walk();
}
export async function createSiteSnapshot(artifactRoot, workspaceRoot) {
  await checkedPath(
    workspaceRoot,
    relative(normalizedPath(workspaceRoot), normalizedPath(artifactRoot))
      .split(sep)
      .join('/'),
  );
  const { files, manifest } = await declaredArtifact(artifactRoot);
  await checkedPath(workspaceRoot);
  const parent = await checkedPath(workspaceRoot, 'tmp', true);
  try {
    await mkdir(parent);
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
  }
  await checkedPath(workspaceRoot, 'tmp');
  const directory = await mkdtemp(join(parent, 'cloudsite-export-'));
  const snapshotFiles = new Map(
    [...files].map(([name, data]) => [`dist/${name}`, data]),
  );
  snapshotFiles.set('.openai/hosting.json', files.get('.openai/hosting.json'));
  snapshotFiles.set(
    'README.md',
    '# Tatu private cloud beta\n\nThis fresh snapshot contains only the declared bundled Fetch Worker and migration journal/SQL from apps/cloud. No environment files, logs, runtime data, credentials, model binaries, or native dependencies are included. Hosting authentication/secrets require separate control-plane configuration. Portable Cron is independent of Sites-linked automations.\n',
  );
  for (const [name, data] of snapshotFiles) {
    const path = await checkedPath(directory, name, true);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, data);
  }
  await treeMatches(directory, snapshotFiles.keys());
  return {
    directory,
    projectId: manifest.project_id,
    files: [...snapshotFiles.keys()],
  };
}
export async function copySiteSnapshot(snapshot, checkout, workspaceRoot) {
  const canonicalWorkspace = await realpath(await checkedPath(workspaceRoot));
  for (const target of [snapshot, checkout]) {
    if (!isStrictDescendant(join(canonicalWorkspace, 'tmp'), target))
      throw new Error('Site source paths must remain inside workspace/tmp.');
    await checkedPath(
      workspaceRoot,
      relative(normalizedPath(workspaceRoot), normalizedPath(target))
        .split(sep)
        .join('/'),
    );
  }
  const { files, manifest } = await declaredArtifact(resolve(snapshot, 'dist'));
  const approved = [...files.keys()]
    .map((name) => `dist/${name}`)
    .concat(['.openai/hosting.json', 'README.md']);
  await treeMatches(snapshot, approved);
  const rootManifest = JSON.parse(
    (await verifiedFile(snapshot, '.openai/hosting.json', 16384)).toString(
      'utf8',
    ),
  );
  if (JSON.stringify(rootManifest) !== JSON.stringify(manifest))
    throw new Error('Snapshot manifests disagree.');
  const readme = await verifiedFile(snapshot, 'README.md', 16384);
  await checkedPath(checkout);
  await treeMatches(checkout, [...approved, '.gitignore'], true);
  const destinationManifest = await checkedPath(
    checkout,
    '.openai/hosting.json',
    true,
  );
  try {
    const existing = JSON.parse(
      (await readFile(destinationManifest)).toString('utf8'),
    );
    if (existing.project_id !== manifest.project_id)
      throw new Error('Site source identity mismatch; checkout preserved.');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  // Complete every preflight before writing anything; no deletion or recursive directory copy.
  const data = new Map(
    [...files].map(([name, bytes]) => [`dist/${name}`, bytes]),
  );
  data.set('.openai/hosting.json', files.get('.openai/hosting.json'));
  data.set('README.md', readme);
  for (const [name, bytes] of data) {
    const path = await checkedPath(checkout, name, true);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, bytes);
  }
  await treeMatches(checkout, [...approved, '.gitignore'], true);
  return {
    directory: resolve(checkout),
    projectId: manifest.project_id,
    files: approved,
  };
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const snapshot = process.argv[process.argv.indexOf('--copy-snapshot') + 1];
  const checkout = process.argv[process.argv.indexOf('--checkout') + 1];
  if (
    !process.argv.includes('--copy-snapshot') ||
    !process.argv.includes('--checkout') ||
    !snapshot ||
    !checkout
  )
    throw new Error(
      'Use --copy-snapshot <fresh snapshot> --checkout <Site checkout>.',
    );
  const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  console.log(
    JSON.stringify(
      await copySiteSnapshot(
        resolve(snapshot),
        resolve(checkout),
        workspaceRoot,
      ),
    ),
  );
}
