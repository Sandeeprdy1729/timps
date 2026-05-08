import fs from 'fs';
import path from 'path';

export interface FileInfo {
  path: string;
  name: string;
  extension: string;
  size: number;
  isDirectory: boolean;
  created: Date;
  modified: Date;
}

export interface GlobOptions {
  cwd?: string;
  absolute?: boolean;
  ignore?: string[];
  maxDepth?: number;
}

export async function glob(pattern: string, options?: GlobOptions): Promise<string[]> {
  const { cwd = process.cwd(), absolute = false, ignore = [], maxDepth = 10 } = options || {};
  const results: string[] = [];
  const basePath = path.resolve(cwd);
  const [dirPattern, filePattern] = pattern.split('/').reduce((acc, part, i, arr) => {
    if (i === arr.length - 1) acc[1] = part;
    else acc[0] += part + '/';
    return acc;
  }, ['', '']);

  const walk = async (dir: string, depth: number) => {
    if (depth > maxDepth) return;
    if (ignore.some((i) => dir.includes(i))) return;

    try {
      const entries = await fs.promises.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          await walk(fullPath, depth + 1);
        } else {
          const matches = new RegExp(filePattern.replace(/\*/g, '.*').replace(/\?/g, '.'));
          if (matches.test(entry.name)) {
            results.push(absolute ? fullPath : path.relative(basePath, fullPath));
          }
        }
      }
    } catch (e) {
      // Skip permission errors
    }
  };

  await walk(basePath, 0);
  return results;
}

export async function fileInfo(filePath: string): Promise<FileInfo> {
  const stats = await fs.promises.stat(filePath);
  return {
    path: filePath,
    name: path.basename(filePath),
    extension: path.extname(filePath),
    size: stats.size,
    isDirectory: stats.isDirectory(),
    created: stats.birthtime,
    modified: stats.mtime,
  };
}

export async function readJson<T = any>(filePath: string): Promise<T> {
  const content = await fs.promises.readFile(filePath, 'utf-8');
  return JSON.parse(content);
}

export async function writeJson(filePath: string, data: any): Promise<void> {
  await fs.promises.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

export async function ensureDir(dirPath: string): Promise<void> {
  await fs.promises.mkdir(dirPath, { recursive: true });
}

export async function copyFile(src: string, dest: string): Promise<void> {
  await fs.promises.copyFile(src, dest);
}

export async function moveFile(src: string, dest: string): Promise<void> {
  await fs.promises.rename(src, dest);
}

export async function deleteFile(filePath: string): Promise<void> {
  const stats = await fs.promises.stat(filePath);
  if (stats.isDirectory()) {
    await fs.promises.rm(filePath, { recursive: true });
  } else {
    await fs.promises.unlink(filePath);
  }
}

export async function exists(filePath: string): Promise<boolean> {
  try {
    await fs.promises.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function isEmptyDir(dirPath: string): Promise<boolean> {
  const entries = await fs.promises.readdir(dirPath);
  return entries.length === 0;
}

export async function sizeOf(filePath: string): Promise<number> {
  const stats = await fs.promises.stat(filePath);
  return stats.size;
}

export async function lastModified(filePath: string): Promise<Date> {
  const stats = await fs.promises.stat(filePath);
  return stats.mtime;
}

export async function walkDir(
  dirPath: string,
  callback: (filePath: string, stats: fs.Stats) => void | Promise<void>
): Promise<void> {
  const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    const stats = await fs.promises.stat(fullPath);
    await callback(fullPath, stats);
    if (entry.isDirectory()) {
      await walkDir(fullPath, callback);
    }
  }
}

export { fs, path };