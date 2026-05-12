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
 */

import fs from "fs";
import path from "path";
import os from "os";
import dotenv from "dotenv";
import { execSync } from "child_process";
import { fileURLToPath } from "url";

// ── Paths ──────────────────────────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MCP_ROOT = path.resolve(__dirname, "..");
const CWD = process.cwd(); // The repo the user is standing in

const PROMPT_FILE = path.join(CWD, "PROMPT.md");
const REPORT_FILE = path.join(CWD, "CODE_QUALITY_REPORT.md");

// ── Config & Environment ──────────────────────────────────────────────────

// 1. Load from CWD .env (where the user is auditing)
dotenv.config({ path: path.join(CWD, ".env") });

// 2. Load from MCP_ROOT .env (where the toolkit lives) as fallback
if (!process.env.DEEPINFRA_API_KEY) {
    dotenv.config({ path: path.join(MCP_ROOT, ".env") });
}

// 3. Load from ~/.gemini/antigravity/mcp_config.json as fallback
if (!process.env.DEEPINFRA_API_KEY) {
    const configPath = path.join(os.homedir(), ".gemini", "antigravity", "mcp_config.json");
    if (fs.existsSync(configPath)) {
        try {
            const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
            const serverConfig = config.mcpServers?.["deepinfra-code-quality"];
            if (serverConfig?.env?.DEEPINFRA_API_KEY) {
                process.env.DEEPINFRA_API_KEY = serverConfig.env.DEEPINFRA_API_KEY;
                if (!process.env.DEEPINFRA_MODEL) process.env.DEEPINFRA_MODEL = serverConfig.env.DEEPINFRA_MODEL;
                if (!process.env.DEEPINFRA_BASE_URL) process.env.DEEPINFRA_BASE_URL = serverConfig.env.DEEPINFRA_BASE_URL;
            }
        } catch (e) { /* Silently ignore config parse errors */ }
    }
}

const DEEPINFRA_API_KEY = process.env.DEEPINFRA_API_KEY || "";
const DEEPINFRA_BASE_URL = process.env.DEEPINFRA_BASE_URL || "https://api.deepinfra.com/v1/openai";
const DEEPINFRA_MODEL = process.env.DEEPINFRA_MODEL || "meta-llama/Meta-Llama-3.1-70B-Instruct";
const MAX_FILE_SIZE_KB = Number(process.env.MAX_FILE_SIZE_KB || "512");
const MAX_RETRIES = Number(process.env.MAX_RETRIES || "3");
const REQUEST_DELAY_MS = Number(process.env.REQUEST_DELAY_MS || "8000");

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
            case "--prompt": opts.promptTemplate = args[++i]; break;
            case "--extensions": opts.extensions = args[++i]; break;
            case "--max-files": opts.maxFiles = Number(args[++i]); break;
            case "--delay": opts.delay = Number(args[++i]); break;
            case "--retries": opts.retries = Number(args[++i]); break;
            case "--format": opts.format = args[++i]; break; // markdown | junit | json
            case "--output": opts.output = args[++i]; break;
            case "--fail-on": opts.failOn = args[++i]; break; // critical | high | medium | low
            case "--resume": opts.resume = true; break;
            case "--help": opts.command = "help"; break;
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

    const absPath = path.resolve(name);
    if (fs.existsSync(absPath)) {
        return fs.readFileSync(absPath, "utf8");
    }

    console.warn(`⚠️  Template '${name}' not found, using default.`);
    return fs.readFileSync(path.join(MCP_ROOT, "prompts", "default.md"), "utf8");
}

function renderPrompt(template, placeholders) {
    let rendered = template;
    for (const [key, value] of Object.entries(placeholders)) {
        rendered = rendered.split(`{{${key}}}`).join(value);
    }
    return rendered;
}

// ── File Discovery ─────────────────────────────────────────────────────────

