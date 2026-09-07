import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

export const ROOT = path.resolve(import.meta.dirname, '..', '..');
export const CACHE = path.join(ROOT, '.cache', 'assets');
export const PUBLIC = path.join(ROOT, 'public', 'assets', 'waseem');
export const GENERATED = path.join(ROOT, 'src', 'data', 'generated');

const execFileAsync = promisify(execFile);

export function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

export function sha1(s) {
  return crypto.createHash('sha1').update(s).digest('hex');
}

/** Fetches a URL into the cache (once) and returns the cached file path. */
export async function fetchCached(url, ext) {
  ensureDir(CACHE);
  const file = path.join(CACHE, `${sha1(url)}${ext}`);
  if (fs.existsSync(file) && fs.statSync(file).size > 0) return file;
  const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 (Waseem Stage1 asset localiser)' } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const type = res.headers.get('content-type') ?? '';
  if (!/image|video|octet-stream/.test(type)) throw new Error(`Unexpected content-type ${type} for ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(file, buf);
  return file;
}

export async function run(cmd, args, opts = {}) {
  const { stdout, stderr } = await execFileAsync(cmd, args, { windowsHide: true, maxBuffer: 64 * 1024 * 1024, ...opts });
  return { stdout, stderr };
}

export async function ffprobe(file) {
  const { stdout } = await run('ffprobe', [
    '-v',
    'error',
    '-show_entries',
    'format=duration,size:stream=width,height,codec_name,codec_type',
    '-of',
    'json',
    file,
  ]);
  const json = JSON.parse(stdout);
  const video = (json.streams ?? []).find((s) => s.codec_type === 'video') ?? {};
  return {
    duration: Number(json.format?.duration ?? 0),
    size: Number(json.format?.size ?? 0),
    width: Number(video.width ?? 0),
    height: Number(video.height ?? 0),
    codec: video.codec_name ?? '',
  };
}

export function extOf(url) {
  return path.extname(new URL(url).pathname).toLowerCase() || '.jpg';
}

export function fmtBytes(n) {
  return n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(2)} MB` : `${Math.round(n / 1024)} kB`;
}

export function rel(p) {
  return path.relative(ROOT, p).split(path.sep).join('/');
}
