import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // libsql ships native bindings; bundling them breaks the driver at runtime.
  // Mirrors the same list on the sibling sites that talk to the same database.
  serverExternalPackages: [
    "@libsql/client",
    "@libsql/core",
    "@libsql/hrana-client",
    "libsql",
  ],

  // Nothing else in this app sets a response header — there is no proxy and no
  // middleware — so these are the only security headers the site sends.
  //
  // `/:path*` rather than `/(.*)`: the zero-or-more modifier matches the root
  // `/` too, which the regex form does not once Next expands it.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Clickjacking. The whole site is an admin surface — every page
          // past /login renders mutating controls — so an attacker who can
          // frame it invisibly can steer a click into deleting a note or a
          // category. The session cookie's sameSite: "strict" does not help
          // here — it stops the cookie riding cross-site requests, not the
          // page being framed and clicked.
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },

          // Vercel redirects HTTP to HTTPS but does not send HSTS unless it is
          // configured, so without this the first request of a session is
          // still made in the clear. Two years, subdomains included, preload.
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },

          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