function discoverFiles(repoPath, extensions, maxFiles) {
    const exts = extensions.split(",").map(e => e.trim().replace(/^\./, ""));
    const files = [];
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
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000); // 60s timeout

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
            signal: controller.signal,
        });

        clearTimeout(timeout);

        if (!response.ok) {
            const text = await response.text();

            if (response.status === 401) {
                throw new Error("API Key is invalid or unauthorized (401).");
            }

            if (response.status === 400 && (text.includes("Input too long") || text.includes("context_length_exceeded"))) {
                throw new Error("TOKEN_LIMIT_EXCEEDED");
            }

            if ((response.status === 429 || response.status >= 500) && retryCount < maxRetries) {
                const backoff = Math.pow(2, retryCount) * 2000;
                process.stdout.write(`(retry ${retryCount + 1}/${maxRetries} in ${backoff}ms)... `);
                await new Promise(r => setTimeout(r, backoff));
                return callDeepInfra(prompt, maxRetries, retryCount + 1);
            }
            throw new Error(`DeepInfra API ${response.status}: ${text.substring(0, 200)}`);
        }

        const json = await response.json();
        return json.choices?.[0]?.message?.content || "No response from DeepInfra.";
    } catch (err) {
        clearTimeout(timeout);
        if (err.name === 'AbortError') {
            if (retryCount < maxRetries) {
                process.stdout.write(`(timeout retry ${retryCount + 1}/${maxRetries})... `);
                return callDeepInfra(prompt, maxRetries, retryCount + 1);
            }
            throw new Error("Request timed out after 60 seconds.");
        }

        if (retryCount < maxRetries) {
            const backoff = Math.pow(2, retryCount) * 2000;
            process.stdout.write(`(network retry ${retryCount + 1}/${maxRetries} in ${backoff}ms)... `);
            await new Promise(r => setTimeout(r, backoff));
            return callDeepInfra(prompt, maxRetries, retryCount + 1);
        }
        throw err;
    }
}

async function reviewLargeFile(projectName, filePath, language, code, promptTemplate, maxRetries) {
    console.log(" (switching to chunked mode)... ");
    
    // Split into chunks of ~50k characters (safe for most contexts)
    const chunkSize = 50000;
    const chunks = [];
    for (let i = 0; i < code.length; i += chunkSize) {
        chunks.push(code.substring(i, i + chunkSize));
    }

    let mergedReview = `### 📦 Large File Audit (${chunks.length} chunks)\n\nThis file was analyzed in segments due to its size.\n\n`;

    for (let i = 0; i < chunks.length; i++) {
        process.stdout.write(`    └ Chunk ${i + 1}/${chunks.length} `);
        const chunkPrompt = renderPrompt(promptTemplate, {
            PROJECT_NAME: projectName,
            FILE_PATH: `${filePath} (Part ${i + 1}/${chunks.length})`,
            LANGUAGE: language,
            FILE_CONTENT: chunks[i],
        });

        try {
            const review = await callDeepInfra(chunkPrompt, maxRetries);
            mergedReview += `#### Part ${i + 1}\n${review}\n\n---\n\n`;
            console.log("✅");
        } catch (err) {
            console.log(`❌ ${err.message}`);
            mergedReview += `#### Part ${i + 1}\n❌ Analysis failed: ${err.message}\n\n---\n\n`;
        }
    }

    return mergedReview;
}

// ── Report Generation ──────────────────────────────────────────────────────

