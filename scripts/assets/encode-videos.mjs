#!/usr/bin/env node
/**
 * Encodes the campaign films into web clips: 1280 landscape, 720 landscape, 404×720 portrait,
 * plus poster frames. Trims are input-side (-ss, then -t duration). Muted, faststart, yuv420p.
 * Writes .cache/videos.json for the image localiser to merge into the asset map.
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { VIDEOS } from './manifest.mjs';
import { ROOT, PUBLIC, CACHE, ensureDir, run, ffprobe, fetchCached, fmtBytes, rel } from './lib.mjs';

const OUT = path.join(PUBLIC, 'video');
ensureDir(OUT);
ensureDir(CACHE);

const BUDGET_BYTES = 25 * 1024 * 1024;
const results = [];
let total = 0;

const BASE_ARGS = ['-y', '-hide_banner', '-loglevel', 'error'];
const CODEC_ARGS = ['-c:v', 'libx264', '-preset', 'slow', '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-level', '4.1', '-g', '50', '-movflags', '+faststart'];

for (const v of VIDEOS) {
  const input = path.join(ROOT, v.input);
  if (v.remote && !fs.existsSync(input)) {
    console.log(`fetching ${v.id} source…`);
    const cached = await fetchCached(v.remote, '.mp4');
    ensureDir(path.dirname(input));
    fs.copyFileSync(cached, input);
  }
  if (!fs.existsSync(input)) throw new Error(`missing source ${input}`);
  const src = await ffprobe(input);
  const duration = Number((v.end - v.start).toFixed(2));
  const fade = v.fadeEdges
    ? `,fade=t=in:st=0:d=${v.fadeEdges},fade=t=out:st=${(duration - v.fadeEdges).toFixed(2)}:d=${v.fadeEdges}`
    : '';
  const pre = v.cropWatermark ? 'crop=1140:641:0:79,' : '';
  const portraitH = Math.min(720, src.height - (src.height % 2));

  const variants = [
    { name: '1280', vf: `${pre}scale=1280:-2${fade},format=yuv420p`, crf: String(v.crf ?? 24) },
    { name: '720', vf: `${pre}scale=720:-2${fade},format=yuv420p`, crf: String((v.crf ?? 24) + 3) },
    { name: 'portrait', vf: `${pre}scale=-2:${portraitH},crop=404:${portraitH}:${v.portraitX}:0${fade},format=yuv420p`, crf: String((v.crf ?? 24) + 4) },
  ];

  const entry = { id: v.id, label: v.label, subject: v.subject, duration, files: {} };
  for (const variant of variants) {
    const file = path.join(OUT, `${v.id}-${variant.name}.mp4`);
    console.log(`encoding ${v.id} ${variant.name}…`);
    await run('ffmpeg', [
      ...BASE_ARGS,
      '-ss', String(v.start),
      '-i', input,
      '-t', String(duration),
      '-an',
      '-vf', variant.vf,
      ...CODEC_ARGS.slice(0, 4),
      '-crf', variant.crf,
      ...CODEC_ARGS.slice(4),
      file,
    ]);
    const info = await ffprobe(file);
    if (Math.abs(info.duration - duration) > 0.25) throw new Error(`${file}: duration ${info.duration} ≠ ${duration}`);
    if (info.width % 2 || info.height % 2) throw new Error(`${file}: odd dimensions ${info.width}×${info.height}`);
    total += info.size;
    entry.files[variant.name] = { path: file, src: `/assets/waseem/video/${path.basename(file)}`, width: info.width, height: info.height, bytes: info.size };
    console.log(`  ${path.basename(file)} ${info.width}×${info.height} ${fmtBytes(info.size)}`);
  }

  // poster = a frame from the trimmed 1280 clip, so it matches what plays
  const posterPng = path.join(CACHE, `${v.id}-poster.png`);
  const posterAt = Math.max(0, Math.min(duration - 0.1, v.poster - v.start));
  await run('ffmpeg', [...BASE_ARGS, '-ss', String(posterAt), '-i', entry.files['1280'].path, '-frames:v', '1', '-update', '1', posterPng]);
  const posterWebp = path.join(OUT, `${v.id}-poster.webp`);
  const posterJpg = path.join(OUT, `${v.id}-poster.jpg`);
  await sharp(posterPng).webp({ quality: 82 }).toFile(posterWebp);
  await sharp(posterPng).jpeg({ quality: 84, mozjpeg: true }).toFile(posterJpg);
  const blur = (await sharp(posterPng).resize(16).webp({ quality: 40 }).toBuffer()).toString('base64');
  entry.poster = `/assets/waseem/video/${v.id}-poster.webp`;
  entry.posterJpg = `/assets/waseem/video/${v.id}-poster.jpg`;
  entry.posterBlur = `data:image/webp;base64,${blur}`;
  for (const f of Object.values(entry.files)) delete f.path;
  results.push(entry);
}

fs.writeFileSync(path.join(CACHE, 'videos.json'), JSON.stringify(results, null, 2));
console.log(`\nvideo total ${fmtBytes(total)} (${total <= BUDGET_BYTES ? 'within' : 'OVER'} the 25 MB budget)`);
console.log(`wrote ${rel(path.join(CACHE, 'videos.json'))}`);
