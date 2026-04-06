import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

function normalizeDomain(domain: string): string {
  const trimmed = domain.trim().toLowerCase();
  if (!trimmed) return trimmed;
  try {
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
      return new URL(trimmed).hostname.toLowerCase();
    }
    return new URL(`https://${trimmed}`).hostname.toLowerCase();
  } catch {
    return trimmed.replace(/^www\./, "");
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { key: string } }
) {
  const hookSecret =
    (process.env.LICENSE_INTERNAL_HOOK_SECRET ||
      process.env.NEXT_INTERNAL_LICENSE_HOOK_SECRET ||
      "").trim();
  if (!hookSecret) {
    return NextResponse.json({ error: "Hook secret not configured" }, { status: 500 });
  }

  const key = decodeURIComponent(params.key || "").trim();
  if (!key) {
    return NextResponse.json({ error: "Invalid key" }, { status: 400 });
  }

  const raw = (await request.json().catch(() => ({}))) as {
    domain?: string;
    reason?: string;
    ts?: string;
  };
  const domain = normalizeDomain(raw.domain || "");
  const ts = String(raw.ts || request.headers.get("x-license-hook-ts") || "");
  const providedSig = String(request.headers.get("x-license-hook-signature") || "");
  if (!domain || !ts || !providedSig) {
    return NextResponse.json({ error: "Invalid payload or signature headers" }, { status: 400 });
  }

  const tsNum = Number(ts);
  if (!Number.isFinite(tsNum) || Math.abs(Date.now() - tsNum) > 5 * 60 * 1000) {
    return NextResponse.json({ error: "Hook timestamp invalid" }, { status: 401 });
  }

  const payloadToSign = `${key}:${domain}:${ts}`;
  const expectedSig = crypto.createHmac("sha256", hookSecret).update(payloadToSign).digest("hex");
  const validSig =
    expectedSig.length === providedSig.length &&
    crypto.timingSafeEqual(Buffer.from(expectedSig), Buffer.from(providedSig));
  if (!validSig) {
    return NextResponse.json({ error: "Invalid hook signature" }, { status: 401 });
  }

  const backendUrl = `${(process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000").replace(/\/$/, "")}/internal/license/hooks/domain-removed`;
  const backendRes = await fetch(backendUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-license-hook-signature": providedSig,
      "x-license-hook-ts": ts,
    },
    body: JSON.stringify({
      licenceKey: key,
      domain,
      reason: raw.reason || "domain_removed_by_manager",
      ts,
    }),
    cache: "no-store",
  });

  const body = await backendRes.json().catch(() => ({}));
  if (!backendRes.ok) {
    return NextResponse.json(
      { error: body.error || "Failed to process remove hook" },
      { status: backendRes.status }
    );
  }

  return NextResponse.json({ ok: true, updated: body.updated ?? true });
}
