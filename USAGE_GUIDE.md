# DeepInfra Code Quality MCP — Integration Guide

> How to use the MCP Server in Antigravity or other MCP-compatible clients.
> *(If you are looking for the CLI `diq` tool documentation, see [AUDIT_WORKFLOW.md](./AUDIT_WORKFLOW.md)).*

---

## Table of Contents

- [Quick Start](#quick-start)
- [Using in Any Repository](#using-in-any-repository)
- [Advanced Configuration](#advanced-configuration)
- [Troubleshooting](#troubleshooting)

---

## Quick Start

Once the toolkit is installed via `./install.sh`, the MCP server is built and ready.

You can configure Antigravity to use it by editing `~/.gemini/antigravity/mcp_config.json`:

```json
{
  "mcpServers": {
    "deepinfra-code-quality": {
      "command": "node",
      "args": ["/absolute/path/to/deep_infra_sonnect_code_quality_check_AG_MCP/dist/server.js"],
      "env": {
        "DEEPINFRA_API_KEY": "YOUR_API_KEY",
        "DEEPINFRA_MODEL": "meta-llama/Meta-Llama-3.1-70B-Instruct",
        "CODE_ROOT": "/absolute/path/to/your/code"
      }
    }
  }
}
```

Restart Antigravity and you can immediately ask in chat:

```
Analyze the code quality of src/app.ts
```

Antigravity will automatically invoke the `code_quality_check` tool and return a structured review.

---

## Using in Any Repository

### Use a Parent Directory for Multi-Repo Access

To analyze files across **multiple repositories**, set `CODE_ROOT` to a parent directory of all your projects:

```json
"CODE_ROOT": "/Users/you/projects"
```

Then in Antigravity, reference files with paths relative to that parent directory:

```
Analyze the code quality of my-app/src/index.ts
Analyze the code quality of another-repo/lib/utils.py
```

---

## Advanced Configuration

### Switching Models

DeepInfra supports many open-source models. Update the `DEEPINFRA_MODEL` environment variable in your `mcp_config.json`:

| Model | Best For | Speed |
|-------|----------|-------|
| `meta-llama/Meta-Llama-3.1-70B-Instruct` | General reviews | Fast |
| `meta-llama/Meta-Llama-3.1-405B-Instruct` | Deep analysis, complex code | Slower |
| `Qwen/Qwen2.5-72B-Instruct` | Multi-language code support | Fast |
| `mistralai/Mixtral-8x22B-Instruct-v0.1` | Concise, structured output | Fast |

### Multiple MCP Instances

You can register the same server multiple times with different configurations for different purposes:

```json
{
  "mcpServers": {
    "code-quality-deep": {
      "command": "node",
      "args": ["/path/to/dist/server.js"],
      "env": {
        "DEEPINFRA_API_KEY": "YOUR_API_KEY",
        "DEEPINFRA_MODEL": "meta-llama/Meta-Llama-3.1-405B-Instruct",
        "CODE_ROOT": "/Users/you/projects"
      }
    },
    "code-quality-fast": {
      "command": "node",
      "args": ["/path/to/dist/server.js"],
      "env": {
        "DEEPINFRA_API_KEY": "YOUR_API_KEY",
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
| `File too large` | Increase `MAX_FILE_SIZE_KB` in the env block |
| `Input too long` | Reduce `MAX_FILE_SIZE_KB` or use a model with a larger context |
| `DeepInfra API error: 401` | Your API key is invalid — get a new one from [deepinfra.com](https://deepinfra.com) |
| `DeepInfra API error: 429` | Rate limited — wait a moment and retry |
| Tool not appearing in Antigravity | Rebuild (`npm run build`), verify `mcp_config.json`, restart Antigravity |
