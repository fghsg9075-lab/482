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
        const model = genAI.getGenerativeModel({
            model: options.model.modelId,
            systemInstruction: options.systemPrompt
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
        return {
            content: response.text(),
            inputTokens: response.usageMetadata?.promptTokenCount,
            outputTokens: response.usageMetadata?.candidatesTokenCount
        };
    }
}
