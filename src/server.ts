#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { CONFIG } from "./config.js";
import { resolveFilePath, readCodeFile } from "./fileScanner.js";
import { analyzeCodeQuality } from "./deepinfraClient.js";

// Create the MCP server
const server = new McpServer({
    name: "deepinfra-code-quality-mcp",
    version: "1.0.0",
});

// Register the code quality analysis tool
server.tool(
    "code_quality_check",
    "Analyze code quality of a local file using DeepInfra LLM. Returns a structured review covering readability, maintainability, bugs, security, refactoring suggestions, and anti-patterns.",
    {
        filePath: z
            .string()
            .describe("Relative or absolute path to the file to analyze"),
    },
    async ({ filePath }) => {
        try {
            if (!CONFIG.deepinfraApiKey) {
                return {
                    content: [
                        {
                            type: "text" as const,
                            text: "Error: DEEPINFRA_API_KEY is not set. Please configure it in the .env file or environment.",
                        },
                    ],
                    isError: true,
                };
            }

            const absPath = resolveFilePath(filePath);
            const code = readCodeFile(absPath);
            const review = await analyzeCodeQuality(filePath, code);

            return {
                content: [
                    {
                        type: "text" as const,
                        text: `## Code Quality Review: ${filePath}\n\n${review}`,
                    },
                ],
            };
        } catch (err: any) {
            return {
                content: [
                    {
                        type: "text" as const,
                        text: `Error analyzing ${filePath}: ${err.message}`,
                    },
                ],
                isError: true,
            };
        }
    }
);

// Register a tool to list supported info
server.tool(
    "code_quality_config",
    "Show current DeepInfra code quality MCP configuration (model, base URL, code root, max file size).",
    {},
    async () => {
        return {
            content: [
                {
                    type: "text" as const,
                    text: JSON.stringify(
                        {
                            model: CONFIG.deepinfraModel,
                            baseUrl: CONFIG.deepinfraBaseUrl,
                            codeRoot: CONFIG.codeRoot,
                            maxFileSizeKb: CONFIG.maxFileSizeKb,
                            apiKeyConfigured: !!CONFIG.deepinfraApiKey,
                        },
                        null,
                        2
                    ),
                },
            ],
        };
    }
);

// Start the server
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("DeepInfra Code Quality MCP server running on stdio");
}

main().catch((err) => {
    console.error("Fatal error starting MCP server:", err);
    process.exit(1);
});
