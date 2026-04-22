#!/usr/bin/env node
// Copies MediaPipe Tasks-Vision WASM from node_modules to public/mediapipe/wasm/
// and downloads the hand-landmarker model into public/mediapipe/models/.
// Idempotent: skips files that already exist.
// Run: npm run setup:mediapipe

import { copyFile, mkdir, readdir, stat, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");

const WASM_SRC = join(
  REPO_ROOT,
  "node_modules",
  "@mediapipe",
  "tasks-vision",
  "wasm",
);
const WASM_DST = join(REPO_ROOT, "public", "mediapipe", "wasm");

const MODEL_DIR = join(REPO_ROOT, "public", "mediapipe", "models");
const MODEL_FILE = join(MODEL_DIR, "hand_landmarker.task");
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

async function fileExists(p) {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

async function copyWasm() {
  if (!(await fileExists(WASM_SRC))) {
    throw new Error(
      `MediaPipe WASM source not found at ${WASM_SRC}. Run \`npm install\` first.`,
    );
  }
  await mkdir(WASM_DST, { recursive: true });
  const files = await readdir(WASM_SRC);
  let copied = 0;
  for (const name of files) {
    const src = join(WASM_SRC, name);
    const dst = join(WASM_DST, name);
    if (await fileExists(dst)) continue;
    await copyFile(src, dst);
    copied++;
  }
  console.log(`wasm: ${copied} file(s) copied, ${files.length - copied} already present`);
}

async function downloadModel() {
  await mkdir(MODEL_DIR, { recursive: true });
  if (await fileExists(MODEL_FILE)) {
    console.log(`model: ${MODEL_FILE} already present`);
    return;
  }
  console.log(`model: downloading ${MODEL_URL} ...`);
  const res = await fetch(MODEL_URL);
  if (!res.ok) {
    throw new Error(`Download failed: ${res.status} ${res.statusText}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(MODEL_FILE, buf);
  console.log(`model: wrote ${buf.length.toLocaleString()} bytes to ${MODEL_FILE}`);
}

await copyWasm();
await downloadModel();
console.log("setup-mediapipe: done");
