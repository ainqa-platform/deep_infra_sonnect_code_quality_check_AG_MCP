# 🔍 Repository Audit CLI Workflow (`diq`)

> The `diq` CLI allows you to run an automated code quality audit inside any repository.
> It creates a customizable prompt, scans your code files, and generates a detailed fix report.

---

## Quick Start

Assuming you have run `./install.sh` from the root of the toolkit.

1. **Go to your target repository**:
   ```bash
   cd /path/to/your-repo
   git checkout -b quality-audit
   ```

2. **Initialize the audit**:
   ```bash
   diq init
   ```
   *This creates `PROMPT.md` and an empty `CODE_QUALITY_REPORT.md`.*

3. **Customize your prompt**:
   Open `PROMPT.md` in your text editor and modify the instructions to tell DeepInfra exactly what coding standards to enforce.

4. **Run the audit**:
   ```bash
   diq run
   ```
   *This scans all files and writes the findings into `CODE_QUALITY_REPORT.md`.*

---

## `diq init` Commands

The `init` step supports built-in templates to get you started faster.

```bash
# Default prompt (General code quality)
diq init

# Security-focused audit (OWASP Top 10)
diq init --prompt security

# Infrastructure review (Ansible, Terraform, IaC)
diq init --prompt infrastructure

# Point to a custom prompt template file somewhere else
diq init --prompt /path/to/my-custom-template.md
```

You can also restrict what extensions are scanned when initializing the report skeleton:
```bash
diq init --extensions ts,js,tsx
```

---

## `diq run` Commands

You can limit the scope of the run:

```bash
# Only run on specific extensions
diq run --extensions py,yml

# Limit the maximum number of files to process
diq run --max-files 10

# Increase delay between requests if hitting rate limits (ms)
diq run --delay 1000

# Customize retry count for failed requests
diq run --retries 5
```


---

## Placeholders in `PROMPT.md`

When you run `diq init`, the `PROMPT.md` file contains several placeholders. Do not remove them; the `diq run` command dynamically replaces them for each file it processes.

| Placeholder | Replaced With |
|-------------|---------------|
| `{{PROJECT_NAME}}` | The name of the repository folder |
| `{{FILE_PATH}}` | The relative path to the current file being analyzed |
| `{{LANGUAGE}}` | The detected language (e.g., yaml, python, typescript) |
| `{{REVIEW_TYPE}}` | The name of the template used |
| `{{FILE_CONTENT}}` | The full source code of the file |

**Example of customizing `PROMPT.md`:**

```markdown
You are a senior code reviewer. 

**Project:** {{PROJECT_NAME}}
**File:** {{FILE_PATH}}
**Language:** {{LANGUAGE}}

## My Custom Team Standards Checklist:
1. Make sure variable names are snake_case.
2. Check that no API keys are hardcoded.
3. Validate that error handling is robust.

Code:
\`\`\`{{LANGUAGE}}
{{FILE_CONTENT}}
\`\`\`
```

---

## Example Output (`CODE_QUALITY_REPORT.md`)

Once `diq run` finishes, it populates the report:

```markdown
# 📋 Code Quality Audit Report

> **Project:** AINQA_SharePoint
> **Repository:** `/path/to/AINQA_SharePoint`
> **Branch:** `quality-audit`
> **Files Analyzed:** 19 / 19
> **Status:** ✅ Complete

---

## Files Reviewed
| # | File | Language | Status |
|---|------|----------|--------|
| 1 | `deploy_product.yml` | yaml | ✅ Reviewed |

---

## 1. `deploy_product.yml`
> **Language:** yaml

[... detailed AI review from DeepInfra ...]

---

## 📊 Audit Summary

| Metric | Value |
|--------|-------|
| 🔴 Files with critical issues | 2 |
| 🟠 Files with high issues | 5 |
| 🟡 Files with medium issues | 8 |
| 🟢 Files with low/info issues | 4 |
```

---

## API Key & Configuration

For `diq run` to work, the script needs access to your DeepInfra API key. It searches for configuration in the following order:

1. **Current Directory**: A `.env` file in the folder where you are running the command.
2. **Global Environment**: Variables exported in your shell (e.g., `export DEEPINFRA_API_KEY="..."`).
3. **Toolkit Directory**: The `.env` file located in the toolkit's installation folder (where you ran `./install.sh`).
4. **Antigravity Config**: Your global `~/.gemini/antigravity/mcp_config.json` file (in the `env` block of the `deepinfra-code-quality` server).

**Tip:** Setting your key once in the toolkit's `.env` or the Antigravity config is the easiest way to make `diq` work globally without needing to create a `.env` file in every project.

