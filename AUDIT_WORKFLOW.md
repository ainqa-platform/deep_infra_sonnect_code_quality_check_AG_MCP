# 🔍 Repository Audit Workflow

> Automated code quality audit: enter a repo → create a branch → scan files → generate a fix report.

---

## Quick Start

```bash
# Dry run — see what files would be analyzed
npm run audit-repo -- /path/to/your-repo --dry-run

# Full audit with default prompt
npm run audit-repo -- /path/to/your-repo

# Security-focused audit on a custom branch
npm run audit-repo -- /path/to/your-repo --prompt security --branch security-audit

# Infrastructure review for Ansible/Terraform repos
npm run audit-repo -- /path/to/your-repo --prompt infrastructure
```

---

## How It Works

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│  Enter Repo  │───▶│Create Branch │───▶│ Scan Files   │───▶│  DeepInfra   │───▶│ MD Report    │
│              │    │              │    │              │    │  Analysis    │    │              │
│ cd <repo>    │    │ git checkout │    │ git ls-files │    │ per file     │    │ CODE_QUALITY │
│              │    │ -b audit     │    │ → filter ext │    │ with prompt  │    │ _REPORT.md   │
└──────────────┘    └──────────────┘    └──────────────┘    └──────────────┘    └──────────────┘
```

### Step-by-step:

1. **Enter the repository** — provide the absolute path
2. **Create a git branch** — isolates the audit (default: `code-quality-audit`)
3. **Discover files** — uses `git ls-files` to find tracked code files
4. **Load prompt template** — applies your custom prompt with placeholders filled in
5. **Analyze each file** — sends code + prompt to DeepInfra API
6. **Generate report** — writes `CODE_QUALITY_REPORT.md` in the repo root

---

## Command Reference

```
node scripts/audit-repo.js <repo-path> [options]
```

| Option | Default | Description |
|--------|---------|-------------|
| `<repo-path>` | *(required)* | Absolute or relative path to the repo |
| `--branch <name>` | `code-quality-audit` | Git branch to create for the audit |
| `--prompt <template>` | `default` | Prompt template name or file path |
| `--extensions <list>` | `ts,js,py,yml,yaml,...` | Comma-separated file extensions to scan |
| `--output <path>` | `<repo>/CODE_QUALITY_REPORT.md` | Where to save the report |
| `--max-files <n>` | `50` | Maximum files to analyze |
| `--skip-branch` | `false` | Skip git branch creation |
| `--dry-run` | `false` | List files without calling the API |

---

## Prompt Templates

### Built-in Templates

| Template | File | Best For |
|----------|------|----------|
| `default` | `prompts/default.md` | General code quality (readability, bugs, security, performance) |
| `security` | `prompts/security.md` | OWASP Top 10 / CWE security audit |
| `infrastructure` | `prompts/infrastructure.md` | Ansible, Terraform, IaC review |

### Placeholders

Every prompt template supports these placeholders — they are auto-filled at runtime:

| Placeholder | Description | Example Value |
|-------------|-------------|---------------|
| `{{PROJECT_NAME}}` | Repository folder name | `AINQA_SharePoint` |
| `{{FILE_PATH}}` | Relative path to the file | `roles/sharepoint_product/tasks/main.yml` |
| `{{LANGUAGE}}` | Detected programming language | `yaml`, `typescript`, `python` |
| `{{REVIEW_TYPE}}` | Name of the prompt template used | `default`, `security`, `infrastructure` |
| `{{FILE_CONTENT}}` | Full contents of the file | *(auto-injected)* |

### Creating Your Own Template

1. Create a `.md` file anywhere (e.g., `prompts/my-team.md`)
2. Use the placeholders above
3. Pass it with `--prompt`:

```bash
# Using a built-in name
npm run audit-repo -- /path/to/repo --prompt security

# Using a custom file path
npm run audit-repo -- /path/to/repo --prompt ./prompts/my-team.md

# Using an absolute path
npm run audit-repo -- /path/to/repo --prompt /Users/me/custom-prompt.md
```

### Example: Custom Team Standards Template

Create `prompts/ainqa-standards.md`:

```markdown
You are a code reviewer enforcing AINQA engineering standards.

