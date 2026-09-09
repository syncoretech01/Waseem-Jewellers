/**
 * Single source of truth for every localised asset.
 * - IMAGES: Shopify CDN originals → public/assets/waseem/images/**.webp (+ blur placeholder, dimensions)
 * - VIDEOS: trimmed, muted encodes of the supplied campaign films → public/assets/waseem/video/**
 * - STILLS: frames lifted from the encoded clips, treated as images
 *
 * `derive.crop` = [x, y, w, h] fractions of the source. `focal` = [x, y] fractions used for object-position.
 * Roles decide the size ceiling (packshot/macro: displayed ≤ width/2; campaign/world/heritage: ≤ width).
 */
export const CDN = 'https://cdn.shopify.com/s/files/1/0802/0023/7373/files/';
export const SHOP = 'https://www.waseemjewellers.com/cdn/shop/';
export const SHOPIFY_HERO_VIDEO = 'https://cdn.shopify.com/videos/c/o/v/f5f0abccc59440849c44265ebc76c94a.mp4';

const P = (slug, name) => `images/products/${slug}/${name}`;

export const IMAGES = [
  // ── p01 Royal Wedding · Polki Raani Haar (1080px sources; campaign only) ──
  { id: 'p01-hero', source: CDN + '015.jpg', out: P('royal-wedding-polki-raani-haar', 'hero'), role: 'campaign', maxWidth: 1080, focal: [0.5, 0.42], alt: 'Royal Wedding polki raani haar with choker, tikka and chandbali earrings, worn by candlelight' },
  { id: 'p01-second', source: CDN + '0112_a75d28ab-27e6-461b-803c-1443acc523b5.png', out: P('royal-wedding-polki-raani-haar', 'second'), role: 'campaign', maxWidth: 960, focal: [0.5, 0.45], alt: 'Royal Wedding polki choker among white feathers' },
  { id: 'p01-third', source: CDN + '0122.jpg', out: P('royal-wedding-polki-raani-haar', 'third'), role: 'campaign', maxWidth: 1080, focal: [0.5, 0.4], alt: 'Royal Wedding meenakari and polki choker with matching earrings' },

  // ── p02 Rukh-e-Jana · Pleated Gold Collar (1080px sources) ──
  { id: 'p02-hero', source: CDN + '01_ff1bf12f-29c2-4552-9211-7f275931a00e.jpg', out: P('rukh-e-jana-pleated-collar', 'hero'), role: 'campaign', maxWidth: 1080, focal: [0.5, 0.45], alt: 'Rukh-e-Jana pleated gold collar with a kundan leaf drop, worn in velvet by candlelight' },
  { id: 'p02-second', source: CDN + '0114_a9a56bc5-17c7-4f7f-a071-1071bdce3a86.png', out: P('rukh-e-jana-pleated-collar', 'second'), role: 'campaign', maxWidth: 960, focal: [0.5, 0.45], alt: 'Rukh-e-Jana gold necklace and earrings' },
  { id: 'p02-third', source: CDN + '02_808c3058-3b4d-4452-bbb1-0733b211b6e9.jpg', out: P('rukh-e-jana-pleated-collar', 'third'), role: 'campaign', maxWidth: 1080, focal: [0.5, 0.42], alt: 'Rukh-e-Jana rose pavé bib necklace against burgundy velvet' },

  // ── p03 Naqsh-e-Gul · Pearl Blossom Choker (4500px) ──
  { id: 'p03-hero', source: CDN + '01-min.jpg', out: P('naqsh-e-gul-pearl-blossom-choker', 'hero'), role: 'campaign', maxWidth: 2880, focal: [0.5, 0.38], alt: 'Naqsh-e-Gul white diamond floral choker with pearls, worn in red against a backlit jali' },
  { id: 'p03-macro', source: CDN + '01-min.jpg', out: P('naqsh-e-gul-pearl-blossom-choker', 'macro'), role: 'macro', maxWidth: 2000, derive: { crop: [0.26, 0.5, 0.48, 0.36] }, focal: [0.5, 0.5], alt: 'Detail of the Naqsh-e-Gul pearl blossom choker' },
  { id: 'p03-detail', source: CDN + '01-min.jpg', out: P('naqsh-e-gul-pearl-blossom-choker', 'detail'), role: 'macro', maxWidth: 2000, derive: { crop: [0.18, 0.22, 0.34, 0.42] }, focal: [0.5, 0.5], alt: 'Naqsh-e-Gul earring detail' },

  // ── p04 Dewan · Bridal Suite (2250px) ──
  { id: 'p04-hero', source: CDN + '013-min_44e2e12c-cc42-4ccd-8ad0-d08fa67d6e4c.jpg', out: P('dewan-bridal-suite', 'hero'), role: 'campaign', maxWidth: 2250, focal: [0.5, 0.4], alt: 'Dewan bridal suite: gold and diamond choker, long haar with medallion, nath and tikka' },
  { id: 'p04-macro', source: CDN + '013-min_44e2e12c-cc42-4ccd-8ad0-d08fa67d6e4c.jpg', out: P('dewan-bridal-suite', 'macro'), role: 'macro', maxWidth: 2000, derive: { crop: [0.22, 0.46, 0.56, 0.42] }, focal: [0.5, 0.5], alt: 'Detail of the Dewan bridal suite haar and choker' },

  // ── p05 Aks-e-Noor · Satlada Haar (2250px) ──
  { id: 'p05-hero', source: CDN + '016_747399c5-fe73-4701-a27b-4e9db9392523.jpg', out: P('aks-e-noor-satlada-haar', 'hero'), role: 'campaign', maxWidth: 2250, focal: [0.5, 0.42], alt: 'Aks-e-Noor filigree choker and five-strand satlada haar, worn in dark green velvet before a gold jali' },
  { id: 'p05-macro', source: CDN + '016_747399c5-fe73-4701-a27b-4e9db9392523.jpg', out: P('aks-e-noor-satlada-haar', 'macro'), role: 'macro', maxWidth: 2000, derive: { crop: [0.2, 0.44, 0.6, 0.5] }, focal: [0.5, 0.5], alt: 'Detail of the Aks-e-Noor satlada strands' },
  { id: 'p05-second', source: CDN + '01_ef09742c-f3bb-453e-baa7-7bfbb986ebb3.jpg', out: P('aks-e-noor-satlada-haar', 'second'), role: 'campaign', maxWidth: 2250, focal: [0.5, 0.42], alt: 'Aks-e-Noor gold and diamond choker with ruby drops' },

  // ── p06 Rang-e-Jamal · Emerald & Diamond Suite (4000px) ──
  { id: 'p06-hero', source: CDN + '0110_8257549b-96b7-4d9a-9297-6750a0dfe2a8.jpg', out: P('rang-e-jamal-emerald-suite', 'hero'), role: 'campaign', maxWidth: 2880, focal: [0.5, 0.4], alt: 'Rang-e-Jamal emerald and diamond choker with a seven-strand haar and tikka, on ivory' },
  { id: 'p06-macro', source: CDN + '0110_8257549b-96b7-4d9a-9297-6750a0dfe2a8.jpg', out: P('rang-e-jamal-emerald-suite', 'macro'), role: 'macro', maxWidth: 2000, derive: { crop: [0.24, 0.46, 0.52, 0.4] }, focal: [0.5, 0.5], alt: 'Detail of the Rang-e-Jamal emerald and diamond suite' },
  { id: 'p06-second', source: CDN + '02.jpg', out: P('rang-e-jamal-emerald-suite', 'second'), role: 'campaign', maxWidth: 1080, focal: [0.5, 0.42], alt: 'Rang-e-Jamal floral pavé choker' },

  // ── p07 Sapphire Pendant Suite (4000px, real specs) ──
  { id: 'p07-hero', source: CDN + '015_8f0c82d6-62ec-4209-b45d-90731022b958.jpg', out: P('diamond-bridal-sapphire-suite', 'hero'), role: 'campaign', maxWidth: 2880, focal: [0.5, 0.42], alt: 'Diamond necklace with a sapphire pendant and chandelier earrings, on ivory drape' },
  { id: 'p07-macro', source: CDN + '015_8f0c82d6-62ec-4209-b45d-90731022b958.jpg', out: P('diamond-bridal-sapphire-suite', 'macro'), role: 'macro', maxWidth: 2000, derive: { crop: [0.28, 0.5, 0.44, 0.4] }, focal: [0.5, 0.5], alt: 'Detail of the sapphire pendant and pavé setting' },
  { id: 'p07-detail', source: CDN + '015_8f0c82d6-62ec-4209-b45d-90731022b958.jpg', out: P('diamond-bridal-sapphire-suite', 'detail'), role: 'macro', maxWidth: 2000, derive: { crop: [0.12, 0.2, 0.36, 0.44] }, focal: [0.5, 0.5], alt: 'Chandelier earring of the sapphire suite' },

  // ── p08 Emerald Tassel Earrings T06768 (packshot 2000px) ──
  { id: 'p08-hero', source: CDN + '0126.png', out: P('emerald-tassel-earrings-t06768', 'hero'), role: 'packshot', maxWidth: 2000, focal: [0.5, 0.5], alt: 'Emerald and diamond tassel earrings in gold, reference T06768' },
  { id: 'p08-macro', source: CDN + '0126.png', out: P('emerald-tassel-earrings-t06768', 'macro'), role: 'packshot', maxWidth: 2000, derive: { crop: [0.25, 0.1, 0.5, 0.6] }, focal: [0.5, 0.5], alt: 'Detail of the emerald tassel earrings' },

  // ── p09 Lavender Halo Ring R11912 (packshot 2000px, two angles) ──
  { id: 'p09-hero', source: CDN + '0175.png', out: P('lavender-halo-ring-r11912', 'hero'), role: 'packshot', maxWidth: 2000, focal: [0.5, 0.5], alt: 'Rose-gold ring with an oval lavender stone and a diamond halo, reference R11912' },
  { id: 'p09-second', source: CDN + '0174.png', out: P('lavender-halo-ring-r11912', 'second'), role: 'packshot', maxWidth: 2000, focal: [0.5, 0.5], alt: 'Second angle of the lavender halo ring' },
  { id: 'p09-macro', source: CDN + '0175.png', out: P('lavender-halo-ring-r11912', 'macro'), role: 'packshot', maxWidth: 2000, derive: { crop: [0.25, 0.15, 0.5, 0.5] }, focal: [0.5, 0.5], alt: 'Detail of the lavender halo ring' },

  // ── p10 Feathered Cluster Ring (2250px, styled macro) ──
  { id: 'p10-hero', source: CDN + 'Dioman-ring_5916d888-f5fc-41c0-a0a3-95c9aa84ac4a.jpg', out: P('timeless-feathered-cluster-ring', 'hero'), role: 'campaign', maxWidth: 2250, focal: [0.5, 0.52], alt: 'Diamond cluster ring resting on white feathers' },
  { id: 'p10-macro', source: CDN + 'Dioman-ring_5916d888-f5fc-41c0-a0a3-95c9aa84ac4a.jpg', out: P('timeless-feathered-cluster-ring', 'macro'), role: 'macro', maxWidth: 2000, derive: { crop: [0.23, 0.24, 0.56, 0.56] }, focal: [0.5, 0.5], alt: 'Detail of the diamond cluster' },

  // ── World column tiles not covered above ──
  { id: 'w-rukh-3', source: CDN + '0113_0197ffc1-b25a-4c0e-aeaf-bdaca50f54b8.png', out: 'images/worlds/rukh-e-jana-3', role: 'world', maxWidth: 960, focal: [0.5, 0.4], alt: 'Rukh-e-Jana diamond and sapphire fringe necklace on black velvet' },
  { id: 'w-aks-3', source: CDN + '0128_1056729b-2801-4566-af63-0a80e50f7f09.png', out: 'images/worlds/aks-e-noor-3', role: 'world', maxWidth: 960, focal: [0.5, 0.42], alt: 'Aks-e-Noor layered gold floral necklace before carved wood' },
  { id: 'w-rang-3', source: CDN + '019_2e7484b6-fdc4-4283-bf3e-9c78a4f8eb22.jpg', out: 'images/worlds/rang-e-jamal-3', role: 'world', maxWidth: 2250, focal: [0.5, 0.4], alt: 'Rang-e-Jamal gold bridal set with emerald accents' },
  { id: 'w-dewan-1', source: CDN + '01-min_28100b31-8118-4c52-8bd1-8bf6c3205c78.jpg', out: 'images/worlds/dewan-1', role: 'world', maxWidth: 2250, focal: [0.5, 0.4], alt: 'Dewan rose-gold and pearl choker in lilac light' },
  { id: 'w-dewan-3', source: CDN + '012-min_0aa20a2a-484f-405a-b373-2d8cff96b09f.jpg', out: 'images/worlds/dewan-3', role: 'world', maxWidth: 2250, focal: [0.5, 0.4], alt: 'Dewan bridal jewellery in lilac haze' },

  // ── Wall, bespoke and interlude campaign images ──
  { id: 'wall-campaign', source: CDN + '012-min.jpg', out: 'images/campaign/naqsh-e-gul-portrait', role: 'campaign', maxWidth: 2880, focal: [0.5, 0.35], alt: 'Naqsh-e-Gul campaign portrait before a backlit lattice' },
  { id: 'bespoke-bride', source: CDN + '017-min_7eeae0d6-6afa-4f9c-b43b-7fb276a812a3.jpg', out: 'images/campaign/dewan-bride', role: 'campaign', maxWidth: 2250, focal: [0.5, 0.38], alt: 'Bride wearing the Dewan suite' },
  { id: 'bespoke-stone', source: CDN + '015_8f0c82d6-62ec-4209-b45d-90731022b958.jpg', out: 'images/campaign/stone', role: 'macro', maxWidth: 1600, derive: { crop: [0.34, 0.54, 0.32, 0.32] }, focal: [0.5, 0.5], alt: 'A single sapphire in its diamond setting' },
  { id: 'bespoke-form', source: CDN + '0174.png', out: 'images/campaign/form', role: 'packshot', maxWidth: 1600, focal: [0.5, 0.5], alt: 'The lavender halo ring, second angle' },

  // ── Heritage (honest fragments; no faked age) ──
  { id: 'heritage-facade', source: SHOP + 'files/Building-Footer_0b8b8c61-e029-4c73-9850-f60d30689ac1.png', out: 'images/heritage/facade', role: 'heritage', maxWidth: 1400, derive: { crop: [0, 0, 0.58, 1] }, focal: [0.5, 0.5], alt: 'The Waseem Jewellers showroom facade at night', formats: ['webp', 'jpg'] },
  { id: 'heritage-vitrine', source: SHOP + 'files/breadcrumb-bg.jpg', out: 'images/heritage/vitrine', role: 'heritage', maxWidth: 1500, derive: { crop: [0, 0.12, 1, 0.66] }, focal: [0.5, 0.5], alt: 'Gold bangles and rings on black stands in the showroom vitrine' },
  { id: 'heritage-kundan', source: CDN + '0115_7d3a60f8-9401-4132-8927-c3c47c070a8d.jpg', out: 'images/heritage/kundan', role: 'macro', maxWidth: 1600, derive: { crop: [0.24, 0.44, 0.52, 0.52] }, focal: [0.5, 0.5], alt: 'Gold kundan choker detail' },
  { id: 'heritage-portrait', source: CDN + '01_d6ac3aed-a529-4414-8a49-782a96c0464a.jpg', out: 'images/heritage/portrait', role: 'campaign', maxWidth: 2250, focal: [0.5, 0.36], alt: 'Antique-gold beaded choker with a peacock pendant, worn before a white fan' },

  // ── Brand ──
];

