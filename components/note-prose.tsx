"use client";

import Link from "next/link";
import { Prose } from "@/components/chrome/prose";

/**
 * The read-only note body. Exists because a component (a function) can't
 * cross the server-to-client prop boundary — the server page can't pass
 * `linkComponent={Link}` into the client `Prose` directly, so this client
 * wrapper owns the Link import and the page passes only the markdown string.
 */
export function NoteProse({ children }: { children: string }) {
  return (
    <Prose linkComponent={Link} imageTheme="dark">
      {children}
    </Prose>
  );
}
