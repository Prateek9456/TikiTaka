export interface Point {
  x: number;
  y: number;
}

/** Player nodes arranged in interconnected triangles (tiki-taka passing lanes). */
export const TIKITAKA_NODES: Point[] = [
  { x: 200, y: 36 },   // 0 top
  { x: 72, y: 128 },   // 1 left
  { x: 328, y: 128 },  // 2 right
  { x: 120, y: 248 },  // 3 bottom-left
  { x: 280, y: 248 },  // 4 bottom-right
  { x: 200, y: 148 },  // 5 center hub
];

/** Unique passing lanes between nodes. */
export const TIKITAKA_EDGES: [number, number][] = [
  [0, 5], [0, 1], [0, 2],
  [1, 5], [1, 3],
  [2, 5], [2, 4],
  [3, 5], [3, 4],
  [4, 5],
];

/** Ball travels in quick triangular patterns. */
export const TIKITAKA_PASS_SEQUENCE: number[] = [
  0, 5, 1, 3, 5, 4, 2, 0, 5, 2, 4, 5, 1, 0, 2, 5, 3, 1, 5, 4,
];

export const TIKITAKA_VIEWBOX = { width: 400, height: 280 };
