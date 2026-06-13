/* ──────────────────────────────────────────────────────────
   insPRO — Plan → 3B yardımcıları

   2B kaynaklardan (DXF vektör veya raster üzerine elle çizim)
   duvar segmentleri üretir; 3B stüdyo bunları extrude eder.
   ────────────────────────────────────────────────────────── */

import DxfParser from "dxf-parser";

export interface Segment { x1: number; y1: number; x2: number; y2: number }
export interface Nokta { x: number; y: number }
export interface Bounds { minX: number; minY: number; maxX: number; maxY: number }

export function boundsOf(segs: Segment[]): Bounds {
  const b: Bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  for (const s of segs) {
    b.minX = Math.min(b.minX, s.x1, s.x2);
    b.minY = Math.min(b.minY, s.y1, s.y2);
    b.maxX = Math.max(b.maxX, s.x1, s.x2);
    b.maxY = Math.max(b.maxY, s.y1, s.y2);
  }
  if (!isFinite(b.minX)) return { minX: 0, minY: 0, maxX: 1, maxY: 1 };
  return b;
}

/** DXF metnini duvar segmentlerine çevirir (LINE, LWPOLYLINE, POLYLINE). */
export function parseDxfSegments(text: string): { segments: Segment[]; bounds: Bounds } {
  const parser = new DxfParser();
  const dxf = parser.parseSync(text) as unknown as { entities?: DxfEntity[] };
  const segments: Segment[] = [];
  for (const e of dxf?.entities ?? []) {
    if (e.type === "LINE" && e.vertices && e.vertices.length >= 2) {
      const [a, b] = e.vertices;
      segments.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y });
    } else if ((e.type === "LWPOLYLINE" || e.type === "POLYLINE") && e.vertices) {
      const v = e.vertices;
      for (let i = 0; i < v.length - 1; i++) {
        segments.push({ x1: v[i].x, y1: v[i].y, x2: v[i + 1].x, y2: v[i + 1].y });
      }
      if (e.shape && v.length > 2) {
        const f = v[0], l = v[v.length - 1];
        segments.push({ x1: l.x, y1: l.y, x2: f.x, y2: f.y });
      }
    }
  }
  return { segments, bounds: boundsOf(segments) };
}

interface DxfEntity {
  type: string;
  vertices?: { x: number; y: number }[];
  shape?: boolean;
}

/** Çizilen polilinleri (nokta dizileri) segmentlere çevirir. */
export function polylinesToSegments(polylines: Nokta[][]): Segment[] {
  const segs: Segment[] = [];
  for (const pl of polylines) {
    for (let i = 0; i < pl.length - 1; i++) {
      segs.push({ x1: pl[i].x, y1: pl[i].y, x2: pl[i + 1].x, y2: pl[i + 1].y });
    }
  }
  return segs;
}

export function segUzunluk(s: Segment): number {
  return Math.hypot(s.x2 - s.x1, s.y2 - s.y1);
}
