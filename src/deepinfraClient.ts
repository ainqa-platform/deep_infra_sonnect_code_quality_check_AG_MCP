import { CONFIG } from "./config.js";

export async function analyzeCodeQuality(
    filePath: string,
    code: string
): Promise<string> {
    const prompt = `
You are a senior software engineer performing a code quality review.

File: ${filePath}

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
${code}
\`\`\`
`;

    const response = await fetch(
        `${CONFIG.deepinfraBaseUrl}/chat/completions`,
        {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${CONFIG.deepinfraApiKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: CONFIG.deepinfraModel,
                messages: [
                    {
                        role: "user",
                        content: prompt
                    }
                ]
            })
        }
    );

    if (!response.ok) {
        const text = await response.text();
        throw new Error(
            `DeepInfra API error: ${response.status} ${response.statusText} - ${text}`
        );
    }

    const json: any = await response.json();
    const content = json.choices?.[0]?.message?.content;
    if (!content) {
        throw new Error("DeepInfra returned no content.");
    }

    return content;
}
