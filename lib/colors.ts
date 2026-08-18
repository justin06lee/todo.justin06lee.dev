// Category palette, identical to justin06lee.dev's calendar categories (and to
// the CATEGORY_PALETTE the installed color-swatch component ships). This copy
// exists because color-swatch.tsx is a "use client" module — importing its
// export from a server action would pull the whole component across the
// boundary — and because the server must validate colors without trusting the
// client. Deliberately no "server-only" import: the client components read the
// palette from here too, so there is exactly one source of truth in this repo.
export type PaletteColor = { name: string; hex: string };

export const CATEGORY_PALETTE: readonly PaletteColor[] = [
  { name: "slate-blue", hex: "#5b7a8a" },
  { name: "taupe", hex: "#7a6b5b" },
  { name: "sage", hex: "#6b8a72" },
  { name: "plum", hex: "#7a5b78" },
  { name: "ochre", hex: "#8a7a5b" },
  { name: "terracotta", hex: "#8a6655" },
  { name: "fog", hex: "#7a8085" },
  { name: "indigo", hex: "#5b5b8a" },
] as const;

const PALETTE_HEX_SET = new Set(CATEGORY_PALETTE.map((c) => c.hex));

export function isPaletteColor(hex: string): boolean {
  return PALETTE_HEX_SET.has(hex);
}

/**
 * Returns the palette hex used least often in `usedHexes`.
 * Ties broken by earlier palette position. If `usedHexes` is empty, returns the first color.
 */
export function pickNextUnusedColor(usedHexes: readonly string[]): string {
  const counts = new Map<string, number>();
  for (const c of CATEGORY_PALETTE) counts.set(c.hex, 0);
  for (const h of usedHexes) {
    if (counts.has(h)) counts.set(h, (counts.get(h) ?? 0) + 1);
  }
  let bestHex = CATEGORY_PALETTE[0].hex;
  let bestCount = Infinity;
  for (const c of CATEGORY_PALETTE) {
    const n = counts.get(c.hex) ?? 0;
    if (n < bestCount) {
      bestCount = n;
      bestHex = c.hex;
    }
  }
  return bestHex;
}
