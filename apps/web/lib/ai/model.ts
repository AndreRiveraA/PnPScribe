import { MODELS, type ChatModelTier } from "@/lib/openai";

export function pickChatModel(tier: ChatModelTier | undefined) {
  return tier === "strong" ? MODELS.strong : MODELS.cheap;
}
