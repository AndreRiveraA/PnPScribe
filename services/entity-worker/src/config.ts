import { fileURLToPath } from "node:url";

const parsedConfidence = Number(process.env.ENTITY_CONFIDENCE_THRESHOLD ?? "0.5");

export const config = {
  redisUrl: process.env.REDIS_URL ?? "redis://127.0.0.1:6379",
  databaseUrl: process.env.DATABASE_URL ?? "",
  openAiApiKey: process.env.OPENAI_API_KEY ?? "",
  entityQueueName: process.env.ENTITY_QUEUE_NAME ?? "entity-extraction-jobs",
  entityModel: process.env.AI_MODEL_CHEAP ?? "gpt-4o-mini",
  confidenceThreshold: Number.isFinite(parsedConfidence)
    ? Math.max(0, Math.min(1, parsedConfidence))
    : 0.5,
  imageExtractionEnabled: process.env.ENTITY_IMAGE_EXTRACTION_ENABLED !== "false",
  imageMaxPages: Number(process.env.ENTITY_IMAGE_MAX_PAGES ?? "3"),
  imageTargetWidth: Number(process.env.ENTITY_IMAGE_TARGET_WIDTH ?? "1400"),
  projectRoot:
    process.env.PNPSCRIBE_ROOT ??
    fileURLToPath(new URL("../../..", import.meta.url)),
  ruleLinkWindow: Number(process.env.ENTITY_RULE_LINK_WINDOW ?? "10"),
} as const;

if (!config.databaseUrl) {
  throw new Error("Missing DATABASE_URL for entity worker.");
}

if (!config.openAiApiKey) {
  throw new Error("Missing OPENAI_API_KEY for entity worker.");
}
