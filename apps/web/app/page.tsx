import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

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
                <li
                  key={system.id}
                  className="rounded-lg border border-zinc-800 bg-zinc-950/70 px-3 py-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium text-zinc-100">
                      {system.name}
                    </span>
                    <span className="text-xs text-zinc-400">
                      {system.createdAt.toLocaleString()}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-3 text-xs">
                    <span className="text-zinc-400">
                      Documents: {system._count.documents}
                    </span>
                    <a
                      href={`/api/systems/${system.id}/documents`}
                      className="text-zinc-300 underline decoration-zinc-700 underline-offset-2 hover:text-zinc-100"
                    >
                      View documents JSON
                    </a>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
