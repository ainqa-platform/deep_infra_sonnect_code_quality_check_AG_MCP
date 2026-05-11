import fs from 'fs';
import path from 'path';
import os from 'os';
import 'dotenv/config';
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
        DEEPINFRA_BASE_URL: process.env.DEEPINFRA_BASE_URL || 'https://api.deepinfra.com/v1/openai',
        DEEPINFRA_MODEL: process.env.DEEPINFRA_MODEL || 'meta-llama/Meta-Llama-3.1-70B-Instruct',
        CODE_ROOT: process.env.CODE_ROOT || './',
        MAX_FILE_SIZE_KB: process.env.MAX_FILE_SIZE_KB || '512',
        MAX_RETRIES: process.env.MAX_RETRIES || '3',
        REQUEST_DELAY_MS: process.env.REQUEST_DELAY_MS || '8000'
    }
};

try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8');
    console.log(`✅ Successfully updated Antigravity MCP configuration!`);
    console.log(`   Config file: ${CONFIG_FILE}`);
} catch (e) {
    console.error(`❌ Failed to write to mcp_config.json: ${e.message}`);
}

// ============================================================================
// Configure VSCode (Cline / Roo Cline)
// ============================================================================
function getVSCodeGlobalStorageDir() {
    const platform = os.platform();
    const home = os.homedir();
    
    if (platform === 'darwin') {
        return path.join(home, 'Library', 'Application Support', 'Code', 'User', 'globalStorage');
    } else if (platform === 'win32') {
        const appData = process.env.APPDATA || path.join(home, 'AppData', 'Roaming');
        return path.join(appData, 'Code', 'User', 'globalStorage');
    } else {
        return path.join(home, '.config', 'Code', 'User', 'globalStorage');
    }
}

const globalStorageDir = getVSCodeGlobalStorageDir();
const VSCODE_CLINE_DIR = path.join(globalStorageDir, 'saoudrizwan.claude-dev', 'settings');
const VSCODE_ROO_DIR = path.join(globalStorageDir, 'rooveterinaryinc.roo-cline', 'settings');

const setupVSCodeConfig = (settingsDir, extensionName) => {
    if (!fs.existsSync(settingsDir)) {
        try {
            fs.mkdirSync(settingsDir, { recursive: true });
        } catch (e) {
            return; // Extension might not be installed, skip silently
        }
    }

    const clineConfigFile = path.join(settingsDir, 'cline_mcp_settings.json');
    let clineConfig = { mcpServers: {} };

    if (fs.existsSync(clineConfigFile)) {
        try {
            const fileContent = fs.readFileSync(clineConfigFile, 'utf8');
            clineConfig = JSON.parse(fileContent);
            if (!clineConfig.mcpServers) clineConfig.mcpServers = {};
        } catch (e) {
            console.error(`❌ Error parsing existing ${extensionName} MCP config: ${e.message}`);
        }
    }

    clineConfig.mcpServers['deepinfra-code-quality'] = config.mcpServers['deepinfra-code-quality'];

    try {
        fs.writeFileSync(clineConfigFile, JSON.stringify(clineConfig, null, 2), 'utf8');
        console.log(`✅ Successfully updated VSCode ${extensionName} MCP configuration!`);
        console.log(`   Config file: ${clineConfigFile}`);
    } catch (e) {
        console.error(`❌ Failed to write to ${extensionName} config: ${e.message}`);
    }
};

setupVSCodeConfig(VSCODE_CLINE_DIR, 'Cline (Claude Dev)');
setupVSCodeConfig(VSCODE_ROO_DIR, 'Roo Cline');

console.log(`\n⚠️  IMPORTANT: Please ensure you replace 'your-api-key-here' in the config files`);
console.log(`   with your actual DeepInfra API key if you haven't already.`);
