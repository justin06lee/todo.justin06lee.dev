import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME, validateSession } from "./auth";

/**
 * The admin check for Server Components and Server Actions. Takes no
 * arguments, so wrapping it in React's `cache` collapses every call made
 * during one request/render pass into a single execution — one cookie read and
 * one `todo_sessions` SELECT no matter how many times it's asked.
 * `validateSession` is memoized too (keyed by token), so callers that reach it
 * by another route still share the same query.
 *
 * Per-request only, not a global cache: the memo lives and dies with the
 * request, so a session revoked elsewhere is rejected on the next request.
 *
 * The one shape this would get wrong is "check admin, mutate the session, then
 * re-check admin" inside a single request — the second check would see the
 * pre-mutation answer. No such path exists: `login` and `logout` mutate the
 * session and immediately `redirect()`, and neither calls this first. Keep it
 * that way, or read `validateSession` directly at the point that needs the
 * post-mutation truth.
 */
export const isAdminServer = cache(async (): Promise<boolean> => {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return false;
  return validateSession(token);
});