/** Trims are input-side (-ss then -t). `portraitX` = left edge (px, at 1280 wide) of the 404×720 portrait window. */
export const VIDEOS = [
  // no fadeEdges on the hero: the loading curtain is the entrance, and a faded head would dip the loop to black every 31s
  { id: 'hero-royal', input: 'media-originals/royal-wedding.mp4', start: 5, end: 36, poster: 13, subject: [0.5, 0.35], portraitX: 438, label: 'Hero (CH01), menu BRIDAL' },
  { id: 'bridal-cinema', input: 'media-originals/naqsh-e-gul.mp4', start: 6, end: 40, poster: 26, subject: [0.5, 0.32], portraitX: 438, label: 'Bridal cinema (CH05)' },
  { id: 'bridal-opening', input: 'media-originals/naqsh-e-gul.mp4', start: 40, end: 52, poster: 46, subject: [0.5, 0.3], portraitX: 438, label: '/collections/bridal opening + chapter II interlude' },
  // ambient only: 40% opacity behind a brightness filter and a tint, so it stays cheap on every tier
  { id: 'menu-ambient', input: 'media-originals/dewaan.mp4', start: 4, end: 30, poster: 13, crf1280: 27, crf720: 30, crfPortrait: 31, subject: [0.5, 0.4], portraitX: 438, cropWatermark: true, label: 'Menu ambient, DEWAN world' },
  // 1920×742 source: scale by height so the desktop encode keeps the vertical resolution CH08 needs
  { id: 'diamond-studio', input: '.cache/assets/shopify-hero.mp4', remote: SHOPIFY_HERO_VIDEO, start: 0, end: 20.3, poster: 13, scale1280: '-2:720', crf1280: 22, subject: [0.5, 0.4], portraitX: 758, label: 'CH08 diamond side, menu DIAMOND' },
];

