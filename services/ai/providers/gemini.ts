import { BaseAIProvider, AIRequestOptions, AIResponse } from "./base";
import { GoogleGenerativeAI } from "@google/generative-ai";

export class GeminiProvider extends BaseAIProvider {
    id = "gemini";

    async validate(apiKey: string): Promise<boolean> {
        return apiKey.length > 10;
    }

    private mapTools(tools: any[]) {
        if (!tools || tools.length === 0) return undefined;
        // Mapping OpenAI/Standard tool schema to Gemini
        return tools.map((t: any) => ({
            functionDeclarations: [{
                name: t.function.name,
                description: t.function.description,
                parameters: t.function.parameters
            }]
        }));
    }

    async generateContent(apiKey: string, options: AIRequestOptions): Promise<AIResponse> {
        const genAI = new GoogleGenerativeAI(apiKey);

        // Sanitize Model ID (Strip models/ prefix and version suffixes like -001)
        let cleanModelId = options.model.modelId.replace(/^models\//, '');
        // Strip specific version suffixes to use the rolling alias (e.g. gemini-1.5-pro-001 -> gemini-1.5-pro)
        // This helps avoid 404s when specific versions are deprecated or if v1beta expects the alias
        cleanModelId = cleanModelId.replace(/-[0-9]{3}$/, '').replace(/-latest$/, '');

        // Pass mapped tools to model configuration
        const model = genAI.getGenerativeModel({
            model: cleanModelId,
            systemInstruction: options.systemPrompt,
            tools: options.tools ? this.mapTools(options.tools) : undefined
        });

        const generationConfig: any = {};
        if (options.temperature) generationConfig.temperature = options.temperature;
        if (options.maxTokens) generationConfig.maxOutputTokens = options.maxTokens;
        if (options.jsonMode) generationConfig.responseMimeType = "application/json";

        const result = await model.generateContent({
            contents: [{ role: "user", parts: [{ text: options.prompt }] }],
            generationConfig
        });

        const response = result.response;

        // Parse Tool Calls from Response
        const functionCalls = response.functionCalls();
        const toolCalls = functionCalls ? functionCalls.map(fc => ({
            name: fc.name,
            args: fc.args
        })) : undefined;

        return {
            content: response.text(),
            toolCalls: toolCalls, // Return parsed tool calls
            inputTokens: response.usageMetadata?.promptTokenCount,
            outputTokens: response.usageMetadata?.candidatesTokenCount
        };
    }
}
