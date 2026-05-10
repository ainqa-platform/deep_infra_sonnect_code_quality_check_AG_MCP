import dotenv from "dotenv";
dotenv.config();

export const CONFIG = {
    deepinfraApiKey: process.env.DEEPINFRA_API_KEY || "",
    deepinfraBaseUrl:
        process.env.DEEPINFRA_BASE_URL || "https://api.deepinfra.com/v1/openai",
    deepinfraModel:
        process.env.DEEPINFRA_MODEL || "meta-llama/Meta-Llama-3.1-70B-Instruct",
    codeRoot: process.env.CODE_ROOT || "./",
    maxFileSizeKb: Number(process.env.MAX_FILE_SIZE_KB || "256")
};

if (!CONFIG.deepinfraApiKey) {
    console.error("[deepinfra-code-quality-mcp] WARNING: DEEPINFRA_API_KEY is not set.");
}
