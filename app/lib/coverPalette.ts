export type StagePalette = {
  primary: string;
  secondary: string;
};

const BRAND_TEAL: StagePalette = { primary: "#00f5d4", secondary: "#f4d28a" };
const BRAND_GOLD: StagePalette = { primary: "#f4d28a", secondary: "#00f5d4" };
const NEUTRAL: StagePalette = { primary: "#8fa8c2", secondary: "#f4d28a" };

const cache = new Map<string, StagePalette>();

/** 无封面时按曲目 id 稳定取品牌色，让不同曲目仍有不同氛围 */
export function brandPalette(seed?: string | null): StagePalette {
  if (!seed) return BRAND_TEAL;
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) % 1000003;
  }
  return hash % 2 === 0 ? BRAND_TEAL : BRAND_GOLD;
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;

  if (max === min) return [0, 0, l];

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
  else if (max === gn) h = ((bn - rn) / d + 2) / 6;
  else h = ((rn - gn) / d + 4) / 6;

  return [h * 360, s, l];
}

function hslToHex(h: number, s: number, l: number): string {
  const hue = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;

  if (hue < 60) [r, g, b] = [c, x, 0];
  else if (hue < 120) [r, g, b] = [x, c, 0];
  else if (hue < 180) [r, g, b] = [0, c, x];
  else if (hue < 240) [r, g, b] = [0, x, c];
  else if (hue < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];

  const toHex = (value: number) =>
    Math.round((value + m) * 255)
      .toString(16)
      .padStart(2, "0");

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/** 只保留中等明度 + 有饱和度的色相，避免封面上黑底/白字把色调拉脏 */
function tuneTone(h: number, s: number, l: number): string {
  return hslToHex(h, Math.min(0.78, Math.max(0.44, s)), Math.min(0.6, Math.max(0.45, l)));
}

function analyze(image: HTMLImageElement): StagePalette {
  const size = 36;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return NEUTRAL;

  try {
    ctx.drawImage(image, 0, 0, size, size);
    const data = ctx.getImageData(0, 0, size, size).data;
    const bins = Array.from({ length: 12 }, () => ({
      weight: 0,
      r: 0,
      g: 0,
      b: 0,
      hue: 0,
      sat: 0,
      lig: 0,
    }));
    let neutralWeight = 0;
    let neutralR = 0;
    let neutralG = 0;
    let neutralB = 0;

    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 90) continue;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const [h, s, l] = rgbToHsl(r, g, b);
      if (l < 0.07 || l > 0.95) continue;

      if (s < 0.16) {
        neutralWeight += 1;
        neutralR += r;
        neutralG += g;
        neutralB += b;
        continue;
      }

      // 越接近中等明度权重越高，避免极暗/极亮色主导
      const weight = s * (1 - Math.abs(l - 0.5) * 1.5);
      if (weight <= 0) continue;

      const index = Math.floor(h / 30) % 12;
      const bin = bins[index];
      bin.weight += weight;
      bin.r += r * weight;
      bin.g += g * weight;
      bin.b += b * weight;
      bin.hue += h * weight;
      bin.sat += s * weight;
      bin.lig += l * weight;
    }

    let best = bins[0];
    for (const bin of bins) {
      if (bin.weight > best.weight) best = bin;
    }

    if (best.weight < 40) {
      if (neutralWeight > 40) return NEUTRAL;
      return NEUTRAL;
    }

    const hue = best.hue / best.weight;
    const sat = best.sat / best.weight;
    const lig = best.lig / best.weight;
    const primary = tuneTone(hue, sat, lig);

    // 次主色：找到权重够高的另一个色相桶，否则按主色相偏移
    let second = bins.find(
      (bin) => Math.abs(bin.hue / Math.max(bin.weight, 1) - hue) > 25 && bin.weight > best.weight * 0.55,
    );

    let secondary: string;
    if (second && second.weight > 0) {
      secondary = tuneTone(second.hue / second.weight, second.sat / second.weight, second.lig / second.weight);
    } else {
      secondary = tuneTone(hue + 42, sat * 0.9, lig + 0.04);
    }

    return { primary, secondary };
  } catch {
    return NEUTRAL;
  }
}

/** 从封面取主色；无封面 / 读色失败时回落到品牌色。结果按 url 缓存。 */
export function coverPalette(url: string | null | undefined, seed?: string | null): Promise<StagePalette> {
  if (!url) return Promise.resolve(brandPalette(seed));

  const cached = cache.get(url);
  if (cached) return Promise.resolve(cached);

  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      const palette = analyze(image);
      cache.set(url, palette);
      resolve(palette);
    };
    image.onerror = () => resolve(brandPalette(seed));
    image.src = url;
  });
}
