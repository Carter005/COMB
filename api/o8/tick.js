import { allowMethod, supabaseRequest } from "../../lib/supabase-server.js";

export default async function handler(request, response) {
  if (!allowMethod(request, response, ["POST"])) return;
  try {
    const result = await supabaseRequest("/rpc/o8_tick", { method: "POST", body: "{}" });
    response.setHeader("Cache-Control", "no-store");
    response.status(200).json(result);
  } catch (error) {
    response.status(503).json({ error: "tick unavailable", detail: error.message });
  }
}
