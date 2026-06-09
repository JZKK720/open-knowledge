import { describe, expect, test } from 'bun:test';
import {
  __resetEmbeddingsTelemetryForTesting,
  recordEmbeddingProviderError,
  recordEmbeddingRequestDuration,
  recordEmbeddingTokens,
  recordSemanticQuery,
} from './embeddings-telemetry.ts';

describe('embeddings telemetry', () => {
  test('all record paths are no-throw under the default provider', () => {
    expect(() => {
      recordEmbeddingTokens('query', 12);
      recordEmbeddingTokens('document', 0); // zero tokens → skipped, still no throw
      recordEmbeddingProviderError('rate_limit');
      recordEmbeddingProviderError('dims_mismatch');
      recordEmbeddingRequestDuration('document', 123.4);
      recordSemanticQuery({
        outcome: 'applied',
        capable: true,
        embedded: 5,
        total: 40,
        queryEmbedMs: 87.2,
        vectorContributors: 3,
      });
      recordSemanticQuery({
        outcome: 'incapable',
        capable: false,
        embedded: 0,
        total: 0,
        queryEmbedMs: null,
        vectorContributors: 0,
      });
      __resetEmbeddingsTelemetryForTesting();
    }).not.toThrow();
  });
});
