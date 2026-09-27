export interface Env { APP_NAME: string }

const cors: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, "content-type": "application/json;charset=UTF-8" },
  });
}

const ALLOWED = [
  "apkmirror.com",
  "apkpure.com",
  "aptoide.com",
  "play.google.com",
  "googleusercontent.com",
  "f-droid.org",
  "taptap.io",
  "uptodown.com",
  "github.com",
  "objects.githubusercontent.com",
];

function hostAllowed(host: string): boolean {
  const h = host.toLowerCase();
  return ALLOWED.some((d) => h === d || h.endsWith("." + d));
}

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

function parseTarget(raw: string | null): URL | null {
  if (!raw) return null;
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:") return null;
    if (!hostAllowed(u.hostname)) return null;
    return u;
  } catch {
    return null;
  }
}

function fileHeaders(url: URL): Record<string, string> {
  const base = url.pathname.split("/").pop() || "app.apk";
  let name = decodeURIComponent(base).replace(/[^\w.\- ]/g, "_");
  if (!/\.apk$/i.test(name)) name = name.split(".")[0] + ".apk";
  return {
    ...cors,
    "content-type": "application/vnd.android.package-archive",
    "content-disposition": `attachment; filename="${name}"`,
    "cache-control": "public, max-age=86400",
    "x-content-type-options": "nosniff",
  };
}

async function proxyFetch(u: URL): Promise<Response> {
  const r = await fetch(u.toString(), {
    headers: {
      "user-agent": UA,
      accept: "*/*",
      "accept-language": "en-US,en;q=0.9",
      referer: u.origin + "/",
    },
    redirect: "follow",
  });
  const headers = new Headers(cors);
  const ct = r.headers.get("content-type");
  if (ct) headers.set("content-type", ct);
  const cl = r.headers.get("content-length");
  if (cl) headers.set("content-length", cl);
  return new Response(r.body, { status: r.status, headers });
}

function providerSearch(q: string) {
  return {
    apkmirror: `https://www.apkmirror.com/?post_type=app_release&searchtype=apk&s=${encodeURIComponent(q)}`,
    apkpure: `https://apkpure.com/search?q=${encodeURIComponent(q)}`,
    googlePlay: `https://play.google.com/store/search?q=${encodeURIComponent(q)}&c=apps`,
    taptap: `https://www.taptap.io/search/${encodeURIComponent(q)}`,
    aptoide: `https://ws75.aptoide.com/api/7/apps/search?query=${encodeURIComponent(q)}&limit=12`,
  };
}

export default {
  async fetch(req: Request, _env: Env): Promise<Response> {
    if (req.method === "OPTIONS") return new Response(null, { headers: cors });
    if (req.method !== "GET" && req.method !== "HEAD") return json({ error: "GET only" }, 405);
    const u = new URL(req.url);

    if (u.pathname === "/health") return json({ ok: true, service: "apkscope-resolver" });

    if (u.pathname === "/proxy") {
      const target = parseTarget(u.searchParams.get("url"));
      if (!target) return json({ error: "url must be an allowed https host" }, 400);
      try {
        return await proxyFetch(target);
      } catch (e) {
        return json({ error: "upstream fetch failed: " + String(e) }, 502);
      }
    }

    if (u.pathname === "/download") {
      const target = parseTarget(u.searchParams.get("url"));
      if (!target) return json({ error: "url must be an allowed https host" }, 400);
      if (!/\.apk(\?|$)/i.test(target.pathname + target.search)) {
        return json({ error: "only .apk files can be downloaded" }, 400);
      }
      try {
        const r = await fetch(target.toString(), {
          headers: { "user-agent": UA, accept: "*/*", referer: target.origin + "/" },
          redirect: "follow",
        });
        if (!r.ok) return json({ error: "upstream returned " + r.status }, r.status);
        const headers = fileHeaders(target);
        const len = r.headers.get("content-length");
        if (len) headers["content-length"] = len;
        return new Response(r.body, { status: 200, headers });
      } catch (e) {
        return json({ error: "download failed: " + String(e) }, 502);
      }
    }

    if (u.pathname === "/api/search") {
      const q = u.searchParams.get("q")?.trim();
      if (!q) return json({ error: "q is required" }, 400);
      return json({ query: q, providers: providerSearch(q), note: "Provider discovery links are returned without requiring API keys." });
    }

    if (u.pathname === "/api/resolve") {
      const url = u.searchParams.get("url");
      if (!url) return json({ error: "url is required" }, 400);
      try {
        const parsed = new URL(url);
        if (!hostAllowed(parsed.hostname)) return json({ error: "Unsupported provider hostname" }, 400);
        return Response.redirect(url, 302);
      } catch {
        return json({ error: "Invalid URL" }, 400);
      }
    }

    return json({ service: "APKScope Resolver", endpoints: ["/health", "/proxy?url=...", "/download?url=...apk", "/api/search?q=...", "/api/resolve?url=..."] });
  },
};
