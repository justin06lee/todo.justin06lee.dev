import { NextRequest, NextResponse } from "next/server";
import {
  SESSION_COOKIE_NAME,
  checkRateLimit,
  createSession,
  destroySession,
  getClientIp,
  verifyAdminKey,
} from "@/lib/auth";
import { isAdminServer } from "@/lib/auth-server";

export const dynamic = "force-dynamic";

// The HTTP twin of the `login`/`logout` server actions, for scripted callers
// (the MCP server). Same primitives, same order, same cookie — the only
// differences are the wire shape (JSON status codes instead of form state and
// redirects) and the explicit 503 when ADMIN_KEY is missing, which a script
// needs to tell apart from "wrong password".

const COOKIE_ATTRS = {
  httpOnly: true,
  sameSite: "strict",
  path: "/",
  secure: process.env.NODE_ENV === "production",
} as const;

export async function POST(req: NextRequest) {
  // Reject oversized bodies before buffering — a login payload is a small
  // {password} object, so anything large is abuse (memory DoS on a public
  // POST). Same cap as the main site's /api/auth.
  if (Number(req.headers.get("content-length")) > 4096) {
    return NextResponse.json(
      { ok: false, error: "payload too large" },
      { status: 413 },
    );
  }

  let body: { password?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid JSON" }, { status: 400 });
  }
  const { password } = body;

  if (typeof password !== "string" || password.length === 0) {
    // Deliberately ahead of the rate limit, mirroring the login action: an
    // empty field is a caller slip, not a guess — it never reaches the
    // compare, so it shouldn't burn an attempt.
    return NextResponse.json(
      { ok: false, error: "enter the password" },
      { status: 401 },
    );
  }

  // Brute-force gate, before verifyAdminKey — a locked-out caller learns
  // nothing about whether the guess it just sent was right. See the login
  // action for why an unresolvable IP buckets to "unknown" rather than
  // skipping the limit.
  const ip = await getClientIp();
  if (!(await checkRateLimit(ip))) {
    return NextResponse.json(
      { ok: false, error: "too many attempts" },
      { status: 429 },
    );
  }

  // With no ADMIN_KEY there is no password that works; say so as a server
  // misconfiguration instead of an endless 401 — but only after the rate
  // limit, so probing for this costs the same as guessing.
  if (!process.env.ADMIN_KEY) {
    return NextResponse.json(
      { ok: false, error: "ADMIN_KEY is not set on the server; login is disabled" },
      { status: 503 },
    );
  }

  // Constant-time compare lives in verifyAdminKey.
  if (!verifyAdminKey(password)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const token = await createSession();
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE_NAME, token, {
    ...COOKIE_ATTRS,
    maxAge: 60 * 60 * 24,
  });
  return res;
}

/** Is the caller's session still good? */
export async function GET() {
  if (await isAdminServer()) return NextResponse.json({ ok: true });
  return NextResponse.json({ ok: false }, { status: 401 });
}

/** Sign out: destroy the session row, clear the cookie. Always 200. */
export async function DELETE(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (token) await destroySession(token);

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE_NAME, "", { ...COOKIE_ATTRS, maxAge: 0 });
  return res;
}
