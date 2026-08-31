import { GoogleGenAI } from "@google/genai";
import type { AIProvider, StructuredGenerationRequest, StructuredGenerationResult } from "./provider.js";
import { ProviderError } from "./provider.js";

export class GeminiProvider implements AIProvider {
  readonly name = "gemini";
  readonly model: string;
  private readonly client: GoogleGenAI;

  constructor(apiKey = process.env.GEMINI_API_KEY, model = process.env.GEMINI_MODEL || "gemini-3.6-flash") {
    if (!apiKey) {
      throw new ProviderError("GEMINI_API_KEY is required for real Gemini mode. Demo/tests use MockAIProvider.", "missing_api_key");
    }
    this.model = model;
    this.client = new GoogleGenAI({ apiKey });
  }

  async generateStructured<T>(request: StructuredGenerationRequest): Promise<StructuredGenerationResult<T>> {
    const started = Date.now();
    try {
      const response = await this.client.models.generateContent({
        model: this.model,
        contents: `${request.system}\n\n${request.prompt}`,
        config: {
          responseMimeType: "application/json",
          responseSchema: request.schema as Record<string, unknown> | undefined
        }
      });
      const rawText = response.text ?? "";
      if (!rawText.trim()) throw new ProviderError("Gemini returned an empty response.", "empty_response");
      let parsed: T;
      try {
        parsed = JSON.parse(rawText) as T;
      } catch {
        throw new ProviderError("Gemini returned malformed structured output.", "malformed_structured_output");
      }
      return {
        provider: this.name,
        model: this.model,
        rawText,
        parsed,
        latencyMs: Date.now() - started,
        tokenUsage: {
          input: response.usageMetadata?.promptTokenCount,
          output: response.usageMetadata?.candidatesTokenCount
        }
      };
    } catch (error) {
      if (error instanceof ProviderError) throw error;
      const message = error instanceof Error ? error.message : String(error);
      const code = /rate/i.test(message) ? "rate_limited" : /timeout/i.test(message) ? "timeout" : "provider_failure";
      throw new ProviderError(`Gemini request failed: ${message}`, code);
    }
  }
}
