export function clamp(v: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, v));
}

export function dist(x1: number, y1: number, x2: number, y2: number): number {
  return Math.hypot(x2 - x1, y2 - y1);
}

export function wrap(
  obj: { x: number; y: number; r: number },
  canv: HTMLCanvasElement
): void {
  if (obj.x < 0 - obj.r) obj.x = canv.width + obj.r;
  else if (obj.x > canv.width + obj.r) obj.x = 0 - obj.r;

  if (obj.y < 0 - obj.r) obj.y = canv.height + obj.r;
  else if (obj.y > canv.height + obj.r) obj.y = 0 - obj.r;
}

export function withAlpha(color: string, a: number): string {
  if (color.startsWith("#")) {
    const hex = color.replace("#", "");
    const r = parseInt(hex.length === 3 ? hex[0] + hex[0] : hex.slice(0, 2), 16);
    const g = parseInt(hex.length === 3 ? hex[1] + hex[1] : hex.slice(2, 4), 16);
    const b = parseInt(hex.length === 3 ? hex[2] + hex[2] : hex.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${a})`;
  }
  return color;
}

export function safePlay(audio: HTMLMediaElement): void {
  try {
    const p = audio.play();
    if (p && typeof (p as Promise<void>).catch === "function") {
      (p as Promise<void>).catch(() => {});
    }
  } catch {
    // ignore
  }
}

export function preventScrollKeys(ev: KeyboardEvent): void {
  const keys = ["ArrowLeft", "ArrowRight", "ArrowUp", " ", "Spacebar", "Escape"];
  // eslint-disable-next-line deprecation/deprecation
  if (keys.includes(ev.key) || ev.keyCode === 32) ev.preventDefault();
}
