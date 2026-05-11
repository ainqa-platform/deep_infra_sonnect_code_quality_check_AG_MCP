#!/usr/bin/env node

/**
 * DeepInfra Code Quality Audit CLI
 * 
 * Run from inside any repository:
 * 
 *   Step 1:  diq init                → Creates PROMPT.md + CODE_QUALITY_REPORT.md
 *            (edit PROMPT.md)         → Customize the review criteria
 * 
 *   Step 2:  diq run                 → Analyzes files, fills in the report
 * 
 * Commands:
 *   init    [--prompt <template>] [--extensions <list>]
 *   run     [--max-files <n>] [--extensions <list>]
 *   help
 */

import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { fileURLToPath } from "url";

// ── Paths ──────────────────────────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MCP_ROOT = path.resolve(__dirname, "..");
const CWD = process.cwd(); // The repo the user is standing in

const PROMPT_FILE = path.join(CWD, "PROMPT.md");
const REPORT_FILE = path.join(CWD, "CODE_QUALITY_REPORT.md");

// ── Config ─────────────────────────────────────────────────────────────────

const DEEPINFRA_API_KEY = process.env.DEEPINFRA_API_KEY || "";
const DEEPINFRA_BASE_URL = process.env.DEEPINFRA_BASE_URL || "https://api.deepinfra.com/v1/openai";
const DEEPINFRA_MODEL = process.env.DEEPINFRA_MODEL || "meta-llama/Meta-Llama-3.1-70B-Instruct";
const MAX_FILE_SIZE_KB = Number(process.env.MAX_FILE_SIZE_KB || "256");
const MAX_RETRIES = Number(process.env.MAX_RETRIES || "3");
const REQUEST_DELAY_MS = Number(process.env.REQUEST_DELAY_MS || "800");

// ── Language Detection ─────────────────────────────────────────────────────

const LANG_MAP = {
    ".ts": "typescript", ".tsx": "typescript", ".js": "javascript", ".jsx": "javascript",
    ".py": "python", ".yml": "yaml", ".yaml": "yaml", ".tf": "hcl",
    ".sh": "bash", ".go": "go", ".java": "java", ".rb": "ruby",
    ".rs": "rust", ".css": "css", ".html": "html", ".json": "json",
    ".sql": "sql", ".php": "php", ".cs": "csharp", ".cpp": "cpp",
    ".c": "c", ".swift": "swift", ".kt": "kotlin", ".r": "r",
    ".vue": "vue", ".svelte": "svelte", ".dart": "dart",
};

function detectLanguage(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    return LANG_MAP[ext] || "text";
}

// ── Argument Parsing ───────────────────────────────────────────────────────

function parseArgs() {
    const args = process.argv.slice(2);
    const command = args[0] || "help";

    const opts = {
        command,
        promptTemplate: "default",
        extensions: "ts,js,py,yml,yaml,tf,sh,go,java,rb,rs,tsx,jsx,css,html,vue,svelte",
        maxFiles: 500,
    };

    for (let i = 1; i < args.length; i++) {
        switch (args[i]) {
            case "--prompt":     opts.promptTemplate = args[++i]; break;
            case "--extensions": opts.extensions = args[++i]; break;
            case "--max-files":  opts.maxFiles = Number(args[++i]); break;
            case "--delay":      opts.delay = Number(args[++i]); break;
            case "--retries":    opts.retries = Number(args[++i]); break;
            case "--help":       opts.command = "help"; break;
        }
    }

    return opts;
}

// ── Prompt Templates ───────────────────────────────────────────────────────

function getBuiltinTemplate(name) {
    const templatePath = path.join(MCP_ROOT, "prompts", `${name}.md`);
    if (fs.existsSync(templatePath)) {
        return fs.readFileSync(templatePath, "utf8");
    }

    // Check if it's an absolute/relative path
    const absPath = path.resolve(name);
    if (fs.existsSync(absPath)) {
        return fs.readFileSync(absPath, "utf8");
    }

    // Fall back to default
    console.warn(`⚠️  Template '${name}' not found, using default.`);
    console.warn(`   Available: default, security, infrastructure`);
    return fs.readFileSync(path.join(MCP_ROOT, "prompts", "default.md"), "utf8");
}

