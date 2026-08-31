export interface StructuredGenerationRequest<TSchema = unknown> {
  runId: string;
  guideId: string;
  guideVersion: string;
  system: string;
  prompt: string;
  schemaName: string;
  schema?: TSchema;
  timeoutMs?: number;
}

export interface StructuredGenerationResult<T> {
  provider: string;
  model: string;
  rawText: string;
  parsed: T;
  latencyMs: number;
  tokenUsage?: {
    input?: number;
    output?: number;
  };
}

export interface AIProvider {
  name: string;
  model: string;
  generateStructured<T>(request: StructuredGenerationRequest): Promise<StructuredGenerationResult<T>>;
}

export class ProviderError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
  }
}
