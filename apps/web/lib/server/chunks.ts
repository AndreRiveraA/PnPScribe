import "server-only";

import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { chunkText, classifyChunksAndBuildGroups } from "@/lib/server/text-chunking";

type TransactionFn = Extract<
  Parameters<typeof prisma.$transaction>[0],
  (tx: any) => Promise<unknown>
>;
type TransactionClient = Parameters<TransactionFn>[0];

export async function replaceChunksForDocument(documentId: string, text: string) {
  const baseChunks = chunkText(text);
  const planned = classifyChunksAndBuildGroups(baseChunks);

  await prisma.$transaction(async (tx: TransactionClient) => {
    await tx.chunk.deleteMany({ where: { documentId } });
    await tx.chunkGroup.deleteMany({ where: { documentId } });

    if (planned.groups.length === 0 || planned.chunks.length === 0) {
      return;
    }

    const createdGroups = await Promise.all(
      planned.groups.map((group) =>
        tx.chunkGroup.create({
          data: {
            documentId,
            groupIndex: group.groupIndex,
            kind: group.kind,
            title: group.title,
            chapterHint: group.chapterHint,
            startChunkIndex: group.startChunkIndex,
            endChunkIndex: group.endChunkIndex,
            startPage: group.startPage,
            endPage: group.endPage,
          },
          select: {
            id: true,
            groupIndex: true,
          },
        }),
      ),
    );

    const groupIdByIndex = new Map(
      createdGroups.map((group: any) => [group.groupIndex, group.id] as const),
    );

    await tx.chunk.createMany({
      data: planned.chunks.map((chunk) => ({
        documentId,
        content: chunk.content,
        chunkIndex: chunk.index,
        pageNumber: chunk.pageNumber,
        chapterHint: chunk.chapterHint,
        kind: chunk.kind,
        labels: chunk.labels
          ? (chunk.labels as Prisma.InputJsonValue)
          : Prisma.DbNull,
        groupId: groupIdByIndex.get(chunk.groupIndex) ?? null,
      })),
    });
  });

  return {
    chunkCount: planned.chunks.length,
    groupCount: planned.groups.length,
  };
}
