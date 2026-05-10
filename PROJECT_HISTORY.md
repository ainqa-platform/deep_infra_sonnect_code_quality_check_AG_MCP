# 📜 Project History & Architecture Changes

This document serves as a historical record of the changes, fixes, and architectural evolutions this repository underwent to become a robust, production-ready AI Code Quality Toolkit.

---

## 🛑 Phase 1: Identifying the Issues

**Original State:** The project started as a rudimentary Node.js script attempting to act as an MCP (Model Context Protocol) server.
- It was using an obsolete MCP SDK (`v0.4.0`).
- It used raw `readline` to manually parse JSON-RPC messages, which is fragile and breaks easily.
- It used `node-fetch` instead of native Node.js `fetch`.
- It had TypeScript compilation issues preventing ES module imports.
- It used `console.warn` for logging, which corrupted the MCP standard output stream, making communication impossible for clients like Antigravity.

**The Goal:** Transform the codebase into a modern, reliable MCP server and an automated CLI audit tool.

---

## 🛠️ Phase 2: Modernizing the MCP Server

### 1. SDK Upgrades & TypeScript Fixes
- Upgraded `@modelcontextprotocol/sdk` to `v1.29.0`.
- Added `zod` for robust schema validation for MCP arguments.
- Updated `tsconfig.json` to use `Node16` module resolution to allow proper ESM `.js` extension imports.
- Removed the deprecated `node-fetch` dependency in favor of the native `fetch` API.

### 2. Rewriting the Server (`src/server.ts`)
- Scrapped the manual `readline` parsing.
- Adopted the modern `McpServer` class and `StdioServerTransport` pattern.
- Properly registered two MCP tools:
  1. `code_quality_check`: Expects `filePath` and uses `Zod` schemas.
  2. `code_quality_config`: Returns current environment settings.

### 3. Stream Integrity (`src/config.ts`)
- Replaced all `console.warn` and `console.log` statements with `console.error` for diagnostic logging.
- **Why?** MCP uses `stdout` (standard output) exclusively for JSON-RPC communication. If a `console.log` writes normal text to `stdout`, it corrupts the JSON stream and breaks the client connection. Sending logs to `stderr` prevents this.

---

## 🚀 Phase 3: The CLI Toolkit Evolution (`diq`)

**The Goal:** The user requested the ability to manually navigate to *any* repository on their machine and run a batch code quality audit using custom, editable prompts.

### 1. Creating the Automation Script
- Created `scripts/audit-repo.js` to handle:
  - Repository branch creation (`git checkout -b`).
  - Mass file discovery (`git ls-files` with fallbacks).
  - Calling the DeepInfra API in a loop with rate limiting.

### 2. Implementing the Two-Step CLI (`diq init` & `diq run`)
- Restructured `audit-repo.js` into a professional command-line application (CLI).
- **Step 1 (`diq init`)**: Scaffolds a `PROMPT.md` file locally in the target repository. This allows the user to open the prompt and explicitly write custom instructions (e.g., "Check for Ansible tag best practices").
- **Step 2 (`diq run`)**: Reads the custom `PROMPT.md`, injects placeholders like `{{FILE_CONTENT}}` and `{{PROJECT_NAME}}`, and generates a detailed `CODE_QUALITY_REPORT.md`.

### 3. Making it Global
- Added a `bin` entry to `package.json` pointing `diq` to the audit script.
- Now, running `npm link` makes `diq` available universally on the terminal.

---

## ⚙️ Phase 4: Automated Setup & Configuration

**The Goal:** Eliminate manual configuration so that developers pulling the repository can get started instantly.

### 1. The Install Script (`install.sh`)
- Created a bash script to handle the entire setup:
  ```bash
  npm install
  npm run build
  chmod +x scripts/audit-repo.js
  npm link
  ```

### 2. Auto-Configuring MCP Clients (`scripts/setup-mcp.js`)
- Writing manual JSON configuration blocks into hidden files is error-prone.
- Created a Node.js script that automatically detects the operating system (Mac, Linux, Windows) and modifies the configuration files of popular AI agents.
- **Supported Agents Automatically Configured:**
  - Antigravity (`~/.gemini/antigravity/mcp_config.json`)
  - VSCode Cline / Claude Dev (`globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json`)
  - VSCode Roo Cline (`globalStorage/rooveterinaryinc.roo-cline/settings/cline_mcp_settings.json`)

---

## 📝 Key Commands Used During Development

Here are the commands used to build, test, and link the project:

| Command | Purpose |
|---------|---------|
| `npm install @modelcontextprotocol/sdk zod dotenv` | Installing the modern MCP stack. |
| `tsc -p tsconfig.json` | Building the TypeScript codebase to the `dist` folder. |
| `node dist/server.js` | Testing if the MCP server outputs proper JSON-RPC initialization. |
| `npm link` | Linking the `diq` command to the user's global execution path. |
| `chmod +x scripts/audit-repo.js` | Giving the Node CLI script execute permissions. |
| `git ls-files --cached --others --exclude-standard` | Discovering files safely while respecting `.gitignore`. |
| `git checkout -b <branch>` | Creating the isolated branch for audits. |

---

## 📂 Final Architecture

```
.
├── install.sh                  # One-click setup script
├── package.json                # Defines the 'diq' binary
├── scripts
│   ├── audit-repo.js           # The 'diq' CLI core logic (init/run)
│   └── setup-mcp.js            # Injects server config into VSCode/Antigravity
├── prompts
│   ├── default.md              # Template for standard reviews
│   ├── infrastructure.md       # Template for IaC/Ansible
│   └── security.md             # Template for OWASP/Security
└── src
    ├── server.ts               # Core MCP Server execution
    ├── fileScanner.ts          # Safe file loading for MCP
    ├── deepinfraClient.ts      # Fetch wrapper for DeepInfra API
    └── config.ts               # Env parsing & error logging
```
