#!/usr/bin/env node
/**
 * Encodes the campaign films into web clips: 1280 landscape, 720 landscape, 404×720 portrait,
 * plus poster frames. Trims are input-side (-ss, then -t duration). Muted, faststart, yuv420p.
 * Writes .cache/videos.json for the image localiser to merge into the asset map.
 *
 * Every variant is encoded twice: h264, which everything plays, and AV1 (SVT-AV1), which
 * every current Chrome, Firefox, Edge and Safari 17+ prefers when offered first and which
 * comes in at roughly half the bytes for the same quality. The browser chooses — a `<source>`
 * with an AV1 codec string ahead of the h264 one — so a device that cannot decode AV1 never
 * downloads it. On disk the total goes up; per visit it goes down by close to half, and the
 * per-visit figure is the one a visitor pays.
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { VIDEOS } from './manifest.mjs';
import { ROOT, PUBLIC, CACHE, ensureDir, run, ffprobe, fetchCached, fmtBytes, rel } from './lib.mjs';

const OUT = path.join(PUBLIC, 'video');
ensureDir(OUT);
ensureDir(CACHE);

/** The line PERFORMANCE_BUDGET.md draws. It was 42 MB here while the document said 25 — the message lied. */
const BUDGET_BYTES = 25 * 1024 * 1024;
const results = [];
let total = 0;
let totalAv1 = 0;

const BASE_ARGS = ['-y', '-hide_banner', '-loglevel', 'error'];
const CODEC_ARGS = ['-c:v', 'libx264', '-preset', 'slow', '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-level', '4.1', '-g', '50', '-movflags', '+faststart'];
/**
 * SVT-AV1 preset 6 is the speed/quality knee for short clips. Its CRF is read on a different
 * scale from x264, and the first pass here got the offset wrong: at 32/36/37 the 1280 tier came
 * in 29–48% smaller, and the 720 and portrait tiers came in *larger* than the h264 files beside
 * them — the small tiers were already encoded hard (x264 CRF 27–28), and AV1 needs to be
 * pushed correspondingly further to beat them. The values below are the second pass, measured.
 * 10-bit is deliberately not used: it decodes on fewer devices and buys nothing for content
 * this bright.
 */
const AV1_ARGS = ['-c:v', 'libsvtav1', '-preset', '6', '-pix_fmt', 'yuv420p', '-g', '50', '-svtav1-params', 'tune=0', '-movflags', '+faststart'];
const AV1_CRF = { 1280: 38, 720: 45, portrait: 46 };

/** A re-run after retuning: the h264 files are deterministic and already on disk. */
const ONLY_AV1 = process.env.ONLY_AV1 === '1';

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

  // the 1280 tier is what a desktop plays full-screen, so it is encoded for that; 720 and portrait keep the mobile budget
  const variants = [
    { name: '1280', vf: `${pre}scale=${v.scale1280 ?? '1280:-2'}${fade},format=yuv420p`, crf: String(v.crf1280 ?? 21) },
    { name: '720', vf: `${pre}scale=720:-2${fade},format=yuv420p`, crf: String(v.crf720 ?? 27) },
    { name: 'portrait', vf: `${pre}scale=-2:${portraitH},crop=404:${portraitH}:${v.portraitX}:0${fade},format=yuv420p`, crf: String(v.crfPortrait ?? 28) },
  ];

  const entry = { id: v.id, label: v.label, subject: v.subject, duration, files: {} };
  for (const variant of variants) {
    const file = path.join(OUT, `${v.id}-${variant.name}.mp4`);
    if (ONLY_AV1 && fs.existsSync(file)) console.log(`keeping ${path.basename(file)}`);
    else {
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
    }
    const info = await ffprobe(file);
    if (Math.abs(info.duration - duration) > 0.25) throw new Error(`${file}: duration ${info.duration} ≠ ${duration}`);
    if (info.width % 2 || info.height % 2) throw new Error(`${file}: odd dimensions ${info.width}×${info.height}`);
    total += info.size;
    entry.files[variant.name] = { path: file, src: `/assets/waseem/video/${path.basename(file)}`, width: info.width, height: info.height, bytes: info.size };
    console.log(`  ${path.basename(file)} ${info.width}×${info.height} ${fmtBytes(info.size)}`);

    // the AV1 sibling, same frames, same trim, same fade
    const av1 = path.join(OUT, `${v.id}-${variant.name}.av1.mp4`);
    console.log(`encoding ${v.id} ${variant.name} av1…`);
    await run('ffmpeg', [...BASE_ARGS, '-ss', String(v.start), '-i', input, '-t', String(duration), '-an', '-vf', variant.vf, ...AV1_ARGS.slice(0, 4), '-crf', String(AV1_CRF[variant.name]), ...AV1_ARGS.slice(4), av1]);
    const av1Info = await ffprobe(av1);
    if (Math.abs(av1Info.duration - duration) > 0.25) throw new Error(`${av1}: duration ${av1Info.duration} ≠ ${duration}`);
    totalAv1 += av1Info.size;
    entry.files[variant.name].srcAv1 = `/assets/waseem/video/${path.basename(av1)}`;
    entry.files[variant.name].bytesAv1 = av1Info.size;
    console.log(`  ${path.basename(av1)} ${fmtBytes(av1Info.size)}  (${Math.round((1 - av1Info.size / info.size) * 100)}% smaller)`);
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
console.log(`\nh264 total ${fmtBytes(total)} · av1 total ${fmtBytes(totalAv1)} · a visit downloads one variant of one codec`);
console.log(`h264 on disk ${total <= BUDGET_BYTES ? 'within' : 'OVER'} the 25 MB line; av1 ${totalAv1 <= BUDGET_BYTES ? 'within' : 'OVER'}, and ${Math.round((1 - totalAv1 / total) * 100)}% smaller for the same clips`);
console.log(`wrote ${rel(path.join(CACHE, 'videos.json'))}`);
