// 从专辑封面提取主色调

export interface ExtractedColors {
  primary: [number, number, number];   // RGB 0-255
  secondary: [number, number, number];
  accent: [number, number, number];
}

export const DEFAULT_COLORS: ExtractedColors = {
  primary: [120, 140, 255],
  secondary: [170, 140, 255],
  accent: [100, 160, 255],
};

export async function extractColorsFromImage(imageUrl: string): Promise<ExtractedColors> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) { resolve(DEFAULT_COLORS); return; }

        // 缩小图片加快处理
        const size = 32;
        canvas.width = size;
        canvas.height = size;
        ctx.drawImage(img, 0, 0, size, size);

        const data = ctx.getImageData(0, 0, size, size).data;
        const buckets = new Map<string, { r: number; g: number; b: number; count: number }>();

        // 遍历所有像素，量化颜色
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];

          // 跳过灰白色（饱和度太低的颜色）
          const max = Math.max(r, g, b);
          const min = Math.min(r, g, b);
          const saturation = max > 0 ? (max - min) / max : 0;
          if (saturation < 0.15) continue; // 跳过灰白色

          // 量化到 8 个区间
          const qr = Math.floor(r / 32) * 32 + 16;
          const qg = Math.floor(g / 32) * 32 + 16;
          const qb = Math.floor(b / 32) * 32 + 16;
          const key = `${qr}-${qg}-${qb}`;

          const bucket = buckets.get(key);
          if (bucket) {
            bucket.count++;
          } else {
            buckets.set(key, { r: qr, g: qg, b: qb, count: 1 });
          }
        }

        // 按数量排序
        const sorted = [...buckets.values()].sort((a, b) => b.count - a.count);

        if (sorted.length === 0) {
          resolve(DEFAULT_COLORS);
          return;
        }

        // 取前 3 个不同的颜色，提亮 30%
        const brighten = (v: number) => Math.min(255, Math.round(v * 1.3));
        const c1: [number, number, number] = [brighten(sorted[0].r), brighten(sorted[0].g), brighten(sorted[0].b)];
        const c2: [number, number, number] = sorted[1] ? [brighten(sorted[1].r), brighten(sorted[1].g), brighten(sorted[1].b)] : c1;
        const c3: [number, number, number] = sorted[2] ? [brighten(sorted[2].r), brighten(sorted[2].g), brighten(sorted[2].b)] : c2;

        const result: ExtractedColors = {
          primary: c1,
          secondary: c2,
          accent: c3,
        };

        console.log("Extracted colors:", result);
        resolve(result);
      } catch (err) {
        console.error("Color extraction error:", err);
        resolve(DEFAULT_COLORS);
      }
    };

    img.onerror = () => {
      console.warn("Failed to load image for color extraction");
      resolve(DEFAULT_COLORS);
    };

    img.src = imageUrl;
  });
}
