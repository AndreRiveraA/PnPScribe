import { NextResponse } from "next/server";

import { getSystemIndexingStatus } from "@/lib/server/indexing-status";
import { getErrorMessage, getErrorStatus } from "@/lib/server/http-error";

export async function GET(
  _req: Request,
  context: { params: Promise<{ systemId: string }> },
) {
  try {
    const { systemId } = await context.params;
    const result = await getSystemIndexingStatus(systemId);

    return NextResponse.json({
      ok: true,
      ...result,
    });
  } catch (error) {
    console.error("GET /api/systems/[systemId]/indexing-status failed", error);
    return NextResponse.json(
      { ok: false, error: getErrorMessage(error, "Failed to load indexing status.") },
      { status: getErrorStatus(error, 500) },
    );
  }
}