function renderPrompt(template, placeholders) {
    let rendered = template;
    for (const [key, value] of Object.entries(placeholders)) {
        rendered = rendered.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
    }
    return rendered;
}

// ── File Discovery ─────────────────────────────────────────────────────────

function discoverFiles(repoPath, extensions, maxFiles) {
    const exts = extensions.split(",").map(e => e.trim().replace(/^\./, ""));
    const files = [];

    // Skip audit artifacts
    const skipFiles = ["PROMPT.md", "CODE_QUALITY_REPORT.md", "package-lock.json"];

    try {
        const gitFiles = execSync("git ls-files --cached --others --exclude-standard", {
            cwd: repoPath,
            encoding: "utf8",
            maxBuffer: 10 * 1024 * 1024,
        }).trim().split("\n").filter(Boolean);

        for (const file of gitFiles) {
            if (skipFiles.includes(path.basename(file))) continue;
            const ext = path.extname(file).replace(/^\./, "");
            if (exts.includes(ext)) {
                const absPath = path.join(repoPath, file);
                const stats = fs.statSync(absPath, { throwIfNoEntry: false });
                if (stats && stats.size / 1024 <= MAX_FILE_SIZE_KB) {
                    files.push(file);
                }
            }
            if (files.length >= maxFiles) break;
        }
    } catch {
        walkDir(repoPath, repoPath, exts, files, maxFiles, skipFiles);
    }

    return files;
}

function walkDir(baseDir, currentDir, exts, files, maxFiles, skipFiles) {
    if (files.length >= maxFiles) return;
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
        if (files.length >= maxFiles) return;
        const fullPath = path.join(currentDir, entry.name);
        if (entry.isDirectory()) {
            const skip = ["node_modules", ".git", "dist", "build", "__pycache__", ".venv", "vendor", ".terraform"];
            if (!skip.includes(entry.name)) {
                walkDir(baseDir, fullPath, exts, files, maxFiles, skipFiles);
            }
        } else {
            if (skipFiles.includes(entry.name)) continue;
            const ext = path.extname(entry.name).replace(/^\./, "");
            if (exts.includes(ext)) {
                const stats = fs.statSync(fullPath);
                if (stats.size / 1024 <= MAX_FILE_SIZE_KB) {
                    files.push(path.relative(baseDir, fullPath));
                }
            }
        }
    }
}

// ── DeepInfra API ──────────────────────────────────────────────────────────

