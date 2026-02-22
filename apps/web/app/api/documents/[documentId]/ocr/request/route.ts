import { NextResponse } from "next/server";

import { parseDocumentId } from "@/lib/server/document-chunks";
import { enqueueOcrFallbackStub } from "@/lib/server/ocr-fallback";
import { getErrorMessage, getErrorStatus } from "@/lib/server/http-error";

export async function POST(
  _req: Request,
  context: { params: Promise<{ documentId: string }> },
) {
  try {
    const { documentId } = await context.params;
    const parsedDocumentId = parseDocumentId(documentId);
    const result = await enqueueOcrFallbackStub(parsedDocumentId);

    return NextResponse.json({
      ok: true,
      ...result,
    });
  } catch (error) {
    console.error("POST /api/documents/[documentId]/ocr/request failed", error);
    return NextResponse.json(
      { ok: false, error: getErrorMessage(error, "Failed to request OCR fallback.") },
      { status: getErrorStatus(error, 500) },
    );
  }
}
