import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const configDirectory = resolve(root, 'assets/examples/configs');
const configNamePattern = /Numbers\.ts$/;
const forbiddenPatterns = [
  { pattern: /^\s*import\s/m, description: 'imports' },
  { pattern: /\b(?:function|class|if|else|for|while|switch|try|catch)\b/, description: 'control flow or declarations' },
  { pattern: /=>/, description: 'arrow functions' },
  { pattern: /\bnew\s+[A-Za-z_$][\w$]*/, description: 'object construction' },
  { pattern: /\b[A-Za-z_$][\w$]*\s*\(/, description: 'function calls' },
];

/** 去除注释，避免规则说明文字被误判为配置逻辑。 */
function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

if (!existsSync(configDirectory)) {
  console.error(`Missing game config directory: ${relative(root, configDirectory)}`);
  process.exitCode = 1;
} else {
  const configFiles = readdirSync(configDirectory)
    .filter((name) => configNamePattern.test(name))
    .sort();
  const errors = [];

  for (const name of configFiles) {
    const projectPath = `assets/examples/configs/${name}`;
    const source = stripComments(readFileSync(resolve(configDirectory, name), 'utf8'));
    if (!/^\s*export\s+const\s+[A-Z][A-Z0-9_]*\s*=/.test(source)) {
      errors.push(`${projectPath} must export an uppercase const data object`);
    }
    for (const { pattern, description } of forbiddenPatterns) {
      if (pattern.test(source)) errors.push(`${projectPath} contains ${description}`);
    }
  }

  if (configFiles.length === 0) errors.push('No *Numbers.ts files found in assets/examples/configs');
  if (errors.length > 0) {
    for (const error of errors) console.error(`- ${error}`);
    process.exitCode = 1;
  } else {
    console.log(`Validated ${configFiles.length} numeric game config files without logic.`);
  }
}
