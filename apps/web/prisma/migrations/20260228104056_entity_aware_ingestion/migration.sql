-- AlterTable
ALTER TABLE "Chunk" ADD COLUMN     "groupId" TEXT,
ADD COLUMN     "kind" TEXT,
ADD COLUMN     "labels" JSONB;

-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "entityError" TEXT,
ADD COLUMN     "entityExtractedCount" INTEGER,
ADD COLUMN     "entityImageCount" INTEGER,
ADD COLUMN     "entityProgressMessage" TEXT,
ADD COLUMN     "entityProgressUpdatedAt" TIMESTAMP(3),
ADD COLUMN     "entityRuleLinkCount" INTEGER,
ADD COLUMN     "entityStatus" TEXT NOT NULL DEFAULT 'idle';

-- CreateTable
CREATE TABLE "ChunkGroup" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "groupIndex" INTEGER NOT NULL,
    "title" TEXT,
    "chapterHint" TEXT,
    "startChunkIndex" INTEGER NOT NULL,
    "endChunkIndex" INTEGER NOT NULL,
    "startPage" INTEGER,
    "endPage" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChunkGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Entity" (
    "id" TEXT NOT NULL,
    "systemId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "groupId" TEXT,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "sourcePageStart" INTEGER,
    "sourcePageEnd" INTEGER,
    "sourceChunkStart" INTEGER NOT NULL,
    "sourceChunkEnd" INTEGER NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "extractionMethod" TEXT NOT NULL,
    "coreData" JSONB NOT NULL,
    "rawData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Entity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EntityRuleLink" (
    "id" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "chunkId" TEXT NOT NULL,
    "relation" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "rationale" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EntityRuleLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EntityImage" (
    "id" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "pageNumber" INTEGER NOT NULL,
    "filePath" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EntityImage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChunkGroup_documentId_groupIndex_idx" ON "ChunkGroup"("documentId", "groupIndex");

-- CreateIndex
CREATE INDEX "Entity_systemId_type_idx" ON "Entity"("systemId", "type");

-- CreateIndex
CREATE INDEX "Entity_documentId_idx" ON "Entity"("documentId");

-- CreateIndex
CREATE UNIQUE INDEX "Entity_systemId_type_slug_sourceChunkStart_sourceChunkEnd_key" ON "Entity"("systemId", "type", "slug", "sourceChunkStart", "sourceChunkEnd");

-- CreateIndex
CREATE INDEX "EntityRuleLink_entityId_idx" ON "EntityRuleLink"("entityId");

-- CreateIndex
CREATE UNIQUE INDEX "EntityRuleLink_entityId_chunkId_relation_key" ON "EntityRuleLink"("entityId", "chunkId", "relation");

-- CreateIndex
CREATE INDEX "EntityImage_entityId_idx" ON "EntityImage"("entityId");

-- AddForeignKey
ALTER TABLE "Chunk" ADD CONSTRAINT "Chunk_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "ChunkGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChunkGroup" ADD CONSTRAINT "ChunkGroup_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Entity" ADD CONSTRAINT "Entity_systemId_fkey" FOREIGN KEY ("systemId") REFERENCES "System"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Entity" ADD CONSTRAINT "Entity_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Entity" ADD CONSTRAINT "Entity_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "ChunkGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntityRuleLink" ADD CONSTRAINT "EntityRuleLink_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntityRuleLink" ADD CONSTRAINT "EntityRuleLink_chunkId_fkey" FOREIGN KEY ("chunkId") REFERENCES "Chunk"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntityImage" ADD CONSTRAINT "EntityImage_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntityImage" ADD CONSTRAINT "EntityImage_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
