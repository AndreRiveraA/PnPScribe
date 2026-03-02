"use client";

import { useEffect, useMemo, useState } from "react";

type SystemOption = {
  id: string;
  name: string;
};

type EntitySummary = {
  id: string;
  documentId: string;
  type: string;
  name: string;
  slug: string;
  confidence: number;
  sourcePageStart: number | null;
  sourcePageEnd: number | null;
  sourceChunkStart: number;
  sourceChunkEnd: number;
  extractionMethod: string;
  createdAt: string;
  updatedAt: string;
  _count: {
    images: number;
    ruleLinks: number;
  };
};

type EntitiesResponse = {
  ok: boolean;
  error?: string;
  system?: { id: string; name: string };
  entities?: EntitySummary[];
};

export function EntitiesDebugPanel({ systems }: { systems: SystemOption[] }) {
  const [systemId, setSystemId] = useState(systems[0]?.id ?? "");
  const [entityType, setEntityType] = useState<"monster" | "item" | "">("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [entities, setEntities] = useState<EntitySummary[]>([]);

  useEffect(() => {
    setSystemId((current) => current || systems[0]?.id || "");
  }, [systems]);

  async function loadEntities() {
    if (!systemId) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (entityType) {
        params.set("type", entityType);
      }
      if (query.trim()) {
        params.set("q", query.trim());
      }

      const res = await fetch(`/api/systems/${systemId}/entities?${params.toString()}`);
      const data = (await res.json()) as EntitiesResponse;

      if (!data.ok) {
        setError(data.error ?? "Failed to load entities.");
        setEntities([]);
        return;
      }

      setEntities(data.entities ?? []);
    } catch {
      setError("Failed to load entities.");
      setEntities([]);
    } finally {
      setLoading(false);
    }
  }

  const summary = useMemo(() => {
    if (!entities.length) {
      return "No entities loaded.";
    }
    const monsters = entities.filter((entity) => entity.type === "monster").length;
    const items = entities.filter((entity) => entity.type === "item").length;
    return `Loaded ${entities.length} entities (monsters ${monsters}, items ${items}).`;
  }, [entities]);

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-sm font-medium text-zinc-200">Entity Debug (Monsters & Items)</h2>
        <span className="text-xs text-zinc-500">Quick view into extracted entities</span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <select
          value={systemId}
          onChange={(event) => setSystemId(event.target.value)}
          className="h-11 rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-100 outline-none focus:border-zinc-500"
        >
          {systems.map((system) => (
            <option key={system.id} value={system.id}>
              {system.name}
            </option>
          ))}
        </select>

        <select
          value={entityType}
          onChange={(event) =>
            setEntityType(
              event.target.value === "monster" || event.target.value === "item"
                ? event.target.value
                : "",
            )
          }
          className="h-11 rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-100 outline-none focus:border-zinc-500"
        >
          <option value="">All entity types</option>
          <option value="monster">Monsters</option>
          <option value="item">Items</option>
        </select>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <input
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by name or slug"
          className="h-10 min-w-[220px] flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-100 outline-none focus:border-zinc-500"
        />
        <button
          type="button"
          onClick={() => void loadEntities()}
          disabled={!systemId || loading}
          className="h-10 rounded-lg bg-cyan-300 px-4 text-sm font-medium text-zinc-950 hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Loading entities..." : "Load entities"}
        </button>
        {error ? <span className="text-xs text-rose-300">{error}</span> : null}
      </div>

      <div className="mt-4 rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-xs text-zinc-300">
        {summary}
      </div>

      <div className="mt-4 max-h-[520px] overflow-y-auto pr-2">
        {entities.length === 0 ? (
          <p className="text-xs text-zinc-500">No entities loaded yet.</p>
        ) : (
          <ul className="space-y-2">
            {entities.map((entity) => (
              <li key={entity.id} className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-400">
                  <span>
                    {entity.type} • conf {entity.confidence.toFixed(2)} • links {entity._count.ruleLinks} • images {entity._count.images}
                  </span>
                  <span>chunks {entity.sourceChunkStart}–{entity.sourceChunkEnd}</span>
                </div>
                <p className="mt-2 text-sm text-zinc-200">
                  <a
                    href={`/entities/${entity.id}`}
                    className="underline decoration-zinc-700 underline-offset-2 hover:text-zinc-100"
                  >
                    {entity.name}
                  </a>{" "}
                  <span className="text-xs text-zinc-500">({entity.slug})</span>
                </p>
                <p className="mt-1 text-xs text-zinc-400">
                  pages {entity.sourcePageStart ?? "?"}–{entity.sourcePageEnd ?? "?"} • {entity.extractionMethod}
                </p>
                <p className="mt-2 text-xs text-zinc-500 break-all">
                  id <code>{entity.id}</code> • doc <code>{entity.documentId}</code>
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