**Project:** {{PROJECT_NAME}}
**File:** {{FILE_PATH}}
**Language:** {{LANGUAGE}}

## AINQA Standards Checklist

1. **Naming** — snake_case for variables, PascalCase for classes
2. **Ansible Best Practices** — use `become` only when needed, always tag tasks
3. **Variables** — no hardcoded values, use `defaults/` and `group_vars/`
4. **Secrets** — must use ansible-vault, never plaintext
5. **Documentation** — every role needs a README with variable docs
6. **Error Handling** — use `failed_when`, `changed_when`, `ignore_errors` wisely
7. **Idempotency** — tasks must be safe to re-run

For each violation:
- **Severity:** 🔴 Critical | 🟠 High | 🟡 Medium | 🟢 Low
- **Rule:** Which standard was violated
- **Location:** Task name or line
- **Issue:** What's wrong
- **Fix:** Corrected code

Code:
\`\`\`{{LANGUAGE}}
{{FILE_CONTENT}}
\`\`\`
```

Then run:

```bash
npm run audit-repo -- /path/to/AINQA_SharePoint --prompt ./prompts/ainqa-standards.md
```

---

## Report Output

The generated `CODE_QUALITY_REPORT.md` looks like:

```markdown
# 📋 Code Quality Audit Report

> **Project:** AINQA_SharePoint
> **Branch:** `code-quality-audit`
> **Prompt Template:** `infrastructure`
> **Model:** `meta-llama/Meta-Llama-3.1-70B-Instruct`
> **Files Analyzed:** 19
> **Generated:** 2026-05-10 09:50:00 UTC

---

## 1/19 — `deploy_product.yml`

[... detailed review with findings ...]

---

## 2/19 — `roles/sharepoint_product/tasks/columns.yml`

[... detailed review with findings ...]

---

## 📊 Audit Summary

| Severity | Count |
|----------|-------|
| 🔴 Critical | 2 files with critical issues |
| 🟠 High | 5 files with high issues |
| 🟡 Medium | 8 files with medium issues |
| 🟢 Low | 4 files with low/info issues |
```

---

## Real-World Examples

### Audit the SharePoint Ansible Repo

```bash
npm run audit-repo -- \
  /Users/niyas-ainqa/Library/CloudStorage/OneDrive-Ainqa/AINQA_ITOPS_DevOPS/git_repo/AINQA_SharePoint \
  --prompt infrastructure \
  --branch infra-quality-audit \
  --extensions yml,yaml
```

### Audit a Node.js/TypeScript Repo

```bash
npm run audit-repo -- /path/to/node-app \
  --prompt default \
  --extensions ts,js,tsx,jsx \
  --max-files 30
```

### Security Audit Before a Release

```bash
npm run audit-repo -- /path/to/production-api \
  --prompt security \
  --branch pre-release-security-audit \
  --output ./security-report-v2.5.md
```

### Audit Multiple Repos (loop)

```bash
for repo in /path/to/repos/*/; do
  echo "Auditing: $repo"
  npm run audit-repo -- "$repo" --prompt default --skip-branch
done
```

---

## Environment Variables

Set these in `.env` or export them before running:

| Variable | Required | Description |
|----------|----------|-------------|
| `DEEPINFRA_API_KEY` | ✅ | Your DeepInfra API key |
| `DEEPINFRA_MODEL` | No | Model to use (default: `Meta-Llama-3.1-70B-Instruct`) |
| `DEEPINFRA_BASE_URL` | No | API base URL |
| `MAX_FILE_SIZE_KB` | No | Skip files larger than this (default: 256) |

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `DEEPINFRA_API_KEY not set` | Add to `.env` file or `export DEEPINFRA_API_KEY=...` |
| `No files found` | Check `--extensions` matches your file types |
| `File too large` | Increase `MAX_FILE_SIZE_KB` in `.env` |
| `Git branch failed` | Ensure the repo is a git repo with no uncommitted changes |
| `API rate limited (429)` | Script includes 500ms delays; increase if needed |
| Report is empty | Check the `--dry-run` output first to verify file discovery |
