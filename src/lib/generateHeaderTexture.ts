export function generateHeaderTexture(width = 512, height = 256): string {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, "hsl(190, 70%, 92%)");
  gradient.addColorStop(1, "hsl(189, 60%, 80%)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  return canvas.toDataURL("image/png");
}