/** Frames lifted from the ORIGINAL sources (seconds are absolute in the source). */
export const STILLS = [
  { id: 'still-royal-13', video: 'media-originals/royal-wedding.mp4', at: 13, out: 'images/stills/royal-13', role: 'still', maxWidth: 1280, focal: [0.5, 0.4], alt: 'Candlelit table with a gold candelabra from the Royal Wedding film' },
  { id: 'still-royal-61', video: 'media-originals/royal-wedding.mp4', at: 61, out: 'images/stills/royal-61', role: 'still', maxWidth: 1280, derive: { crop: [0.2, 0.05, 0.6, 0.9] }, focal: [0.5, 0.5], alt: 'Gold and polki necklace with pearl, macro' },
  { id: 'still-royal-66', video: 'media-originals/royal-wedding.mp4', at: 66, out: 'images/stills/royal-66', role: 'still', maxWidth: 1280, focal: [0.5, 0.5], alt: 'Gold polki necklace with pearl drop, macro from the Royal Wedding film' },
  { id: 'still-naqsh-7', video: 'media-originals/naqsh-e-gul.mp4', at: 7, out: 'images/stills/naqsh-7', role: 'still', maxWidth: 1280, focal: [0.5, 0.5], alt: 'Hands and gold bangles in lattice light' },
  { id: 'still-dewaan-13', video: 'media-originals/dewaan.mp4', at: 13, out: 'images/stills/dewaan-13', role: 'still', maxWidth: 1280, derive: { crop: [0, 0.1, 0.86, 0.9] }, focal: [0.5, 0.5], alt: 'Rose-gold pearl choker macro from the Dewan film' },
  { id: 'still-dewaan-26', video: 'media-originals/dewaan.mp4', at: 26, out: 'images/stills/dewaan-26', role: 'still', maxWidth: 1280, derive: { crop: [0, 0.1, 0.86, 0.9] }, focal: [0.5, 0.5], alt: 'A hand wearing diamond rings, from the Dewan film' },
  { id: 'still-shopify-13', video: '.cache/assets/shopify-hero.mp4', at: 13, out: 'images/stills/studio-13', role: 'still', maxWidth: 1920, focal: [0.5, 0.5], alt: 'Emerald and diamond necklace in the studio film' },
];
