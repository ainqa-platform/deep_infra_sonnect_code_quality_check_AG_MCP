#!/usr/bin/env bash
set -e

echo "=================================================="
echo "🚀 Installing DeepInfra Code Quality MCP & CLI..."
echo "=================================================="

# Check for Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Error: Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo "❌ Error: npm is not installed. Please install npm first."
    exit 1
fi

echo "📦 Installing dependencies..."
npm install

echo "🔨 Building project..."
npm run build

echo "🔗 Linking 'diq' CLI command globally..."
# Make the script executable just in case
chmod +x scripts/audit-repo.js
# npm link makes the binary available globally
npm link

echo "=================================================="
echo "✅ Installation Complete!"
echo "=================================================="
echo ""
echo "You can now use the CLI from anywhere:"
echo "  $ diq help"
echo ""
echo "To use the MCP server in Antigravity, add this to your ~/.gemini/antigravity/mcp_config.json:"
echo "{"
echo "  \"mcpServers\": {"
echo "    \"deepinfra-code-quality\": {"
echo "      \"command\": \"node\","
echo "      \"args\": [\"$(pwd)/dist/server.js\"],"
echo "      \"env\": {"
echo "        \"DEEPINFRA_API_KEY\": \"your-api-key\","
echo "        \"CODE_ROOT\": \"/path/to/your/code\""
echo "      }"
echo "    }"
echo "  }"
echo "}"
echo ""
