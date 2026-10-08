import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const DEFAULT_MAX_ATTEMPTS = 3;

function isSerializationConflict(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034';
}

function wait(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

/**
 * Runs a serializable transaction and retries serialization conflicts with
 * bounded exponential backoff. Callers must keep the transaction callback
 * idempotent because a retry re-executes the read/write sequence.
 */
export async function withSerializableRetry<T>(
  prisma: PrismaService,
  operation: (tx: Prisma.TransactionClient) => Promise<T>,
  options: { maxAttempts?: number; timeoutMs?: number } = {},
): Promise<T> {
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await prisma.$transaction(operation, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 5_000,
        timeout: options.timeoutMs ?? 15_000,
      });
    } catch (error) {
      lastError = error;
      if (!isSerializationConflict(error) || attempt === maxAttempts) throw error;
      await wait(25 * 2 ** (attempt - 1));
    }
  }

  throw lastError;
}
