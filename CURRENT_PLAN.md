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
- [ ] Add Prisma migration for grouping/entities schema.
- [x] Run `cd apps/web && npx prisma migrate dev`.

## Step 1 — Shared Ingestion Package (Chunking + Grouping)
- [ ] Create `packages/ingestion` with shared `chunking.ts`.
- [ ] Export chunk/group types + classifiers.
- [ ] Update `apps/web` and workers to import from package.
- [ ] Update `apps/web/next.config.ts` to transpile the package.

## Step 2 — Prisma Schema + Migration
- [ ] Add `ChunkGroup`, `Entity`, `EntityRuleLink`, `EntityImage` models.
- [ ] Add chunk `kind/labels/groupId`.
- [ ] Add document entity progress fields.
- [ ] Run migration and update Prisma client.

## Step 3 — Web App: Enqueue Entity Extraction
- [ ] After chunking, store groups and chunk metadata.
- [ ] Enqueue entity extraction job with document/system info.
- [ ] Set document `entityStatus=queued` + progress fields.

## Step 4 — New `services/entity-worker`
- [ ] Create worker service with BullMQ + Redis.
- [ ] Process groups (monster/item), normalize entities via LLM.
- [ ] Store entities + rule links.
- [ ] Update progress fields throughout.
- [ ] Mark success/failure.

## Step 5 — Entity Image Extraction (Default ON)
- [ ] Extract page renders using `pdfjs-dist`.
- [ ] Store PNGs under `uploads/{systemId}/entities/{documentId}/{entityId}`.
- [ ] Create `EntityImage` rows.
- [ ] Guard with env flag (default true).

## Step 6 — APIs for Debug/UI
- [ ] `GET /api/documents/[documentId]/groups`
- [ ] `GET /api/systems/[systemId]/entities`
- [ ] `GET /api/entities/[entityId]`
- [ ] `GET /api/entities/[entityId]/rules`

## Step 7 — UI Progress + Entity Visibility
- [ ] Extend upload panel with group/entity counts + status.
- [ ] Add simple entity list view for debugging.

## Later (Not Now)
- [ ] NPC/Characters entity extraction + rules linking.
