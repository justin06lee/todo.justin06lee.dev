"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/chrome/button";
import { logout } from "@/app/actions";

const LINKS = [
  { href: "/", label: "tasks" },
  { href: "/notes", label: "notes" },
] as const;

/**
 * The shared top bar. The site is publicly readable, so the nav always
 * renders; only the right edge changes — the owner gets sign-out, everyone
 * else a quiet sign-in link (signing in is how editing unlocks). A note page
 * (/notes/[id]) should light the notes link, so matching is prefix-based for
 * everything except the root.
 */
export function SiteHeader({ admin }: { admin: boolean }) {
  const pathname = usePathname();

  return (
    <header className="border-b border-white/10">
      <div className="mx-auto flex w-full max-w-3xl items-center gap-5 px-5 py-3">
        <Link href="/" className="text-sm font-medium text-white">
          todo
        </Link>
        <nav aria-label="primary" className="flex items-center gap-4">
          {LINKS.map((link) => {
            const active =
              link.href === "/"
                ? pathname === "/"
                : pathname === link.href || pathname.startsWith(`${link.href}/`);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "text-sm transition-colors hover:text-white",
                  active ? "text-white" : "text-white/50",
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
        {admin ? (
          <form action={logout} className="ml-auto">
            <Button
              type="submit"
              variant="ghost"
              size="sm"
              icon={LogOut}
              label="sign out"
              tooltip="sign out"
              // The header is at the document's top edge — an upward pill
              // clips there, which is the bug that earned button this prop.
              tooltipSide="bottom"
            />
          </form>
        ) : (
          <Link
            href="/login"
            className="ml-auto text-sm text-white/40 transition-colors hover:text-white"
          >
            sign in
          </Link>
        )}
      </div>
    </header>
  );
}
