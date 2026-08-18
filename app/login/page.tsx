import { redirect } from "next/navigation";
import { isAdminServer } from "@/lib/auth-server";
import { LoginForm } from "@/components/login-form";
import { SiteHeader } from "@/components/site-header";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "sign in",
  robots: { index: false, follow: false },
};

export default async function LoginPage() {
  if (await isAdminServer()) redirect("/");

  return (
    <div className="min-h-dvh">
      <SiteHeader admin={false} />
      <main className="mx-auto flex w-full max-w-sm flex-col justify-center px-5 py-24">
        <h1 className="font-mono text-[11px] uppercase tracking-[0.18em] text-white/40">
          sign in
        </h1>
        <p className="mt-3 text-[15px] leading-7 text-white/60">
          the site is readable without this — signing in unlocks editing and
          the private lists. same password as justin06lee.dev; this subdomain
          keeps its own session.
        </p>
        <LoginForm />
      </main>
    </div>
  );
}
