/* eslint-disable no-console */
// Generates every brand asset from ONE source of truth: assets/logo.png,
// the coral pen-and-scales mark. Re-run with:
//
//     node scripts/generate-brand-assets.js
//
// The mark the app wears everywhere else is the SEAL — that mark set in a
// navy disc inside a brass ring, on cream paper. It is what BootScreen
// draws while a session is being checked, and what chambers pointed at
// when they said "the other logo should come for app icon": the launcher
// used to carry the bare glyph, small, on navy, so the icon and the screen
// it opens into looked like two different products.
//
// This script draws that seal at the size each surface needs, in the same
// proportions BootScreen uses, so all of them stay in step:
//
//   ring stroke   = 2.42% of the outer diameter   (3 / 124)
//   inner hairline= 88.7% of it, 0.81% stroke     (110 / 124, 1 / 124)
//   glyph height  = 59.7% of it                   (74 / 124)
//
// A note on sizes. Android crops an adaptive icon to a circle of about 61%
// of the canvas — anything outside that is at the launcher's mercy — so
// the adaptive seal is deliberately smaller than the iOS one. The splash
// leaves room for Android 12's own circular mask on the same reasoning.

const sharp = require("sharp");
const path = require("path");
const fs = require("fs");

const INK = "#0e1a2b"; // seal wax
const BRASS = "#b68b3c"; // ring
const BRASS_DEEP = "#8e6a24"; // hairline inside it
const CREAM = "#f4ecda"; // the paper it's pressed on

const ASSETS = path.join(__dirname, "..", "assets");
const LOGO = path.join(ASSETS, "logo.png");

const CORAL = { r: 241, g: 103, b: 77 }; // the mark's own colour

// logo.png is cropped tight to its ink, so the glyph is only ever scaled
// by height and left to keep its own aspect ratio — nothing here assumes
// what shape the mark is.
//
// It does, however, carry a near-white haze across its whole canvas at
// alpha 5-12 — invisible on white, a pale rectangle over navy, which is
// exactly what the old icon showed behind the mark. Since the mark is a
// single flat colour, the honest fix is to repaint it: drop everything
// below the haze, then set every surviving pixel to one colour and keep
// only its alpha. Done at full resolution, so the resize afterwards only
// ever blends clean edges.
const HAZE_ALPHA = 24;

async function flatGlyph({ height, color }) {
  const { data, info } = await sharp(LOGO)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  for (let i = 0; i < data.length; i += info.channels) {
    const a = data[i + 3];
    if (a < HAZE_ALPHA) {
      data[i + 3] = 0;
      continue;
    }
    data[i] = color.r;
    data[i + 1] = color.g;
    data[i + 2] = color.b;
  }

  return sharp(data, {
    raw: { width: info.width, height: info.height, channels: info.channels },
  })
    .resize({ height, fit: "contain" })
    .png()
    .toBuffer();
}

/** The seal as an SVG string: disc, ring, hairline. The glyph is
 *  composited on top afterwards — it's a raster, not a path. */
function sealSvg({ canvas, diameter, background }) {
  const c = canvas / 2;
  const r = diameter / 2;
  const ringStroke = diameter * 0.0242;
  const hairR = (diameter * 0.8871) / 2;
  const hairStroke = Math.max(1, diameter * 0.0081);
  const ground = background
    ? `<rect width="${canvas}" height="${canvas}" fill="${background}"/>`
    : "";
  return Buffer.from(`
<svg width="${canvas}" height="${canvas}" xmlns="http://www.w3.org/2000/svg">
  ${ground}
  <circle cx="${c}" cy="${c}" r="${r - ringStroke / 2}" fill="${INK}"
          stroke="${BRASS}" stroke-width="${ringStroke}"/>
  <circle cx="${c}" cy="${c}" r="${hairR - hairStroke / 2}" fill="none"
          stroke="${BRASS_DEEP}" stroke-width="${hairStroke}" opacity="0.85"/>
</svg>`);
}

/** Seal + glyph, centred, at `diameter` on a `canvas`-square image. */
async function seal({ canvas, diameter, background }) {
  const glyph = await flatGlyph({
    height: Math.round(diameter * 0.597),
    color: CORAL,
  });
  const { width: gw, height: gh } = await sharp(glyph).metadata();

  return sharp(sealSvg({ canvas, diameter, background }))
    .composite([
      {
        input: glyph,
        left: Math.round((canvas - gw) / 2),
        top: Math.round((canvas - gh) / 2),
      },
    ])
    .png();
}

/**
 * Android reads a status-bar icon's ALPHA CHANNEL ONLY and tints the
 * silhouette with the colour from app.json. Anything carrying colour of
 * its own renders as a plain grey square. So: the glyph's shape, painted
 * white, on transparent — nothing else, no seal, no ring.
 */
async function notificationIcon({ canvas, glyphHeight }) {
  const white = await flatGlyph({
    height: glyphHeight,
    color: { r: 255, g: 255, b: 255 },
  });
  const info = await sharp(white).metadata();

  return sharp({
    create: {
      width: canvas,
      height: canvas,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([
      {
        input: white,
        left: Math.round((canvas - info.width) / 2),
        top: Math.round((canvas - info.height) / 2),
      },
    ])
    .png();
}

async function run() {
  if (!fs.existsSync(LOGO)) {
    throw new Error(`assets/logo.png is missing — it is the source mark.`);
  }

  // App icon (iOS, Play listing, Expo Go). Cream ground, generous seal.
  // Flattened and stripped of alpha: iOS rejects an icon with one.
  await (await seal({ canvas: 1024, diameter: 840, background: CREAM }))
    .flatten({ background: CREAM })
    .removeAlpha()
    .toFile(path.join(ASSETS, "icon.png"));

  // Android adaptive foreground. Transparent — the cream comes from
  // app.json's adaptiveIcon.backgroundColor — and small enough that the
  // whole ring clears the ~626px circle every launcher mask keeps.
  await (await seal({ canvas: 1024, diameter: 620 })).toFile(
    path.join(ASSETS, "adaptive-icon.png")
  );

  // Native splash. Transparent so it composites on the cream splash
  // background, and inside Android 12's circular splash mask.
  await (await seal({ canvas: 1024, diameter: 672 })).toFile(
    path.join(ASSETS, "splash-icon.png")
  );

  // Web favicon — the icon, small.
  await sharp(path.join(ASSETS, "icon.png"))
    .resize(48, 48)
    .png()
    .toFile(path.join(ASSETS, "favicon.png"));

  // Status-bar notification icon.
  await (await notificationIcon({ canvas: 96, glyphHeight: 70 })).toFile(
    path.join(ASSETS, "notification-icon.png")
  );

  console.log(
    "brand assets written from logo.png: icon, adaptive-icon, splash-icon, favicon, notification-icon"
  );
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
