import "dotenv/config";
import type { AIProvider } from "./provider.js";
import { GeminiProvider } from "./gemini.provider.js";
import { MockAIProvider } from "./mock.provider.js";

export function createProvider(mode = process.env.HARNESS_PROVIDER ?? "gemini"): AIProvider {
  if (mode === "mock") return new MockAIProvider();
  return new GeminiProvider();
}
