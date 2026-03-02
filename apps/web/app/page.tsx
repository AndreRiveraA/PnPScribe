import { revalidatePath } from "next/cache";
import { ChunkDebugPanel } from "@/app/chunk-debug-panel";
import { DocumentUploadPanel } from "@/app/document-upload-panel";
import { EntitiesDebugPanel } from "@/app/entities-debug-panel";
import { prisma } from "@/lib/prisma";
import { RulesAskPanel } from "@/app/rules-ask-panel";

async function createSystem(formData: FormData) {
  "use server";

  const rawName = formData.get("name");
  const name = typeof rawName === "string" ? rawName.trim().slice(0, 120) : "";

  if (!name) {
    return;
  }

  await prisma.system.create({
    data: { name },
  });

  revalidatePath("/");
}

export default async function Home() {
  let systems: Array<{
    id: string;
    name: string;
    createdAt: Date;
    _count: { documents: number };
    documents: Array<{
      id: string;
      filePath: string;
      extractedTextLength: number | null;
      extractedPageCount: number | null;
      extractionDurationMs: number | null;
      ocrStatus: string;
      ocrMode: string | null;
      ocrReason: string | null;
      ocrProgressCurrentPage: number | null;
      ocrProgressTotalPages: number | null;
      ocrProgressMessage: string | null;
      entityStatus: string;
      entityError: string | null;
      entityProgressMessage: string | null;
      entityProgressUpdatedAt: Date | null;
      entityExtractedCount: number | null;
      entityRuleLinkCount: number | null;
      entityImageCount: number | null;
      extractionStatus: string;
      extractionError: string | null;
      extractedAt: Date | null;
      createdAt: Date;
      _count: {
        chunks: number;
      };
    }>;
  }> = [];
  let dbError: string | null = null;

  try {
    systems = await prisma.system.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        createdAt: true,
        _count: {
          select: {
            documents: true,
          },
        },
        documents: {
          orderBy: { createdAt: "desc" },
          take: 3,
          select: {
            id: true,
            filePath: true,
            extractedTextLength: true,
            extractedPageCount: true,
            extractionDurationMs: true,
            ocrStatus: true,
            ocrMode: true,
            ocrReason: true,
            ocrProgressCurrentPage: true,
            ocrProgressTotalPages: true,
            ocrProgressMessage: true,
            entityStatus: true,
            entityError: true,
            entityProgressMessage: true,
            entityProgressUpdatedAt: true,
            entityExtractedCount: true,
            entityRuleLinkCount: true,
            entityImageCount: true,
            extractionStatus: true,
            extractionError: true,
            extractedAt: true,
            createdAt: true,
            _count: {
              select: {
                chunks: true,
              },
            },
          },
        },
      },
    });
  } catch {
    dbError = "Database not reachable. Start Docker services and run migrations.";
  }

  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-10 text-zinc-100">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">
            PnPScribe
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">
            Systems (MVP)
          </h1>
          <p className="text-sm text-zinc-300">
            Create RPG systems now. Rulebook upload and RAG come next.
          </p>
        </header>

        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5">
          <h2 className="mb-4 text-sm font-medium text-zinc-200">
            Create System
          </h2>
          <form action={createSystem} className="flex flex-col gap-3 sm:flex-row">
            <input
              type="text"
              name="name"
              placeholder="e.g. PF2e"
              className="h-11 flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-sm outline-none ring-0 placeholder:text-zinc-500 focus:border-zinc-500"
              maxLength={120}
              required
            />
            <button
              type="submit"
              className="h-11 rounded-lg bg-emerald-500 px-4 text-sm font-medium text-zinc-950 hover:bg-emerald-400"
            >
              Create
            </button>
          </form>
        </section>

        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5">
          <div className="mb-4 flex items-center justify-between gap-4">
            <h2 className="text-sm font-medium text-zinc-200">System List</h2>
            <a
              href="/api/systems"
              className="text-xs text-zinc-400 underline decoration-zinc-700 underline-offset-2 hover:text-zinc-200"
            >
              View JSON API
            </a>
          </div>

          {dbError ? (
            <p className="rounded-lg border border-amber-800 bg-amber-950/30 px-3 py-2 text-sm text-amber-200">
              {dbError}
            </p>
          ) : systems.length === 0 ? (
            <p className="text-sm text-zinc-400">No systems yet.</p>
          ) : (
            <ul className="space-y-2">
              {systems.map((system) => (
                <li key={system.id} className="rounded-lg border border-zinc-800 bg-zinc-950/70 px-3 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium text-zinc-100">{system.name}</span>
                    <span className="text-xs text-zinc-400">{system.createdAt.toLocaleString()}</span>
                  </div>

                  <div className="mt-2 rounded-md border border-zinc-800/80 bg-zinc-900/50 px-2 py-2 text-xs text-zinc-300">
                    <p>
                      <span className="text-zinc-500">systemId:</span>{" "}
                      <code className="text-zinc-200">{system.id}</code>
                    </p>
                    <p className="mt-1">
                      <span className="text-zinc-500">createdAt (ISO):</span>{" "}
                      <code className="text-zinc-200">{system.createdAt.toISOString()}</code>
                    </p>
                    <p className="mt-1">
                      <span className="text-zinc-500">documents:</span> {system._count.documents}
                    </p>
                    <p className="mt-1">
                      <span className="text-zinc-500">recent extraction:</span>{" "}
                      {system.documents.length === 0
                        ? "none"
                        : `${system.documents.filter((d) => d.extractionStatus === "succeeded").length} ok / ${system.documents.filter((d) => d.extractionStatus === "failed").length} failed / ${system.documents.filter((d) => d.extractionStatus === "pending").length} pending (latest 3)`}
                    </p>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
                    <a
                      href={`/api/systems/${system.id}/documents`}
                      className="text-zinc-300 underline decoration-zinc-700 underline-offset-2 hover:text-zinc-100"
                    >
                      Documents JSON
                    </a>
                    <a
                      href={`/api/systems/${system.id}/indexing-status`}
                      className="text-zinc-300 underline decoration-zinc-700 underline-offset-2 hover:text-zinc-100"
                    >
                      Indexing Status JSON
                    </a>
                    <code className="text-zinc-500">POST /api/systems/{system.id}/ask</code>
                  </div>

                  {system.documents.length > 0 ? (
                    <div className="mt-3 rounded-md border border-zinc-800/80 bg-zinc-900/40 p-2">
                      <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">
                        Recent Documents (latest 3)
                      </p>
                      <ul className="mt-2 space-y-2">
                        {system.documents.map((document) => (
                          <li key={document.id} className="rounded border border-zinc-800 px-2 py-2 text-xs">
                            <p className="text-zinc-200">
                              <span className="text-zinc-500">docId:</span>{" "}
                              <code>{document.id}</code>
                            </p>
                            <p className="mt-1 break-all text-zinc-300">
                              <span className="text-zinc-500">file:</span> {document.filePath}
                            </p>
                            <p className="mt-1 text-zinc-300">
                              <span className="text-zinc-500">status:</span> {document.extractionStatus}
                              {" • "}
                              <span className="text-zinc-500">chunks:</span> {document._count.chunks}
                              {" • "}
                              <span className="text-zinc-500">created:</span>{" "}
                              {document.createdAt.toLocaleString()}
                            </p>
                            <p className="mt-1 text-zinc-300">
                              <span className="text-zinc-500">diagnostics:</span>{" "}
                              textLen={document.extractedTextLength ?? "null"}
                              {" • "}
                              pages={document.extractedPageCount ?? "null"}
                              {" • "}
                              extractMs={document.extractionDurationMs ?? "null"}
                            </p>
                            <p className="mt-1 text-zinc-300">
                              <span className="text-zinc-500">ocr:</span> {document.ocrStatus}
                              {document.ocrMode ? ` • mode=${document.ocrMode}` : ""}
                              {document.ocrReason ? ` • ${document.ocrReason}` : ""}
                            </p>
                            <p className="mt-1 text-zinc-300">
                              <span className="text-zinc-500">ocr progress:</span>{" "}
                              {document.ocrProgressCurrentPage ?? 0}/
                              {document.ocrProgressTotalPages ?? "?"}
                              {document.ocrProgressMessage ? ` • ${document.ocrProgressMessage}` : ""}
                            </p>
                            <p className="mt-1 text-zinc-300">
                              <span className="text-zinc-500">entities:</span>{" "}
                              {document.entityStatus}
                              {document.entityProgressMessage ? ` • ${document.entityProgressMessage}` : ""}
                              {document.entityProgressUpdatedAt
                                ? ` • updated ${document.entityProgressUpdatedAt.toISOString()}`
                                : ""}
                            </p>
                            <p className="mt-1 text-zinc-300">
                              <span className="text-zinc-500">entity counts:</span>{" "}
                              extracted={document.entityExtractedCount ?? 0}
                              {" • "}rules={document.entityRuleLinkCount ?? 0}
                              {" • "}images={document.entityImageCount ?? 0}
                            </p>
                            {document.entityError ? (
                              <p className="mt-1 break-words text-amber-300">
                                <span className="text-zinc-500">entity error:</span> {document.entityError}
                              </p>
                            ) : null}
                            <p className="mt-1 text-zinc-300">
                              <span className="text-zinc-500">extractedAt:</span>{" "}
                              {document.extractedAt ? document.extractedAt.toISOString() : "null"}
                            </p>
                            {document.extractionError ? (
                              <p className="mt-1 break-words text-amber-300">
                                <span className="text-zinc-500">error:</span> {document.extractionError}
                              </p>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>

        {!dbError && systems.length > 0 ? (
          <DocumentUploadPanel
            systems={systems.map((system) => ({
              id: system.id,
              name: system.name,
            }))}
          />
        ) : null}

        {!dbError && systems.length > 0 ? (
          <ChunkDebugPanel
            systems={systems.map((system) => ({
              id: system.id,
              name: system.name,
            }))}
          />
        ) : null}

        {!dbError && systems.length > 0 ? (
          <EntitiesDebugPanel
            systems={systems.map((system) => ({
              id: system.id,
              name: system.name,
            }))}
          />
        ) : null}

        {!dbError && systems.length > 0 ? (
          <RulesAskPanel
            systems={systems.map((system) => ({
              id: system.id,
              name: system.name,
            }))}
          />
        ) : null}
      </div>
    </main>
  );
}
