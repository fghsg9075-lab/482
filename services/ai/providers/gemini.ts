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

        // Pass mapped tools to model configuration
        // Force API version to v1beta to ensure compatibility with newer models if needed,
        // or rely on SDK default. However, to fix 404s with 'gemini-1.5-flash',
        // we explicitly set the apiVersion if the SDK supports it in this version.
        // NOTE: The nodejs SDK might not expose apiVersion in getGenerativeModel directly in all versions.
        // But checking docs, it takes a RequestOptions or similar.
        // Actually, the error "models/gemini-1.5-flash-001 is not found for API version v1beta" implies
        // we are HITTING v1beta by default.
        // Google has moved 1.5 Flash to v1.
        // We need to try to force v1.

        const modelParams: any = {
            model: options.model.modelId,
            systemInstruction: options.systemPrompt,
            tools: options.tools ? this.mapTools(options.tools) : undefined
        };

        // Attempt to force v1 via undocumented or RequestOptions if possible.
        // If the SDK version is ^0.21.0, it should default to v1beta but support v1 models?
        // Wait, the user said "gemini-1.5-flash ... is not supported for generateContent" in v1beta.
        // So we MUST use v1.

        const model = genAI.getGenerativeModel(modelParams, { apiVersion: 'v1' });

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
