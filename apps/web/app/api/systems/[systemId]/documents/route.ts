import { NextResponse } from "next/server";
import { listDocumentsForSystem, parseSystemId } from "@/lib/server/documents";
import { getErrorMessage, getErrorStatus } from "@/lib/server/http-error";

export async function GET(
  _req: Request,
  context: { params: Promise<{ systemId: string }> },
) {
  try {
    const { systemId } = await context.params;
    const parsedSystemId = parseSystemId(systemId);
    const system = await listDocumentsForSystem(parsedSystemId);

    return NextResponse.json({
      ok: true,
      system: {
        id: system.id,
        name: system.name,
      },
      documents: system.documents,
    });
  } catch (error) {
    console.error("GET /api/systems/[systemId]/documents failed", error);
    return NextResponse.json(
      { ok: false, error: getErrorMessage(error, "Failed to load documents.") },
      { status: getErrorStatus(error, 500) },
    );
  }
}
