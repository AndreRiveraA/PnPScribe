import { NextResponse } from "next/server";

import path from "node:path";

import { prisma } from "@/lib/prisma";
import { parseDocumentId } from "@/lib/server/document-chunks";
import { enqueueEntityExtractionJob } from "@/lib/server/entity-queue";
import { getErrorMessage, getErrorStatus } from "@/lib/server/http-error";

export async function POST(
  _req: Request,
  context: { params: Promise<{ documentId: string }> },
) {
  try {
    const { documentId } = await context.params;
    const parsedDocumentId = parseDocumentId(documentId);

    const document = await prisma.document.findUnique({
      where: { id: parsedDocumentId },
      select: { id: true, systemId: true, filePath: true },
    });

    if (!document) {
      return NextResponse.json({ ok: false, error: "Document not found." }, { status: 404 });
    }

    const absolutePdfPath = document.filePath.startsWith("uploads/")
      ? path.resolve(process.cwd(), "..", "..", document.filePath)
      : document.filePath;

    await enqueueEntityExtractionJob({
      documentId: document.id,
      systemId: document.systemId,
      absolutePdfPath,
      requestedAt: new Date().toISOString(),
    });

    const updated = await prisma.document.update({
      where: { id: document.id },
      data: {
        entityStatus: "queued",
        entityError: null,
        entityProgressMessage: "Queued for entity extraction.",
        entityProgressUpdatedAt: new Date(),
      },
      select: {
        entityStatus: true,
        entityError: true,
        entityProgressMessage: true,
        entityProgressUpdatedAt: true,
      },
    });

    return NextResponse.json({ ok: true, document: updated });
  } catch (error) {
    console.error("POST /api/documents/[documentId]/entities/reprocess failed", error);
    return NextResponse.json(
      { ok: false, error: getErrorMessage(error, "Failed to queue entity extraction.") },
      { status: getErrorStatus(error, 500) },
    );
  }
}
