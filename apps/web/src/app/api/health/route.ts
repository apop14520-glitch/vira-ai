import { NextResponse } from "next/server";

export async function GET() {
  const base = process.env.INTERNAL_API_BASE_URL ?? process.env.API_BASE_URL;
  if (!base) return NextResponse.json({ status: "unconfigured" }, { status: 503 });

  try {
    const headers = new Headers();
    const token = process.env.API_ACCESS_TOKEN;
    if (token) headers.set("Authorization", `Bearer ${token}`);
    const response = await fetch(new URL("/health", `${base.replace(/\/$/, "")}/`), {
      headers,
      redirect: "error",
      cache: "no-store",
    });
    return NextResponse.json(await response.json(), { status: response.status });
  } catch {
    return NextResponse.json({ status: "unavailable" }, { status: 502 });
  }
}