async function callDeepInfra(prompt, maxRetries = MAX_RETRIES, retryCount = 0) {
    try {
        const response = await fetch(`${DEEPINFRA_BASE_URL}/chat/completions`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${DEEPINFRA_API_KEY}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: DEEPINFRA_MODEL,
                messages: [{ role: "user", content: prompt }],
            }),
        });

        if (!response.ok) {
            // Handle rate limiting (429) or server errors (5xx) with exponential backoff
            if ((response.status === 429 || response.status >= 500) && retryCount < maxRetries) {
                const backoff = Math.pow(2, retryCount) * 2000;
                process.stdout.write(`(retry ${retryCount + 1}/${maxRetries} in ${backoff}ms)... `);
                await new Promise(r => setTimeout(r, backoff));
                return callDeepInfra(prompt, maxRetries, retryCount + 1);
            }
            const text = await response.text();
            throw new Error(`DeepInfra API ${response.status}: ${text.substring(0, 200)}`);
        }

        const json = await response.json();
        return json.choices?.[0]?.message?.content || "No response from DeepInfra.";
    } catch (err) {
        // Handle network errors (like "fetch failed") with retries
        if (retryCount < maxRetries) {
            const backoff = Math.pow(2, retryCount) * 2000;
            process.stdout.write(`(network retry ${retryCount + 1}/${maxRetries} in ${backoff}ms)... `);
            await new Promise(r => setTimeout(r, backoff));
            return callDeepInfra(prompt, maxRetries, retryCount + 1);
        }
        throw err;
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// COMMAND: init
// ═══════════════════════════════════════════════════════════════════════════

function cmdInit(opts) {
    const projectName = path.basename(CWD);

    console.log("\n╔══════════════════════════════════════════════════╗");
    console.log("║   📁 Code Quality Audit — Initialize             ║");
    console.log("╚══════════════════════════════════════════════════╝\n");
    console.log(`  Project:  ${projectName}`);
    console.log(`  Path:     ${CWD}\n`);

    // Discover files to show in the report skeleton
    const files = discoverFiles(CWD, opts.extensions, opts.maxFiles);

    // ── Create PROMPT.md ───────────────────────────────────────────────
    if (fs.existsSync(PROMPT_FILE)) {
        console.log(`  ⚠️  PROMPT.md already exists — skipping (delete it to regenerate)`);
    } else {
        const template = getBuiltinTemplate(opts.promptTemplate);
        const promptContent = `<!-- 
  ╔══════════════════════════════════════════════════════════════╗
  ║  EDIT THIS FILE to customize your code quality review.      ║
  ║                                                              ║
  ║  Placeholders (auto-replaced at runtime):                    ║
  ║    {{PROJECT_NAME}}  → ${projectName.padEnd(40)}║
  ║    {{FILE_PATH}}     → relative path to each file            ║
  ║    {{LANGUAGE}}      → detected language (yaml, python, etc) ║
  ║    {{REVIEW_TYPE}}   → name of this review                   ║
  ║    {{FILE_CONTENT}}  → full file contents (auto-injected)    ║
  ║                                                              ║
  ║  After editing, run:  diq run                                ║
  ╚══════════════════════════════════════════════════════════════╝
-->

${template}`;

        fs.writeFileSync(PROMPT_FILE, promptContent, "utf8");
        console.log(`  ✅ Created PROMPT.md — edit this to customize your review criteria`);
    }

    // ── Create CODE_QUALITY_REPORT.md skeleton ─────────────────────────
    if (fs.existsSync(REPORT_FILE)) {
        console.log(`  ⚠️  CODE_QUALITY_REPORT.md already exists — skipping (delete it to regenerate)`);
    } else {
        const now = new Date().toISOString().replace("T", " ").substring(0, 19);
        let branch = "unknown";
        try {
            branch = execSync("git rev-parse --abbrev-ref HEAD", { cwd: CWD, encoding: "utf8" }).trim();
        } catch { /* not a git repo */ }

        let report = `# 📋 Code Quality Audit Report

> **Project:** ${projectName}
> **Repository:** \`${CWD}\`
> **Branch:** \`${branch}\`
> **Model:** \`${DEEPINFRA_MODEL}\`
> **Files to Analyze:** ${files.length}
> **Initialized:** ${now} UTC
> **Status:** ⏳ Pending — run \`diq run\` to fill this report

---

## Files Queued for Review

| # | File | Language | Status |
|---|------|----------|--------|
${files.map((f, i) => `| ${i + 1} | \`${f}\` | ${detectLanguage(f)} | ⏳ Pending |`).join("\n")}

---

<!-- 
  The sections below will be auto-generated when you run: diq run
  Each file will get its own section with the DeepInfra analysis.
-->

`;

        fs.writeFileSync(REPORT_FILE, report, "utf8");
        console.log(`  ✅ Created CODE_QUALITY_REPORT.md — will be filled when you run 'diq run'`);
    }

    // ── Summary ────────────────────────────────────────────────────────
    console.log(`\n  📂 Files discovered: ${files.length}`);
    if (files.length > 0) {
        const shown = files.slice(0, 10);
        shown.forEach((f, i) => console.log(`     ${i + 1}. ${f} (${detectLanguage(f)})`));
        if (files.length > 10) console.log(`     ... and ${files.length - 10} more`);
    }

    console.log("\n╔══════════════════════════════════════════════════╗");
    console.log("║  Next Steps:                                     ║");
    console.log("║                                                   ║");
    console.log("║  1. Edit PROMPT.md to customize review criteria   ║");
    console.log("║  2. Run:  diq run                                 ║");
    console.log("╚══════════════════════════════════════════════════╝\n");
}

// ═══════════════════════════════════════════════════════════════════════════
// COMMAND: run
// ═══════════════════════════════════════════════════════════════════════════

async function cmdRun(opts) {
    const projectName = path.basename(CWD);

    console.log("\n╔══════════════════════════════════════════════════╗");
    console.log("║   🔬 Code Quality Audit — Running Analysis       ║");
    console.log("╚══════════════════════════════════════════════════╝\n");

    // ── Validate prerequisites ─────────────────────────────────────────
    if (!DEEPINFRA_API_KEY) {
        console.error("❌ DEEPINFRA_API_KEY is not set.");
        console.error("   Export it:  export DEEPINFRA_API_KEY=your-key-here");
        console.error("   Or set in:  ~/.gemini/antigravity/mcp_config.json");
        process.exit(1);
    }

    if (!fs.existsSync(PROMPT_FILE)) {
        console.error("❌ PROMPT.md not found. Run 'diq init' first.");
        process.exit(1);
    }

    // ── Load prompt ────────────────────────────────────────────────────
    console.log("  📝 Loading PROMPT.md...");
    const promptTemplate = fs.readFileSync(PROMPT_FILE, "utf8");
    console.log("  ✅ Prompt loaded\n");

    // ── Discover files ─────────────────────────────────────────────────
    console.log("  📂 Discovering files...");
    const files = discoverFiles(CWD, opts.extensions, opts.maxFiles);
    console.log(`  ✅ Found ${files.length} files to analyze\n`);

    if (files.length === 0) {
        console.log("  ⚠️  No files found. Check your --extensions option.");
        process.exit(0);
    }

    // ── Get git info ───────────────────────────────────────────────────
    let branch = "unknown";
    try {
        branch = execSync("git rev-parse --abbrev-ref HEAD", { cwd: CWD, encoding: "utf8" }).trim();
    } catch { /* not a git repo */ }

    // ── Analyze each file ──────────────────────────────────────────────
    console.log("  🔬 Analyzing files...\n");
    const results = [];

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const absPath = path.join(CWD, file);
        const language = detectLanguage(file);

        process.stdout.write(`  [${String(i + 1).padStart(2)}/${files.length}] ${file} `);

        try {
            const code = fs.readFileSync(absPath, "utf8");

            const prompt = renderPrompt(promptTemplate, {
                PROJECT_NAME: projectName,
                FILE_PATH: file,
                LANGUAGE: language,
                REVIEW_TYPE: "custom",
                FILE_CONTENT: code,
            });

            const review = await callDeepInfra(prompt, opts.retries || MAX_RETRIES);
            results.push({ file, language, review, error: null });
            console.log("✅");

            // Rate limiting / Throttling
            const delay = opts.delay || REQUEST_DELAY_MS;
            if (i < files.length - 1) {
                await new Promise(r => setTimeout(r, delay));
            }
        } catch (err) {
            console.log(`❌ ${err.message.substring(0, 60)}`);
            results.push({ file, language, review: "", error: err.message });
        }
    }

    // ── Generate report ────────────────────────────────────────────────
    console.log("\n  📄 Generating CODE_QUALITY_REPORT.md...");

    const now = new Date().toISOString().replace("T", " ").substring(0, 19);
    const succeeded = results.filter(r => !r.error).length;
    const failed = results.filter(r => r.error).length;

    let report = `# 📋 Code Quality Audit Report

> **Project:** ${projectName}
> **Repository:** \`${CWD}\`
> **Branch:** \`${branch}\`
> **Model:** \`${DEEPINFRA_MODEL}\`
> **Files Analyzed:** ${succeeded} / ${files.length}
> **Generated:** ${now} UTC
> **Status:** ✅ Complete

---

## Files Reviewed

| # | File | Language | Status |
|---|------|----------|--------|
${results.map((r, i) => `| ${i + 1} | \`${r.file}\` | ${r.language} | ${r.error ? "❌ Error" : "✅ Reviewed"} |`).join("\n")}

