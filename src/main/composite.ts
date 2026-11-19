// Dev-only (GUISEDESK_SHOT): paste one raw bitmap onto another. Same pixel format on both sides, so channel order is irrelevant.
export interface Bitmap { width: number; height: number; data: Buffer }

export function overlay(base: Bitmap, top: Bitmap, x: number, y: number): Bitmap {
  const data = Buffer.from(base.data)
  for (let row = 0; row < top.height; row++) {
    const dy = y + row
    if (dy < 0 || dy >= base.height) continue
    const x0 = Math.max(0, x)
    const x1 = Math.min(base.width, x + top.width)
    if (x1 <= x0) continue
    top.data.copy(data, (dy * base.width + x0) * 4, (row * top.width + (x0 - x)) * 4, (row * top.width + (x1 - x)) * 4)
  }
  return { width: base.width, height: base.height, data }
}
