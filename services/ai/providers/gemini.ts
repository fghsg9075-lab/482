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

        // Sanitize Model ID (Fix 404s by stripping suffixes like -001, -latest, -beta)
        // The v1 API strictly requires 'gemini-1.5-flash' or 'gemini-1.5-pro'
        let modelName = options.model.modelId;
        if (modelName.startsWith('gemini-1.5-flash')) modelName = 'gemini-1.5-flash';
        else if (modelName.startsWith('gemini-1.5-pro')) modelName = 'gemini-1.5-pro';

        // Pass mapped tools to model configuration
        const model = genAI.getGenerativeModel({
            model: modelName,
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
