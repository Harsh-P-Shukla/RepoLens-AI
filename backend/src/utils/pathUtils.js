import path from 'node:path';

export function toPosixPath(value) {
  return value.split(path.sep).join('/');
}

export function extensionOf(fileName) {
  return path.extname(fileName).toLowerCase();
}

export function sortDirectoryEntries(a, b) {
  if (a.isDirectory() && !b.isDirectory()) return -1;
  if (!a.isDirectory() && b.isDirectory()) return 1;
  return a.name.localeCompare(b.name);
}

