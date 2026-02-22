import "server-only";

import { prisma } from "@/lib/prisma";
import { chunkText } from "@/lib/server/text-chunking";

export async function replaceChunksForDocument(documentId: string, text: string) {
  const chunks = chunkText(text);

  await prisma.$transaction([
    prisma.chunk.deleteMany({
      where: { documentId },
    }),
    ...(chunks.length > 0
      ? [
          prisma.chunk.createMany({
            data: chunks.map((chunk) => ({
              documentId,
              content: chunk.content,
              chunkIndex: chunk.index,
              pageNumber: chunk.pageNumber,
              chapterHint: chunk.chapterHint,
            })),
          }),
        ]
      : []),
  ]);

  return {
    chunkCount: chunks.length,
  };
}
