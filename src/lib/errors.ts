export class VisualizeError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'VisualizeError';
  }
}

export function safeError(error: unknown): VisualizeError {
  return error instanceof VisualizeError
    ? error
    : new VisualizeError(
        'INTERNAL_ERROR',
        'Visualization failed. Check the input and try again.',
      );
}

export function logFailure(error: unknown): void {
  // Third-party errors may include the entire plan; log categories, never input.
  const failure = safeError(error);
  console.error(`[plan-viz-mcp] ${failure.code}`);
}

export function cancellationError(signal: AbortSignal): VisualizeError {
  return signal.reason instanceof VisualizeError
    ? signal.reason
    : new VisualizeError('CANCELLED', 'Visualization cancelled.');
}