---

`;

    // Add each file's review
    for (let i = 0; i < results.length; i++) {
        const r = results[i];
        report += `## ${i + 1}. \`${r.file}\`\n\n`;
        report += `> **Language:** ${r.language}\n\n`;

        if (r.error) {
            report += `> ❌ **Analysis failed:** ${r.error}\n\n`;
        } else {
            report += r.review + "\n\n";
        }

        report += "---\n\n";
    }

    // Add summary
    const criticals = results.filter(r => r.review.includes("🔴")).length;
    const highs = results.filter(r => r.review.includes("🟠")).length;
    const mediums = results.filter(r => r.review.includes("🟡")).length;
    const lows = results.filter(r => r.review.includes("🟢")).length;

    report += `## 📊 Audit Summary

| Metric | Value |
|--------|-------|
| Total files scanned | ${files.length} |
| Successfully reviewed | ${succeeded} |
| Failed | ${failed} |
| 🔴 Files with critical issues | ${criticals} |
| 🟠 Files with high issues | ${highs} |
| 🟡 Files with medium issues | ${mediums} |
| 🟢 Files with low/info issues | ${lows} |

---

*Generated by [DeepInfra Code Quality MCP](https://github.com/ainqa-platform/deep_infra_sonnect_code_quality_check_AG_MCP) on ${now} UTC*
`;

    fs.writeFileSync(REPORT_FILE, report, "utf8");
    console.log(`  ✅ Report saved to CODE_QUALITY_REPORT.md\n`);

    // ── Final summary ──────────────────────────────────────────────────
    console.log("╔══════════════════════════════════════════════════╗");
    console.log("║               ✅ Audit Complete                  ║");
    console.log("╠══════════════════════════════════════════════════╣");
    console.log(`║  Analyzed:  ${String(succeeded).padEnd(37)}║`);
    console.log(`║  Failed:    ${String(failed).padEnd(37)}║`);
    console.log(`║  Report:    CODE_QUALITY_REPORT.md${" ".repeat(15)}║`);
    console.log("╠══════════════════════════════════════════════════╣");
    console.log("║  Next: review the report and fix the issues     ║");
    console.log("║        git add . && git commit -m 'audit'       ║");
    console.log("╚══════════════════════════════════════════════════╝\n");
}

