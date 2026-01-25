import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";

console.log("Preparing resources for Tauri build...");

const src = "public";
const dest = "src-tauri/public";

if (existsSync(dest)) {
    try {
        rmSync(dest, { recursive: true, force: true });
    } catch (e) {
        console.log("Could not clear dest folder, proceeding...");
    }
}

if (!existsSync(dest)) {
    mkdirSync(dest, { recursive: true });
}

try {
    cpSync(src, dest, { recursive: true });
    console.log("Successfully copied public to src-tauri/public");
} catch (e) {
    console.error("Failed to copy public folder:", e);
    process.exit(1);
}
