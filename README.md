# DeepInfra Code Quality MCP Server

A custom MCP (Model Context Protocol) server for **Antigravity** that uses the DeepInfra API to perform AI-powered code quality reviews.

## Tools

| Tool | Description |
|------|-------------|
| `code_quality_check` | Analyze a local file for readability, bugs, security, and anti-patterns |
| `code_quality_config` | Show current server configuration |

## Setup

### 1. Install & Build

```bash
npm install
npm run build
```

### 2. Configure Environment

Copy `.env.example` to `.env` and set your DeepInfra API key:

```bash
cp .env.example .env
# Edit .env with your DEEPINFRA_API_KEY
```

### 3. Register in Antigravity

Add to `~/.gemini/antigravity/mcp_config.json`:

```json
{
  "mcpServers": {
    "deepinfra-code-quality": {
      "command": "node",
      "args": ["/absolute/path/to/dist/server.js"],
      "env": {
        "DEEPINFRA_API_KEY": "your-key",
        "DEEPINFRA_MODEL": "meta-llama/Meta-Llama-3.1-70B-Instruct",
        "CODE_ROOT": "/path/to/your/code"
      }
    }
  }
}
```

### 4. Restart Antigravity

The MCP server will be available automatically after restart.

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `DEEPINFRA_API_KEY` | *(required)* | Your DeepInfra API key |
| `DEEPINFRA_BASE_URL` | `https://api.deepinfra.com/v1/openai` | DeepInfra API endpoint |
| `DEEPINFRA_MODEL` | `meta-llama/Meta-Llama-3.1-70B-Instruct` | Model to use for analysis |
| `CODE_ROOT` | `./` | Root directory for file access |
| `MAX_FILE_SIZE_KB` | `256` | Maximum file size to analyze |

## Architecture

```
src/
├── server.ts          # MCP server entry point (McpServer + StdioServerTransport)
├── config.ts          # Environment configuration loader
├── deepinfraClient.ts # DeepInfra OpenAI-compatible API client
└── fileScanner.ts     # File resolution and reading with security guards
```
