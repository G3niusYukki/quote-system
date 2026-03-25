import { Queue, Worker, type Processor } from "bullmq";
import Redis from "ioredis";

// Queue names
export const QUEUE_PARSE_EXCEL = "parse-excel";

// Redis connection config shared between Queue and Worker
function getRedisConfig() {
  const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";
  return { connection: new Redis(redisUrl, { maxRetriesPerRequest: null }) };
}

// Queue instances — imported by API routes to enqueue jobs
export function createParseExcelQueue(): Queue {
  return new Queue(QUEUE_PARSE_EXCEL, getRedisConfig());
}

// Lazy singleton for the queue (shared across API route invocations)
let _parseExcelQueue: Queue | undefined;

export function getParseExcelQueue(): Queue {
  if (!_parseExcelQueue) {
    _parseExcelQueue = createParseExcelQueue();
  }
  return _parseExcelQueue;
}

// Worker factory — called from the standalone worker entry point
export function createParseExcelWorker(processor: Processor): Worker {
  return new Worker(QUEUE_PARSE_EXCEL, processor, getRedisConfig());
}

// Export a raw Redis client for health-check / ping
export function getRedisClient(): Redis {
  const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";
  return new Redis(redisUrl, { maxRetriesPerRequest: null });
}
