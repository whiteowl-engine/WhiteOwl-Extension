import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.cwd());
const textExtensions = new Set(['.js', '.css', '.html', '.json', '.md']);
const syntaxFiles = [
  'background.js',
  'content.js',
  'provider.js',
  'sidepanel.js',
  'i18n-ext.js'
];
const commentExclusions = new Set(['lightweight-charts.js']);
const cyrillic = /[\u0400-\u04FF]/;
const jsLineComment = /^\s*\/\//m;
const jsBlockComment = /^\s*\/\*/m;
const htmlComment = /<!--/m;

const files = [];
const failures = [];

function walk(dirPath) {
  for (const entry of readdirSync(dirPath)) {
    if (entry === '.git' || entry === 'node_modules' || entry === 'dist') {
      continue;
    }
    const fullPath = path.join(dirPath, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      walk(fullPath);
      continue;
    }
    if (textExtensions.has(path.extname(entry).toLowerCase())) {
      files.push(fullPath);
    }
  }
}

function relative(filePath) {
  return path.relative(root, filePath).split(path.sep).join('/');
}

walk(root);

for (const file of files) {
  const rel = relative(file);
  const base = path.basename(file);
  const ext = path.extname(file).toLowerCase();
  const text = readFileSync(file, 'utf8');

  if (cyrillic.test(text)) {
    failures.push(`Cyrillic found: ${rel}`);
  }

  if (commentExclusions.has(base)) {
    continue;
  }

  if (ext === '.js' && (jsLineComment.test(text) || jsBlockComment.test(text) || htmlComment.test(text))) {
    failures.push(`Comment marker found: ${rel}`);
  }

  if (ext === '.css' && jsBlockComment.test(text)) {
    failures.push(`Comment marker found: ${rel}`);
  }

  if (ext === '.html' && htmlComment.test(text)) {
    failures.push(`Comment marker found: ${rel}`);
  }
}

for (const file of syntaxFiles) {
  execFileSync(process.execPath, ['--check', path.join(root, file)], { stdio: 'pipe' });
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log('Validation passed.');