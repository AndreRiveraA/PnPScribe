# PnPScribe — Current Plan (Step-by-step, Approval Required)

This checklist will be updated as we complete each step and get your approval.

## Decisions Locked In
- [x] Entity extraction is **heuristic + LLM** hybrid.
- [x] Extraction runs in a **background job** with progress tracking.
- [x] Image extraction is **ON by default**.
- [x] New **entity worker service** (separate from OCR).
- [x] Future scope: add **NPC/Characters** entity type later.

## Step 0 — Setup + Migrations (First approval step)
- [x] Add root setup script (if missing) to install deps in root/apps/workers.
- [x] Run `npm run setup`.
- [x] Add Prisma migration for grouping/entities schema. (Completed in Step 2)
- [x] Run `cd apps/web && npx prisma migrate dev`.

## Step 1 — Shared Ingestion Package (Chunking + Grouping)
- [x] Create `packages/ingestion` with shared `chunking.ts`.
- [x] Export chunk/group types + classifiers.
- [x] Update `apps/web` and workers to import from package.
- [x] Update `apps/web/next.config.ts` to transpile the package.

## Step 2 — Prisma Schema + Migration
- [x] Add `ChunkGroup`, `Entity`, `EntityRuleLink`, `EntityImage` models.
- [x] Add chunk `kind/labels/groupId`.
- [x] Add document entity progress fields.
- [x] Run migration and update Prisma client.

## Step 3 — Web App: Enqueue Entity Extraction
- [x] After chunking, store groups and chunk metadata.
- [x] Enqueue entity extraction job with document/system info.
- [x] Set document `entityStatus=queued` + progress fields.

## Step 4 — New `services/entity-worker`
- [x] Create worker service with BullMQ + Redis.
- [x] Process groups (monster/item), normalize entities via LLM.
- [x] Store entities + rule links.
- [x] Update progress fields throughout.
- [x] Mark success/failure.

## Step 5 — Entity Image Extraction (Default ON)
- [x] Extract page renders using `pdfjs-dist`.
- [x] Store PNGs under `uploads/{systemId}/entities/{documentId}/{entityId}`.
- [x] Create `EntityImage` rows.
- [x] Guard with env flag (default true).

## Step 5.5 — PDF Metadata (Chapters/Outlines)
- [x] Extract PDF outlines/bookmarks when available.
- [x] Store chapter metadata (title + page range) for documents.
- [x] Use chapter metadata to improve grouping/labels.

## Step 6 — APIs for Debug/UI
- [x] `GET /api/documents/[documentId]/groups`
- [x] `GET /api/systems/[systemId]/entities`
- [x] `GET /api/entities/[entityId]`
- [x] `GET /api/entities/[entityId]/rules`

## Step 7 — UI Progress + Entity Visibility
- [x] Extend upload panel with group/entity counts + status.
- [x] Add simple entity list view for debugging.
- [ ] Add UI testing checklist (upload → entities → rules → images).

## Later (Not Now)
- [ ] NPC/Characters entity extraction + rules linking.
