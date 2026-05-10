import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MCP_ROOT = path.resolve(__dirname, '..');
const SERVER_PATH = path.join(MCP_ROOT, 'dist', 'server.js');

const CONFIG_DIR = path.join(os.homedir(), '.gemini', 'antigravity');
const CONFIG_FILE = path.join(CONFIG_DIR, 'mcp_config.json');

console.log('==================================================');
console.log('🤖 Antigravity MCP Configuration Setup');
console.log('==================================================');

if (!fs.existsSync(CONFIG_DIR)) {
    console.log(`Creating directory: ${CONFIG_DIR}`);
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
}

let config = { mcpServers: {} };

if (fs.existsSync(CONFIG_FILE)) {
    try {
        const fileContent = fs.readFileSync(CONFIG_FILE, 'utf8');
        config = JSON.parse(fileContent);
        if (!config.mcpServers) config.mcpServers = {};
    } catch (e) {
        console.error(`❌ Error parsing existing mcp_config.json: ${e.message}`);
        console.log('Starting with a fresh configuration.');
    }
}

config.mcpServers['deepinfra-code-quality'] = {
    command: 'node',
    args: [SERVER_PATH],
    env: {
        DEEPINFRA_API_KEY: process.env.DEEPINFRA_API_KEY || 'your-api-key-here',
        DEEPINFRA_MODEL: process.env.DEEPINFRA_MODEL || 'meta-llama/Meta-Llama-3.1-70B-Instruct',
        CODE_ROOT: process.env.CODE_ROOT || os.homedir()
    }
};

try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8');
    console.log(`✅ Successfully updated Antigravity MCP configuration!`);
    console.log(`   Config file: ${CONFIG_FILE}`);
    console.log(`   Added server: 'deepinfra-code-quality'`);
    console.log(`\n⚠️  IMPORTANT: Please ensure you replace 'your-api-key-here' in ${CONFIG_FILE}`);
    console.log(`   with your actual DeepInfra API key if you haven't already.`);
} catch (e) {
    console.error(`❌ Failed to write to mcp_config.json: ${e.message}`);
}
