import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const maximumLineCount = 2000;

/** 统计文本的逻辑行数，同时兼容 LF、CRLF 和 CR 换行。 */
function countLines(contents) {
  if (contents.length === 0) return 0;

  let lineCount = 0;
  for (let index = 0; index < contents.length; index += 1) {
    if (contents[index] === 0x0a) {
      lineCount += 1;
    } else if (contents[index] === 0x0d && contents[index + 1] !== 0x0a) {
      lineCount += 1;
    }
  }

  const lastByte = contents[contents.length - 1];
  return lastByte === 0x0a || lastByte === 0x0d ? lineCount : lineCount + 1;
}

const projectFiles = execFileSync(
  'git',
  ['ls-files', '--cached', '--others', '--exclude-standard', '-z'],
  { cwd: root, encoding: 'utf8' },
)
  .split('\0')
  .filter(Boolean);

const violations = [];
for (const projectFile of projectFiles) {
  const absolutePath = resolve(root, projectFile);
  if (!existsSync(absolutePath)) continue;

  const lineCount = countLines(readFileSync(absolutePath));
  if (lineCount > maximumLineCount) {
    violations.push(`${relative(root, absolutePath)} has ${lineCount} lines (maximum is ${maximumLineCount})`);
  }
}

if (violations.length > 0) {
  for (const violation of violations) console.error(`- ${violation}`);
  process.exitCode = 1;
} else {
  console.log(`Validated ${projectFiles.length} project files; each is at most ${maximumLineCount} lines.`);
}
