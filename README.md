# DeepInfra Code Quality Toolkit

A powerful toolkit that provides AI-driven code quality reviews via DeepInfra. It includes:
1. **`diq` CLI Tool** — A standalone command-line application to run batch code quality audits inside any repository.
2. **MCP Server** — A Model Context Protocol server to allow AI agents like **Antigravity** to run on-demand code quality checks.

---

## 🚀 Installation

We provide an automatic install script that sets up dependencies, builds the project, and links the CLI tool globally.

```bash
# Clone the repository
git clone https://github.com/ainqa-platform/deep_infra_sonnect_code_quality_check_AG_MCP.git
cd deep_infra_sonnect_code_quality_check_AG_MCP

# Run the install script
./install.sh
```

Ensure you have your environment variables set up (either exported in your shell or inside a `.env` file in the repo):

```bash
cp .env.example .env
# Edit .env and insert your DEEPINFRA_API_KEY
```

---

## 💻 1. Using the `diq` CLI

The `diq` (DeepInfra Quality) CLI lets you run batch code reviews in any of your local repositories.

### Quick Start

Navigate to the repository you want to audit:

```bash
cd /path/to/your/project
git checkout -b quality-audit

# 1. Initialize the audit (scaffolds PROMPT.md)
diq init

# 2. Open PROMPT.md and customize what you want the AI to look for.

# 3. Run the audit
diq run
```

This will analyze the files and output a comprehensive `CODE_QUALITY_REPORT.md` inside the repository.

For more details on CLI options and templates, see [AUDIT_WORKFLOW.md](./AUDIT_WORKFLOW.md).

---

## 🤖 2. Using the MCP Server (Antigravity Integration)

If you use Antigravity or any other MCP-compatible AI agent, you can configure it to use this server.

Add the following to your `~/.gemini/antigravity/mcp_config.json`:

```json
{
  "mcpServers": {
    "deepinfra-code-quality": {
      "command": "node",
      "args": ["/absolute/path/to/deep_infra_sonnect_code_quality_check_AG_MCP/dist/server.js"],
      "env": {
        "DEEPINFRA_API_KEY": "your-key-here",
        "DEEPINFRA_MODEL": "meta-llama/Meta-Llama-3.1-70B-Instruct",
        "CODE_ROOT": "/path/to/your/projects/directory"
      }
    }
  }
}
```

Restart your agent, and you can now ask it to:
> *"Analyze the code quality of src/app.js"*

For more information on setting up the MCP server, see [USAGE_GUIDE.md](./USAGE_GUIDE.md).

---

## Configuration Variables

These apply to both the CLI and the MCP server.

| Variable | Default | Description |
|----------|---------|-------------|
| `DEEPINFRA_API_KEY` | *(required)* | Your DeepInfra API key |
| `DEEPINFRA_BASE_URL` | `https://api.deepinfra.com/v1/openai` | DeepInfra API endpoint |
| `DEEPINFRA_MODEL` | `meta-llama/Meta-Llama-3.1-70B-Instruct` | Model to use for analysis |
| `MAX_FILE_SIZE_KB` | `256` | Maximum file size to analyze (files larger are skipped) |
| `CODE_ROOT` | `./` | Root directory for file access (MCP Server only) |
