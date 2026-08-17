import { allowMethod, requireAdmin, supabaseRequest } from "../../lib/supabase-server.js";

function validTwitterUrl(value) {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || !["x.com", "www.x.com", "twitter.com", "www.twitter.com"].includes(url.hostname.toLowerCase())) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export default async function handler(request, response) {
  if (!allowMethod(request, response, ["GET", "POST"])) return;
  if (!requireAdmin(request, response)) return;

  try {
    if (request.method === "GET") {
      const rows = await supabaseRequest("/o8_system_bindings?id=eq.public-links&select=id,status,details,updated_at&limit=1");
      response.setHeader("Cache-Control", "no-store");
      return response.status(200).json(rows[0] || { id: "public-links", status: "UNBOUND", details: { twitterUrl: null } });
    }

    const raw = String(request.body?.twitterUrl || "").trim();
    const twitterUrl = raw ? validTwitterUrl(raw) : null;
    if (raw && !twitterUrl) return response.status(400).json({ error: "twitterUrl must use https://x.com or https://twitter.com" });
    const rows = await supabaseRequest("/o8_system_bindings", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify({ id: "public-links", label: "O8 public links", status: twitterUrl ? "CONNECTED" : "UNBOUND", truth: "SYSTEM", details: { twitterUrl }, updated_at: new Date().toISOString() }),
    });
    response.setHeader("Cache-Control", "no-store");
    return response.status(200).json(rows[0]);
  } catch {
    return response.status(503).json({ error: "public link configuration unavailable" });
  }
}
