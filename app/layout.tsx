import type { Metadata } from "next";
// Self-hosted and version-pinned via the `geist` package rather than
// next/font/google, matching the sibling sites: Google refetches at build
// time, so an upstream metrics change would silently shift the mono glyph
// grid.
import { GeistMono } from "geist/font/mono";
// Poppins, self-hosted and version-pinned for the same reason, replacing the
// `@latest` CDN URL `chrome init` writes into globals.css. Latin subsets only;
// 400/500/600 because the app renders font-medium and font-semibold and those
// should be real cuts, not browser-synthesised bolds.
import "@fontsource/poppins/latin-400.css";
import "@fontsource/poppins/latin-500.css";
import "@fontsource/poppins/latin-600.css";
import "./globals.css";
import { DialogProvider } from "@/components/chrome/dialog";
import { ToastProvider } from "@/components/chrome/toast";

export const metadata: Metadata = {
  title: {
    default: "todo",
    template: "%s | todo",
  },
  description: "categories, tasks, and notes — the reference list",
  applicationName: "todo.justin06lee.dev",
  authors: [{ name: "justin06lee" }],
  creator: "justin06lee",
  // Public read, owner write — the public pages are indexable; /login opts
  // itself out in its own metadata.
  robots: { index: true, follow: true },
};

export const viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="bg-black">
      <body
        className={`${GeistMono.variable} min-h-dvh bg-black text-white antialiased`}
      >
        <DialogProvider>
          <ToastProvider position="bottom-right">{children}</ToastProvider>
        </DialogProvider>
      </body>
    </html>
  );
}
