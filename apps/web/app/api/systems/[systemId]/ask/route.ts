import { NextResponse } from "next/server";

import { parseChatModelTier } from "@/lib/server/ai-ping";
import {
  answerRulesQuestion,
  parseRulesQuestion,
} from "@/lib/server/rules-query";
import { getErrorMessage, getErrorStatus } from "@/lib/server/http-error";

export async function POST(
  req: Request,
  context: { params: Promise<{ systemId: string }> },
) {
  try {
    const { systemId } = await context.params;
    const body = (await req.json()) as { question?: unknown; tier?: unknown };
    const question = parseRulesQuestion(body.question);
    const tier =
      typeof body.tier === "string" ? parseChatModelTier(body.tier) : undefined;

    const result = await answerRulesQuestion({ systemId, question, tier });

    return NextResponse.json({
      ok: true,
      ...result,
    });
  } catch (error) {
    console.error("POST /api/systems/[systemId]/ask failed", error);
    return NextResponse.json(
      { ok: false, error: getErrorMessage(error, "Rules query failed.") },
      { status: getErrorStatus(error, 500) },
    );
  }
}
