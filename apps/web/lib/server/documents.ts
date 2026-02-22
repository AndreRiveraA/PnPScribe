import "server-only";

import { prisma } from "@/lib/prisma";
import { HttpError } from "@/lib/server/http-error";

export function parseSystemId(input: unknown) {
  const systemId = typeof input === "string" ? input.trim() : "";

  if (!systemId) {
    throw new HttpError(400, "systemId is required.");
  }

  return systemId;
}

export async function listDocumentsForSystem(systemId: string) {
  const system = await prisma.system.findUnique({
    where: { id: systemId },
    select: {
      id: true,
      name: true,
      documents: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          filePath: true,
          createdAt: true,
        },
      },
    },
  });

  if (!system) {
    throw new HttpError(404, "System not found.");
  }

  return system;
}
