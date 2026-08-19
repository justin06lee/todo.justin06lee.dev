import "server-only";

import { NextResponse } from "next/server";
import { isAdminServer } from "@/lib/auth-server";

// Shared plumbing for the /api route handlers, and nothing else — no auth
// logic of its own. Admin is still decided by `isAdminServer` (the same
// cookie + `todo_sessions` check every server action makes); this file only
// fixes the wire shape: JSON errors as `{ error }`, and a 401 that is JSON,
// never a redirect — the callers are scripts, not browsers.

export function jsonError(error: string, status: number): NextResponse {
  return NextResponse.json({ error }, { status });
}

/**
 * The admin gate for API routes. Returns the 401 response to send, or null to
 * proceed — the same shape as the main site's `requireAdminWithMutationRate`,
 * so a handler reads `const denied = await requireAdmin(); if (denied) return
 * denied;` and can't forget to return the failure.
 */
export async function requireAdmin(): Promise<NextResponse | null> {
  if (await isAdminServer()) return null;
  return jsonError("Unauthorized", 401);
}

/**
 * Body parsing with one rule for every route: an empty body reads as `{}` (so
 * endpoints whose fields are all optional don't demand a ritual empty object),
 * anything else must parse to a plain JSON object, and a failure returns null
 * for the caller to turn into its 400.
 */
export async function readJsonObject(
  req: Request,
): Promise<Record<string, unknown> | null> {
  let text: string;
  try {
    text = await req.text();
  } catch {
    return null;
  }
  if (text.trim() === "") return {};
  try {
    const parsed: unknown = JSON.parse(text);
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}