function generateReportContent(projectName, branch, files, results, isComplete = false) {
    const now = new Date().toISOString().replace("T", " ").substring(0, 19);
    const succeeded = results.filter(r => r && !r.error).length;
    const failed = results.filter(r => r && r.error).length;

    let report = `# 📋 Code Quality Audit Report\n\n`;
    report += `> **Project:** ${projectName}\n`;
    report += `> **Repository:** \`${CWD}\`\n`;
    report += `> **Branch:** \`${branch}\`\n`;
    report += `> **Model:** \`${DEEPINFRA_MODEL}\`\n`;
    report += `> **Files Analyzed:** ${succeeded} / ${files.length}\n`;
    report += `> **Updated:** ${now} UTC\n`;
    report += `> **Status:** ${isComplete ? "✅ Complete" : "⏳ In Progress..."}\n\n`;
    report += `---\n\n## Files Reviewed\n\n| # | File | Language | Status |\n|---|------|----------|--------|\n`;

    for (let i = 0; i < files.length; i++) {
        const r = results[i];
        let status = "⏳ Pending";
        if (r) {
            status = r.error ? "❌ Error" : "✅ Reviewed";
        }
        report += `| ${i + 1} | \`${files[i]}\` | ${detectLanguage(files[i])} | ${status} |\n`;
    }

    report += `\n---\n\n`;

    for (let i = 0; i < results.length; i++) {
        const r = results[i];
        if (!r) continue;
        report += `## ${i + 1}. \`${r.file}\`\n\n`;
        report += `> **Language:** ${r.language}\n\n`;
        if (r.error) {
            report += `> ❌ **Analysis failed:** ${r.error}\n\n`;
        } else {
            report += r.review + "\n\n";
        }
        report += "---\n\n";
    }

    if (isComplete) {
        const criticals = results.filter(r => r && r.review.includes("🔴")).length;
        const highs = results.filter(r => r && r.review.includes("🟠")).length;
        const mediums = results.filter(r => r && r.review.includes("🟡")).length;
        const lows = results.filter(r => r && r.review.includes("🟢")).length;

        report += `## 📊 Audit Summary\n\n`;
        report += `| Metric | Value |\n|--------|-------|\n`;
        report += `| Total files scanned | ${files.length} |\n`;
        report += `| Successfully reviewed | ${succeeded} |\n`;
        report += `| Failed | ${failed} |\n`;
        report += `| 🔴 Files with critical issues | ${criticals} |\n`;
        report += `| 🟠 Files with high issues | ${highs} |\n`;
        report += `| 🟡 Files with medium issues | ${mediums} |\n`;
        report += `| 🟢 Files with low/info issues | ${lows} |\n\n`;
        report += `---\n\n*Generated by [DeepInfra Code Quality MCP](https://github.com/ainqa-platform/deep_infra_sonnect_code_quality_check_AG_MCP) on ${now} UTC*\n`;
    }

    return report;
}

