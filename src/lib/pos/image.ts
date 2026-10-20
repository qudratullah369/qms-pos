export function monogram(name: string, fill: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  const letters = (
    parts.length >= 2 ? parts[0]![0]! + parts[1]![0]! : name.slice(0, 2)
  ).toUpperCase();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 120"><rect width="160" height="120" fill="${fill}"/><text x="80" y="72" text-anchor="middle" font-family="Georgia,serif" font-size="40" fill="#f3f1ea">${letters}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export async function fileToDataUrl(file: File, max = 240): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.7);
}
