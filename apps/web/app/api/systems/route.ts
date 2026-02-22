import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const systems = await prisma.system.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ ok: true, systems });
  } catch (error) {
    console.error("GET /api/systems failed", error);
    return NextResponse.json(
      { ok: false, error: "Failed to load systems." },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { name?: unknown };
    const name =
      typeof body.name === "string" ? body.name.trim().slice(0, 120) : "";

    if (!name) {
      return NextResponse.json(
        { ok: false, error: "System name is required." },
        { status: 400 },
      );
    }

    const system = await prisma.system.create({
      data: { name },
      select: {
        id: true,
        name: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ ok: true, system }, { status: 201 });
  } catch (error) {
    console.error("POST /api/systems failed", error);
    return NextResponse.json(
      { ok: false, error: "Failed to create system." },
      { status: 500 },
    );
  }
}
