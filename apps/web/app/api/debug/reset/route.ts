import { NextResponse } from "next/server";

import { resetQueuesAndStatus } from "@/lib/server/queue-admin";
import { getErrorMessage, getErrorStatus } from "@/lib/server/http-error";

export async function POST() {
  try {
    await resetQueuesAndStatus();
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("POST /api/debug/reset failed", error);
    return NextResponse.json(
      { ok: false, error: getErrorMessage(error, "Failed to reset queues.") },
      { status: getErrorStatus(error, 500) },
    );
  }
}