function generateJUnitReport(projectName, files, results) {
    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<testsuites name="DeepInfra Code Quality Audit" tests="${files.length}" failures="${results.filter(r => r && r.error).length}">\n`;
    xml += `  <testsuite name="${projectName}" tests="${files.length}">\n`;

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const r = results[i];
        const className = file.replace(/\//g, ".");

        if (!r) {
            xml += `    <testcase className="${className}" name="${file}">\n`;
            xml += `      <skipped message="Audit not performed" />\n`;
            xml += `    </testcase>\n`;
        } else if (r.error) {
            xml += `    <testcase className="${className}" name="${file}">\n`;
            xml += `      <failure message="Analysis Error">${r.error}</failure>\n`;
            xml += `    </testcase>\n`;
        } else {
            const hasCritical = r.review.includes("🔴");
            const hasHigh = r.review.includes("🟠");
            
            xml += `    <testcase className="${className}" name="${file}">\n`;
            if (hasCritical || hasHigh) {
                const severity = hasCritical ? "CRITICAL" : "HIGH";
                xml += `      <failure message="${severity} Issues Found">${r.review.replace(/[<>&'"]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;','\'':'&apos;','"':'&quot;'}[c]))}</failure>\n`;
            }
            xml += `    </testcase>\n`;
        }
    }

    xml += `  </testsuite>\n</testsuites>\n`;
    return xml;
}

// ── Commands ───────────────────────────────────────────────────────────────

function cmdInit(opts) {
    const projectName = path.basename(CWD);
    console.log("\n╔══════════════════════════════════════════════════╗");
    console.log("║   📁 Code Quality Audit — Initialize             ║");
    console.log("╚══════════════════════════════════════════════════╝\n");

    const files = discoverFiles(CWD, opts.extensions, opts.maxFiles);

    if (!fs.existsSync(PROMPT_FILE)) {
        const template = getBuiltinTemplate(opts.promptTemplate);
        const promptContent = `<!-- \n  Placeholders: {{PROJECT_NAME}}, {{FILE_PATH}}, {{LANGUAGE}}, {{FILE_CONTENT}}\n-->\n\n${template}`;
        fs.writeFileSync(PROMPT_FILE, promptContent, "utf8");
        console.log(`  ✅ Created PROMPT.md`);
    }

    if (!fs.existsSync(REPORT_FILE)) {
        const initialReport = generateReportContent(projectName, "unknown", files, [], false);
        fs.writeFileSync(REPORT_FILE, initialReport, "utf8");
        console.log(`  ✅ Created CODE_QUALITY_REPORT.md`);
    }

    console.log(`\n  📂 Files discovered: ${files.length}\n`);
}

async function cmdRun(opts) {
    const projectName = path.basename(CWD);
    console.log("\n╔══════════════════════════════════════════════════╗");
    console.log("║   🔬 Code Quality Audit — Running Analysis       ║");
    console.log("╚══════════════════════════════════════════════════╝\n");

    if (!DEEPINFRA_API_KEY) {
        console.error("❌ DEEPINFRA_API_KEY is not set.");
        process.exit(1);
    }

    if (!fs.existsSync(PROMPT_FILE)) {
        console.error("❌ PROMPT.md not found. Run 'diq init' first.");
        process.exit(1);
    }

    const promptTemplate = fs.readFileSync(PROMPT_FILE, "utf8");
    const files = discoverFiles(CWD, opts.extensions, opts.maxFiles);
    console.log(`  ✅ Found ${files.length} files to analyze\n`);

    let branch = "unknown";
    try {
        branch = execSync("git rev-parse --abbrev-ref HEAD", { cwd: CWD, encoding: "utf8" }).trim();
    } catch { /* not a git repo */ }

    const results = [];
    const resumePath = path.join(CWD, ".diq_resume.json");

    if (opts.resume && fs.existsSync(resumePath)) {
        try {
            const state = JSON.parse(fs.readFileSync(resumePath, "utf8"));
            if (state.projectName === projectName && state.branch === branch) {
                console.log(`  🔄 Resuming audit: loading ${state.results.length} previous results...`);
                results.push(...state.results);
            }
        } catch (e) { /* ignore */ }
    }

    let filesToProcess = [...files];
    let pass = 1;
    const MAX_PASSES = 2; // Initial pass + 1 cleanup pass

    while (filesToProcess.length > 0 && pass <= MAX_PASSES) {
        const isCleanup = pass > 1;
        if (isCleanup) {
            console.log(`\n  🔄 Pass ${pass}: Retrying ${filesToProcess.length} failed files...\n`);
        }

        const nextPassFiles = [];

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            
            // Skip if not in the current process list
            if (!filesToProcess.includes(file)) continue;

            const absPath = path.join(CWD, file);
            const language = detectLanguage(file);

            // Check if already analyzed successfully in a previous resume
            const existing = results.find(r => r.file === file);
            if (opts.resume && existing && !existing.error && !isCleanup) {
                console.log(`  [${String(i + 1).padStart(2)}/${files.length}] ${file} ⏩ Skipped`);
                filesToProcess = filesToProcess.filter(f => f !== file);
                continue;
            }

            process.stdout.write(`  [${String(i + 1).padStart(2)}/${files.length}] ${file} `);

            try {
                const code = fs.readFileSync(absPath, "utf8");
                const prompt = renderPrompt(promptTemplate, {
                    PROJECT_NAME: projectName,
                    FILE_PATH: file,
                    LANGUAGE: language,
                    FILE_CONTENT: code,
                });

                let review;
                try {
                    review = await callDeepInfra(prompt, opts.retries || MAX_RETRIES);
                } catch (err) {
                    if (err.message === "TOKEN_LIMIT_EXCEEDED") {
                        review = await reviewLargeFile(projectName, file, language, code, promptTemplate, opts.retries || MAX_RETRIES);
                    } else {
                        throw err;
                    }
                }
                
                if (existing) {
                    existing.review = review;
                    existing.error = null;
                } else {
                    results.push({ file, language, review, error: null });
                }
                console.log("✅");
            } catch (err) {
                console.log(`❌ ${err.message}`);
                if (existing) {
                    existing.error = err.message;
                } else {
                    results.push({ file, language, review: "", error: err.message });
                }
                nextPassFiles.push(file); // Keep for next pass
            }

            // Incremental save
            const partialReport = generateReportContent(projectName, branch, files, results, false);
            const currentReportFile = opts.output || "CODE_QUALITY_REPORT.md";
            fs.writeFileSync(path.join(CWD, currentReportFile), partialReport, "utf8");
            fs.writeFileSync(resumePath, JSON.stringify({ projectName, branch, results, timestamp: new Date().toISOString() }, null, 2), "utf8");

            const delay = opts.delay || REQUEST_DELAY_MS;
            if (i < files.length - 1) await new Promise(r => setTimeout(r, delay));
        }

        filesToProcess = nextPassFiles;
        pass++;
    }

    // ── Final Generate report ──────────────────────────────────────────
    console.log(`\n  📄 Finalizing results...`);
    
    const format = opts.format || "markdown";
    const outputFile = opts.output || (format === "junit" ? "audit-report.xml" : (format === "json" ? "audit-report.json" : "CODE_QUALITY_REPORT.md"));

    let finalContent = "";
    if (format === "junit") {
        finalContent = generateJUnitReport(projectName, files, results);
    } else if (format === "json") {
        finalContent = JSON.stringify({ projectName, branch, files, results, timestamp: new Date().toISOString() }, null, 2);
    } else {
        finalContent = generateReportContent(projectName, branch, files, results, true);
    }

    fs.writeFileSync(path.join(CWD, outputFile), finalContent, "utf8");
    
    // Clean up resume state on success
    if (results.every(r => !r.error)) {
        if (fs.existsSync(resumePath)) fs.unlinkSync(resumePath);
    }

    console.log(`  ✅ Results saved to ${outputFile}\n`);

    // ── Quality Gate Logic ─────────────────────────────────────────────
    if (opts.failOn) {
        const severities = { "critical": ["🔴"], "high": ["🔴", "🟠"], "medium": ["🔴", "🟠", "🟡"], "low": ["🔴", "🟠", "🟡", "🟢"] };
        const triggers = severities[opts.failOn.toLowerCase()] || ["🔴"];
        
        const failingFiles = results.filter(r => r && triggers.some(t => r.review.includes(t)));
        if (failingFiles.length > 0) {
            console.error(`❌ QUALITY GATE FAILED: Found ${failingFiles.length} files with ${opts.failOn} or higher issues.`);
            process.exit(1);
        }
    }

    const succeeded = results.filter(r => !r.error).length;
    const failed = results.filter(r => r.error).length;

    // ── Final summary ──────────────────────────────────────────────────
    console.log("╔══════════════════════════════════════════════════╗");
    console.log("║               ✅ Audit Complete                  ║");
    console.log("╠══════════════════════════════════════════════════╣");
    console.log(`║  Analyzed:  ${String(succeeded).padEnd(37)}║`);
    console.log(`║  Failed:    ${String(failed).padEnd(37)}║`);
    console.log(`║  Report:    ${outputFile.padEnd(28)}║`);
    console.log("╠══════════════════════════════════════════════════╣");
    console.log("║  Next: review the report and fix the issues     ║");
    console.log("║        git add . && git commit -m 'audit'       ║");
    console.log("╚══════════════════════════════════════════════════╝\n");
}

function cmdHelp() {
    console.log(`
Usage:  diq <command> [options]

Commands:
  init     Create PROMPT.md and CODE_QUALITY_REPORT.md
  run      Analyze files and fill the report
  help     Show this help message

Options for 'run':
  --resume               Skip already analyzed files from a previous run
  --format <type>        markdown | junit | json (default: markdown)
  --fail-on <level>      critical | high | medium | low
  --output <file>        Custom report filename
  --max-files <n>        Limit number of files
`);
}

async function main() {
    const opts = parseArgs();
    switch (opts.command) {
        case "init": cmdInit(opts); break;
        case "run": await cmdRun(opts); break;
        case "help":
        default: cmdHelp(); break;
    }
}

main().catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
});
