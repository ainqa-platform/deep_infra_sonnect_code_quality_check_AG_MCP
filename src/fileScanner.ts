import fs from "fs";
import path from "path";
import { CONFIG } from "./config.js";

export function resolveFilePath(relativePath: string): string {
    const root = path.resolve(CONFIG.codeRoot);
    const abs = path.resolve(root, relativePath);
    if (!abs.startsWith(root)) {
        throw new Error("Access outside CODE_ROOT is not allowed.");
    }
    return abs;
}

export function readCodeFile(absPath: string): string {
    if (!fs.existsSync(absPath)) {
        throw new Error(`File not found: ${absPath}`);
    }

    const stats = fs.statSync(absPath);
    const sizeKb = stats.size / 1024;
    if (sizeKb > CONFIG.maxFileSizeKb) {
        throw new Error(
            `File too large (${sizeKb.toFixed(
                1
            )} KB). Max allowed is ${CONFIG.maxFileSizeKb} KB.`
        );
    }

    return fs.readFileSync(absPath, "utf8");
}
