import sharp from "sharp";

console.log("========== 3. PIXEL-LEVEL VERIFICATION: ic_launcher_foreground.png ==========\n");

const FILE = "assets/icons/adaptive/ic_launcher_foreground.png";
const img = sharp(FILE);
const meta = await img.metadata();
const raw = await img.raw().toBuffer();

const W = meta.width!;
const H = meta.height!;
const ch = meta.channels!;
console.log(`Image: ${FILE}`);
console.log(`Dimensions: ${W} x ${H} px`);
console.log(`Channels: ${ch} (${ch === 4 ? "RGBA" : ch === 3 ? "RGB" : "unknown"})`);
console.log(`Total pixels: ${W * H}`);
console.log(`Total bytes in raw buffer: ${raw.length} (expected ${W * H * ch})\n`);

// Bounding box of non-transparent pixels (alpha > threshold)
const ALPHA_THRESHOLD = 10;
let minX = W, maxX = -1, minY = H, maxY = -1;
let opaquePixels = 0;

let transparentPixels = 0;

// Also track alpha-channel value distribution
const alphaBuckets = { 0: 0, low: 0, mid: 0, high: 0, full: 0 };

for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const idx = (y * W + x) * ch;
    const a = raw[idx + 3];
    if (a === 0) { transparentPixels++; alphaBuckets[0]++; }
    else if (a < 64) { alphaBuckets.low++; }
    else if (a < 128) { alphaBuckets.mid++; }
    else if (a < 255) { alphaBuckets.high++; }
    else { alphaBuckets.full++; }

    if (a > ALPHA_THRESHOLD) {
      opaquePixels++;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    } else if (a > 0 && a <= ALPHA_THRESHOLD) {
      
    }
  }
}

const logoW = maxX - minX + 1;
const logoH = maxY - minY + 1;
const occupiedPct = (opaquePixels / (W * H)) * 100;

console.log(`--- Bounding box (alpha > ${ALPHA_THRESHOLD}) ---`);
console.log(`minX=${minX}  maxX=${maxX}  minY=${minY}  maxY=${maxY}`);
console.log(`bbox size: ${logoW} x ${logoH} px`);
console.log(`bbox top-left: (${minX}, ${minY})`);
console.log(`bbox bottom-right: (${maxX}, ${maxY})`);
console.log(`\n--- Margins ---`);
console.log(`Left margin:   ${minX} px`);
console.log(`Right margin:  ${W - maxX - 1} px`);
console.log(`Top margin:    ${minY} px`);
console.log(`Bottom margin: ${H - maxY - 1} px`);
console.log(`All margins equal? ${(minX === W-maxX-1 && minX === minY && minX === H-maxY-1) ? "YES (centered)" : "NO (asymmetric)"}`);

console.log(`\n--- Alpha distribution ---`);
console.log(`Fully transparent (alpha=0):     ${transparentPixels} px  (${(transparentPixels/(W*H)*100).toFixed(2)}%)`);
console.log(`alpha 1-63:                      ${alphaBuckets.low} px  (${(alphaBuckets.low/(W*H)*100).toFixed(2)}%)`);
console.log(`alpha 64-127:                    ${alphaBuckets.mid} px  (${(alphaBuckets.mid/(W*H)*100).toFixed(2)}%)`);
console.log(`alpha 128-254:                   ${alphaBuckets.high} px  (${(alphaBuckets.high/(W*H)*100).toFixed(2)}%)`);
console.log(`Fully opaque (alpha=255):        ${alphaBuckets.full} px  (${(alphaBuckets.full/(W*H)*100).toFixed(2)}%)`);
console.log(`\nOccupied (alpha > ${ALPHA_THRESHOLD}): ${opaquePixels} px  (${occupiedPct.toFixed(2)}% of canvas)`);

console.log(`\n--- Safe-zone compliance ---`);
console.log(`Logo width:    ${logoW} px`);
console.log(`Canvas width:  ${W} px`);
console.log(`Ratio:         ${logoW}/${W} = ${(logoW/W).toFixed(4)} = ${(logoW/W*100).toFixed(2)}%`);
console.log(`Android limit: 66/108 = ${(66/108).toFixed(4)} = ${(66/108*100).toFixed(2)}%`);
console.log(`Compliant?     ${logoW/W <= 66/108 ? "YES" : "NO — VIOLATION"}`);

console.log(`\n========== 4. PIXEL-LEVEL VERIFICATION: ic_notification.png ==========\n`);

const NFILE = "assets/icons/android/ic_notification.png";
const nimg = sharp(NFILE);
const nmeta = await nimg.metadata();
const nraw = await nimg.raw().toBuffer();

const NW = nmeta.width!;
const NH = nmeta.height!;
const NCH = nmeta.channels!;
console.log(`Image: ${NFILE}`);
console.log(`Dimensions: ${NW} x ${NH} px`);
console.log(`Channels: ${NCH} (${NCH === 4 ? "RGBA" : NCH === 3 ? "RGB" : "unknown"})\n`);

let transparent = 0, white = 0, nonWhiteColored = 0, semi = 0;
let rgbMismatch = 0; // count pixels where R != G || G != B (and alpha > 0)
let maxR = 0, minR = 255, maxG = 0, minG = 255, maxB = 0, minB = 255;

for (let i = 0; i < nraw.length; i += NCH) {
  const r = nraw[i];
  const g = nraw[i + 1];
  const b = nraw[i + 2];
  const a = NCH === 4 ? nraw[i + 3] : 255;

  if (a === 0) {
    transparent++;
    continue;
  }
  if (a < 255) semi++;
  if (r > 240 && g > 240 && b > 240) {
    white++;
  } else {
    nonWhiteColored++;
  }
  if (a > 0) {
    if (r !== g || g !== b) rgbMismatch++;
    if (r > maxR) maxR = r; if (r < minR) minR = r;
    if (g > maxG) maxG = g; if (g < minG) minG = g;
    if (b > maxB) maxB = b; if (b < minB) minB = b;
  }
}

const total = NW * NH;
console.log(`Total pixels: ${total}`);
console.log(`\nPixel classification:`);
console.log(`  Fully transparent (alpha=0):    ${transparent}  (${(transparent/total*100).toFixed(2)}%)`);
console.log(`  Pure white (r,g,b > 240):       ${white}  (${(white/total*100).toFixed(2)}%)`);
console.log(`  Non-white colored:              ${nonWhiteColored}  (${(nonWhiteColored/total*100).toFixed(2)}%)`);
console.log(`  Semi-transparent (0<a<255):     ${semi}  (${(semi/total*100).toFixed(2)}%)`);

console.log(`\nMonochrome proof (where alpha > 0):`);
console.log(`  RGB-channel mismatches (R!=G || G!=B): ${rgbMismatch}`);
console.log(`  R range: ${minR}-${maxR}`);
console.log(`  G range: ${minG}-${maxG}`);
console.log(`  B range: ${minB}-${maxB}`);

console.log(`\nVerdict:`);
console.log(`  Colored pixels == 0?         ${nonWhiteColored === 0 ? "YES" : "NO"}`);
console.log(`  RGB channels identical?      ${rgbMismatch === 0 ? "YES (true grayscale/alpha mask)" : "NO"}`);
console.log(`  Is monochrome alpha mask?     ${nonWhiteColored === 0 && rgbMismatch === 0 ? "YES — Android-compliant" : "NO — NOT a valid notification icon"}`);
