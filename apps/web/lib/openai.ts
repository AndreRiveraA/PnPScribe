import OpenAI from "openai";

const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey) {
  throw new Error("Missing OPENAI_API_KEY in environment.");
}

export const openai = new OpenAI({ apiKey });

export const MODELS = {
  cheap: process.env.AI_MODEL_CHEAP ?? "gpt-4o-mini",
  strong: process.env.AI_MODEL_STRONG ?? "gpt-4.1",
  embed: process.env.AI_EMBED_MODEL ?? "text-embedding-3-small",
} as const;

export type ChatModelTier = keyof Pick<typeof MODELS, "cheap" | "strong">;
