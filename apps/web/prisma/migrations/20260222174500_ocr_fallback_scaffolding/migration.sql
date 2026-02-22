ALTER TABLE "Document"
ADD COLUMN "ocrStatus" TEXT NOT NULL DEFAULT 'not_requested',
ADD COLUMN "ocrReason" TEXT,
ADD COLUMN "ocrError" TEXT,
ADD COLUMN "ocrRequestedAt" TIMESTAMP(3),
ADD COLUMN "ocrCompletedAt" TIMESTAMP(3);
