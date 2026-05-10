# DeepInfra Code Quality MCP — Usage Guide

> How to use this MCP server across any repository for AI-powered code quality reviews with custom prompting.

---

## Table of Contents

- [Quick Start](#quick-start)
- [Using in Any Repository](#using-in-any-repository)
- [Custom Prompting Placeholders](#custom-prompting-placeholders)
- [Usage Examples](#usage-examples)
- [Advanced Configuration](#advanced-configuration)
- [Troubleshooting](#troubleshooting)

---

## Quick Start

Once the MCP server is built and registered in Antigravity (see [README.md](./README.md)), you can use it immediately in any conversation:

```
Analyze the code quality of src/app.ts
```

Antigravity will automatically invoke the `code_quality_check` tool and return a structured review.

---

## Using in Any Repository

### Step 1: Point `CODE_ROOT` to Your Repository

The `CODE_ROOT` environment variable controls which directory the MCP server can access. Update it in `~/.gemini/antigravity/mcp_config.json`:

```jsonc
{
  "mcpServers": {
    "deepinfra-code-quality": {
      "command": "node",
      "args": ["{{MCP_SERVER_PATH}}/dist/server.js"],
      "env": {
        "DEEPINFRA_API_KEY": "{{YOUR_API_KEY}}",
        "DEEPINFRA_MODEL": "{{MODEL_ID}}",
        "CODE_ROOT": "{{TARGET_REPO_PATH}}",
        "MAX_FILE_SIZE_KB": "{{MAX_SIZE}}"
      }
    }
  }
}
```

#### Placeholder Reference

| Placeholder | Description | Example |
|-------------|-------------|---------|
| `{{MCP_SERVER_PATH}}` | Absolute path to this MCP server directory | `/Users/you/mcp-servers/deepinfra-code-quality` |
| `{{YOUR_API_KEY}}` | Your DeepInfra API key | `T27ktuc1dany...` |
| `{{MODEL_ID}}` | DeepInfra model to use for analysis | `meta-llama/Meta-Llama-3.1-70B-Instruct` |
| `{{TARGET_REPO_PATH}}` | Absolute path to the repo you want to analyze | `/Users/you/projects/my-app` |
| `{{MAX_SIZE}}` | Max file size in KB (files larger are rejected) | `256` |

### Step 2: Use a Parent Directory for Multi-Repo Access

To analyze files across **multiple repositories**, set `CODE_ROOT` to a parent directory:

```json
"CODE_ROOT": "/Users/you/projects"
```

Then reference files with relative paths:

```
Analyze the code quality of my-app/src/index.ts
Analyze the code quality of another-repo/lib/utils.py
```

---

## Custom Prompting Placeholders

The review prompt sent to DeepInfra is defined in `src/deepinfraClient.ts`. You can customize it to match your team's standards.

### Default Prompt Template

```
You are a senior software engineer performing a code quality review.

File: {{FILE_PATH}}

Please analyze:
- Code readability
- Maintainability
- Potential bugs
- Security concerns (if any)
- Suggested refactors
- Any anti-patterns

Return a structured review with sections and bullet points.

Code:
\`\`\`
{{FILE_CONTENT}}
\`\`\`
```

### Available Placeholders

| Placeholder | Source | Description |
|-------------|--------|-------------|
| `{{FILE_PATH}}` | `filePath` argument | The path passed to the tool |
| `{{FILE_CONTENT}}` | Read from disk | Full file contents |
| `{{MODEL_ID}}` | `DEEPINFRA_MODEL` env var | The LLM model being used |
| `{{CODE_ROOT}}` | `CODE_ROOT` env var | The root directory for analysis |

### Customizing the Prompt

Edit `src/deepinfraClient.ts` and modify the `prompt` template string. Here are ready-to-use templates:

#### Template A: Security-Focused Review

```typescript
const prompt = `
You are a cybersecurity specialist performing a security-focused code review.

File: ${filePath}

Focus exclusively on:
- SQL injection vulnerabilities
- XSS (Cross-Site Scripting) risks
- Authentication/authorization flaws
- Secrets or credentials in code
- Input validation gaps
- Dependency vulnerabilities (if imports are visible)
- OWASP Top 10 compliance

Rate each finding as: 🔴 Critical | 🟠 High | 🟡 Medium | 🟢 Low

Code:
\`\`\`
${code}
\`\`\`
`;
```

#### Template B: Performance Review

```typescript
const prompt = `
You are a performance engineer reviewing code for optimization opportunities.

File: ${filePath}

Analyze for:
- Time complexity of algorithms (Big-O)
- Memory leaks or excessive allocations
- Unnecessary re-renders (if React/frontend)
- N+1 query patterns (if database code)
- Blocking I/O operations
- Opportunities for caching
- Bundle size impact (if applicable)

Provide specific before/after code suggestions where possible.

Code:
\`\`\`
${code}
\`\`\`
`;
```

#### Template C: Team Standards Compliance

```typescript
const prompt = `
You are a code reviewer enforcing the following team standards:

**Our Standards:**
- {{TEAM_STYLE_GUIDE}}  // Replace with your style guide URL or rules
- Functions must not exceed 30 lines
- All public functions must have JSDoc comments
- No magic numbers — use named constants
- Error handling: never swallow exceptions silently
- Naming: camelCase for variables, PascalCase for classes
- Maximum cyclomatic complexity: 10

File: ${filePath}

For each violation found, provide:
1. Line reference (approximate)
2. Rule violated
3. Suggested fix

Code:
\`\`\`
${code}
\`\`\`
`;
```

#### Template D: Architecture Review

```typescript
const prompt = `
You are a software architect reviewing code for design quality.

File: ${filePath}

Evaluate:
- Single Responsibility Principle adherence
- Coupling and cohesion
- Dependency injection opportunities
- Interface segregation
- Layer violations (e.g., business logic in controllers)
- Testability (can this be unit tested easily?)
- Design pattern opportunities (Factory, Strategy, Observer, etc.)

Provide a score from 1-10 for overall design quality with justification.

Code:
\`\`\`
${code}
\`\`\`
`;
```

### After Editing the Prompt

Rebuild and the changes take effect immediately:

```bash
npm run build
```

> **Note:** You do NOT need to restart Antigravity. The MCP server is spawned fresh for each session.

---

## Usage Examples

### Basic File Analysis

Ask Antigravity naturally:

```
Review the code quality of src/controllers/userController.ts
```

### Batch Analysis

You can ask Antigravity to analyze multiple files:

```
Analyze the code quality of these files:
- src/models/User.ts
- src/services/AuthService.ts
- src/middleware/rateLimiter.ts
```

### Targeted Review

Combine with conversation context:

```
I'm about to merge this PR. Run a code quality check on
src/payment/stripeHandler.ts — focus on security concerns.
```

### Check Current Configuration

```
Show me the current code quality MCP configuration
```

---

## Advanced Configuration

### Switching Models

DeepInfra supports many models. Update `DEEPINFRA_MODEL` in your config:

| Model | Best For | Speed |
|-------|----------|-------|
| `meta-llama/Meta-Llama-3.1-70B-Instruct` | General reviews | Fast |
| `meta-llama/Meta-Llama-3.1-405B-Instruct` | Deep analysis, complex code | Slower |
| `Qwen/Qwen2.5-72B-Instruct` | Multi-language code support | Fast |
| `mistralai/Mixtral-8x22B-Instruct-v0.1` | Concise, structured output | Fast |

### Multiple MCP Instances

You can register the same server multiple times with different configs for different purposes:

```json
{
  "mcpServers": {
    "code-quality-security": {
      "command": "node",
      "args": ["/path/to/dist/server.js"],
      "env": {
        "DEEPINFRA_API_KEY": "{{YOUR_API_KEY}}",
        "DEEPINFRA_MODEL": "meta-llama/Meta-Llama-3.1-405B-Instruct",
        "CODE_ROOT": "/Users/you/projects"
      }
    },
    "code-quality-fast": {
      "command": "node",
      "args": ["/path/to/dist/server.js"],
      "env": {
        "DEEPINFRA_API_KEY": "{{YOUR_API_KEY}}",
        "DEEPINFRA_MODEL": "meta-llama/Meta-Llama-3.1-70B-Instruct",
        "CODE_ROOT": "/Users/you/projects"
      }
    }
  }
}
```

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `DEEPINFRA_API_KEY is not set` | Ensure the key is in `mcp_config.json` → `env` block |
| `File not found` | Check that `CODE_ROOT` points to the correct parent directory |
| `Access outside CODE_ROOT` | The file path must be within `CODE_ROOT` — use a broader root |
| `File too large` | Increase `MAX_FILE_SIZE_KB` or split the file |
| `DeepInfra API error: 401` | Your API key is invalid — get a new one from [deepinfra.com](https://deepinfra.com) |
| `DeepInfra API error: 429` | Rate limited — wait a moment and retry |
| Tool not appearing in Antigravity | Rebuild (`npm run build`), verify `mcp_config.json`, restart Antigravity |
