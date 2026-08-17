const baseUrl = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function supabaseRequest(path, options = {}) {
  if (!baseUrl || !serviceKey) throw new Error("Supabase server environment is not configured");
  const response = await fetch(`${baseUrl}/rest/v1${path}`, {
    ...options,
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Supabase ${response.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}

export function allowMethod(request, response, methods) {
  if (methods.includes(request.method)) return true;
  response.setHeader("Allow", methods.join(", "));
  response.status(405).json({ error: "method not allowed" });
  return false;
}

export function requireAdmin(request, response) {
  const authorization = request.headers.authorization || "";
  const supplied = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  const validSecrets = [process.env.O8_ADMIN_SECRET, process.env.CRON_SECRET].filter(Boolean);
  if (supplied && validSecrets.includes(supplied)) return true;
  response.setHeader("Cache-Control", "no-store");
  response.status(401).json({ error: "unauthorized" });
  return false;
}
