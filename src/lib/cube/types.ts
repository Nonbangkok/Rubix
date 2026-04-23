// 54-sticker cube state. Faces in URFDLB order, each a 3x3 row-major grid
// viewed from outside the face.
//
// Index map (for reference when editing moves.ts):
//   U:  0-8    center 4    (viewed with B at top of grid, F at bottom)
//   R:  9-17   center 13   (viewed with U at top, F at left, B at right)
//   F: 18-26   center 22   (viewed from +Z, U at top, L at left)
//   D: 27-35   center 31   (viewed with F at top of grid, B at bottom)
//   L: 36-44   center 40   (viewed with U at top, B at left, F at right)
//   B: 45-53   center 49   (viewed from -Z, U at top, R at left, L at right)

export type Color = "W" | "Y" | "G" | "B" | "O" | "R";
export type Face = "U" | "R" | "F" | "D" | "L" | "B";
export type CubeState = Color[];

export const FACE_START: Record<Face, number> = {
  U: 0,
  R: 9,
  F: 18,
  D: 27,
  L: 36,
  B: 45,
};

// WCA color scheme: white U, yellow D, green F, blue B, orange L, red R.
export const FACE_COLOR: Record<Face, Color> = {
  U: "W",
  D: "Y",
  F: "G",
  B: "B",
  L: "O",
  R: "R",
};

export const COLOR_HEX: Record<Color, string> = {
  W: "#f5f5f5",
  Y: "#ffd62a",
  G: "#2bc34c",
  B: "#1e63ff",
  O: "#ff7a1a",
  R: "#e11030",
};
