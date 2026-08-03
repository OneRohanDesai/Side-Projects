/** Extract a soft accent from a playlist cover via canvas (client-side only). */

export type Atmosphere = {
  accent: string;
  soft: string;
  deep: string;
  glow: string;
};

const FALLBACK: Atmosphere = {
  accent: "#c4a574",
  soft: "rgba(196, 165, 116, 0.18)",
  deep: "#0c0b0a",
  glow: "rgba(196, 165, 116, 0.35)",
};

function clamp(n: number, min = 0, max = 255) {
  return Math.max(min, Math.min(max, n));
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      default:
        h = ((r - g) / d + 4) / 6;
    }
  }
  return [h * 360, s * 100, l * 100];
}

function hslToCss(h: number, s: number, l: number, a = 1): string {
  return a < 1
    ? `hsla(${Math.round(h)}, ${Math.round(s)}%, ${Math.round(l)}%, ${a})`
    : `hsl(${Math.round(h)}, ${Math.round(s)}%, ${Math.round(l)}%)`;
}

export async function extractAtmosphere(imageUrl: string | null): Promise<Atmosphere> {
  if (!imageUrl) return FALLBACK;

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const size = 32;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) {
          resolve(FALLBACK);
          return;
        }
        ctx.drawImage(img, 0, 0, size, size);
        const { data } = ctx.getImageData(0, 0, size, size);

        let r = 0;
        let g = 0;
        let b = 0;
        let count = 0;
        // Weighted toward more saturated pixels
        for (let i = 0; i < data.length; i += 4) {
          const pr = data[i]!;
          const pg = data[i + 1]!;
          const pb = data[i + 2]!;
          const [, s, l] = rgbToHsl(pr, pg, pb);
          if (l < 8 || l > 92 || s < 12) continue;
          const w = s / 100;
          r += pr * w;
          g += pg * w;
          b += pb * w;
          count += w;
        }

        if (count < 1) {
          // fallback average
          for (let i = 0; i < data.length; i += 4) {
            r += data[i]!;
            g += data[i + 1]!;
            b += data[i + 2]!;
            count++;
          }
        }

        r = clamp(r / count);
        g = clamp(g / count);
        b = clamp(b / count);
        const [h, s] = rgbToHsl(r, g, b);

        resolve({
          accent: hslToCss(h, Math.min(70, Math.max(35, s)), 62),
          soft: hslToCss(h, Math.min(55, s), 50, 0.16),
          deep: hslToCss(h, 30, 6),
          glow: hslToCss(h, Math.min(65, s), 55, 0.4),
        });
      } catch {
        resolve(FALLBACK);
      }
    };
    img.onerror = () => resolve(FALLBACK);
    // Spotify CDN allows CORS for images in most cases; if not, fallback
    img.src = imageUrl;
  });
}

export { FALLBACK as DEFAULT_ATMOSPHERE };