// ═══════════════════════════════════════════════════════════════════════════
// COMMAND: help
// ═══════════════════════════════════════════════════════════════════════════

function cmdHelp() {
    console.log(`
╔══════════════════════════════════════════════════════════╗
║   DeepInfra Code Quality Audit CLI (diq)                 ║
╚══════════════════════════════════════════════════════════╝

Usage:  diq <command> [options]

Commands:
  init     Create PROMPT.md and CODE_QUALITY_REPORT.md in the current repo
  run      Analyze files using your PROMPT.md and fill the report
  help     Show this help message

Workflow:
  1.  cd /path/to/your-repo
  2.  git checkout -b code-quality-audit
  3.  diq init                           ← creates PROMPT.md + report skeleton
  4.  (edit PROMPT.md)                   ← customize the review criteria
  5.  diq run                            ← runs analysis, fills the report
  6.  git add . && git commit            ← commit the report

Options for 'init':
  --prompt <template>    Base template: default | security | infrastructure
                         Or path to a custom .md file
  --extensions <list>    Comma-separated extensions (default: ts,js,py,yml,...)

Options for 'run':
  --max-files <n>        Max files to analyze (default: 500)
  --extensions <list>    Comma-separated extensions (default: ts,js,py,yml,...)
  --delay <ms>           Delay between requests in ms (default: 800)
  --retries <n>          Number of retries for failed requests (default: 3)

Environment:
  DEEPINFRA_API_KEY      Your DeepInfra API key (required for 'run')
  DEEPINFRA_MODEL        Model to use (default: meta-llama/Meta-Llama-3.1-70B-Instruct)
  DEEPINFRA_BASE_URL     API base URL
  MAX_FILE_SIZE_KB       Skip files larger than this (default: 256)
`);
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════

async function main() {
    const opts = parseArgs();

    switch (opts.command) {
        case "init":
            cmdInit(opts);
            break;
        case "run":
            await cmdRun(opts);
            break;
        case "help":
        default:
            cmdHelp();
            break;
    }
}

main().catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
});
