/**
 * 边缘凸面折射，改编自用户 liquid-glass.html 中的 Liquid Glass for Web 光学模型。
 * 原作者 Zaki Sheriff，MIT；完整许可见 ./LICENSE-liquid-glass.txt。
 * 中心像素保持中性，只在边缘生成位移；贴图不含任何页面截图或业务内容。
 */
export function createRefractionField(width: number, height: number, cornerRadius: number): Uint8ClampedArray {
  const radius = Math.min(cornerRadius, width / 2, height / 2);
  const bezel = Math.min(22, width / 2, height / 2);
  const profile = new Float32Array(256);
  for (let i = 0; i < profile.length; i++) {
    const t = Math.max(.002, i / 255);
    const q = 1 - t;
    const base = 1 - q ** 4;
    const slope = q ** 3 / Math.max(.0001, base ** .75);
    const incident = Math.atan(slope);
    const refracted = Math.asin(Math.sin(incident) / 1.5);
    profile[i] = Math.tan(incident - refracted) * 28 * (.35 + .65 * base ** .25);
  }
  const field = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const px = x + .5 - width / 2;
      const py = y + .5 - height / 2;
      const qx = Math.abs(px) - (width / 2 - radius);
      const qy = Math.abs(py) - (height / 2 - radius);
      const ox = Math.max(qx, 0);
      const oy = Math.max(qy, 0);
      const length = Math.hypot(ox, oy);
      const distance = radius - (length + Math.min(Math.max(qx, qy), 0));
      const nx = length > 0 ? ox / length * Math.sign(px) : qx > qy ? Math.sign(px) : 0;
      const ny = length > 0 ? oy / length * Math.sign(py) : qx > qy ? 0 : Math.sign(py);
      let shift = 0;
      if (distance >= 0 && distance < bezel) {
        const f = distance / bezel * 255;
        const i = Math.floor(f);
        shift = -(profile[i] + (profile[Math.min(i + 1, 255)] - profile[i]) * (f - i));
      }
      const offset = (y * width + x) * 4;
      field[offset] = Math.round(128 + nx * shift / 112 * 255);
      field[offset + 1] = Math.round(128 + ny * shift / 112 * 255);
      field[offset + 2] = 128;
      field[offset + 3] = 255;
    }
  }
  return field;
}
