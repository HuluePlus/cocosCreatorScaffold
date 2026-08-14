import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const assetsRoot = resolve(root, 'assets');
const frameworkDemoUuid = 'b6e0a2c8-4569-4d1d-9b4c-1f2e3a4b5c6d';
const frameworkDemoType = 'b6e0aLIRWlNHZtMHy46S1xt';
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** 递归返回 assets 下除 meta 外的目录和文件。 */
function assetEntries(directory) {
  const result = [];
  for (const name of readdirSync(directory)) {
    if (name.endsWith('.meta')) continue;
    const absolute = resolve(directory, name);
    result.push(absolute);
    if (statSync(absolute).isDirectory()) result.push(...assetEntries(absolute));
  }
  return result;
}

const errors = [];
const uuids = new Map();
const entries = assetEntries(assetsRoot);

for (const absolute of entries) {
  const projectPath = relative(root, absolute).replaceAll('\\', '/');
  const metaPath = `${absolute}.meta`;
  if (!existsSync(metaPath)) {
    errors.push(`${projectPath} is missing .meta`);
    continue;
  }
  try {
    const meta = JSON.parse(readFileSync(metaPath, 'utf8'));
    if (typeof meta.uuid !== 'string' || !uuidPattern.test(meta.uuid)) {
      errors.push(`${projectPath}.meta has an invalid uuid`);
      continue;
    }
    const previous = uuids.get(meta.uuid);
    if (previous) errors.push(`duplicate uuid ${meta.uuid}: ${previous}, ${projectPath}`);
    else uuids.set(meta.uuid, projectPath);
  } catch {
    errors.push(`${projectPath}.meta is not valid JSON`);
  }
}

const demoMeta = JSON.parse(
  readFileSync(resolve(root, 'assets/examples/scenes/FrameworkDemo.ts.meta'), 'utf8'),
);
if (demoMeta.uuid !== frameworkDemoUuid) {
  errors.push('FrameworkDemo.ts.meta uuid does not match the generated scene');
}

const scene = JSON.parse(readFileSync(resolve(root, 'assets/scenes/main.scene'), 'utf8'));
if (!Array.isArray(scene) || !scene.some((entry) => entry?.__type__ === frameworkDemoType)) {
  errors.push('main.scene does not contain the FrameworkDemo component');
}

const frameworkFiles = entries.filter((absolute) =>
  absolute.endsWith('.ts') && absolute.startsWith(resolve(root, 'assets/framework')),
);
for (const file of frameworkFiles) {
  const source = readFileSync(file, 'utf8');
  if (/from\s+['"][^'"]*examples\//.test(source)) {
    errors.push(`${relative(root, file)} imports examples business code`);
  }
}

const typeScriptFiles = entries.filter((absolute) => absolute.endsWith('.ts'));
for (const file of typeScriptFiles) {
  const source = readFileSync(file, 'utf8');
  if (/\bany\b|@ts-ignore/.test(source)) errors.push(`${relative(root, file)} contains a forbidden type`);
}

if (errors.length > 0) {
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log(`Validated ${entries.length} assets, ${uuids.size} unique UUIDs, and framework boundaries.`);
}
