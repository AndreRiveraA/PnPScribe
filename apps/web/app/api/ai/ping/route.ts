import { NextResponse } from "next/server";
import { MODELS, openai } from "@/lib/openai";

export async function GET() {
	const res = await openai.responses.create({
		model: MODELS.cheap,
		input: "Reply with exactly: pong",
		max_output_tokens: 16,
		temperature: 0,
	});

	const text = (res.output_text ?? "").trim();

	return NextResponse.json({ ok: true, model: MODELS.cheap, text });
}
