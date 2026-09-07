import { mkdir, writeFile } from "node:fs/promises";

// Inert test vector assembled at build time; no credentials or network required.
const fixtureValue = ["sk", "proj", "testfixture0123456789abcdef"].join("-");
await mkdir(".next/static/chunks", { recursive: true });
await writeFile(".next/static/chunks/demo.js", `globalThis.demoValue=${JSON.stringify(fixtureValue)};\n`);
