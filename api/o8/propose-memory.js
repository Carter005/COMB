import { allowMethod, supabaseRequest } from "../../lib/supabase-server.js";

function clean(value, max) {
  return String(value || "").trim().slice(0, max);
}

export default async function handler(request, response) {
  if (!allowMethod(request, response, ["POST"])) return;
  const title = clean(request.body?.title, 120);
  const question = clean(request.body?.question, 600);
  const proposerAddress = clean(request.body?.proposerAddress, 128) || null;
  const targetAddress = clean(request.body?.targetAddress, 128) || null;
  if (title.length < 4 || question.length < 12) return response.status(400).json({ error: "title and question are required" });
  try {
    const rows = await supabaseRequest("/o8_memory_proposals", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ title, question, proposer_address: proposerAddress, target_address: targetAddress, evidence: { submittedFrom: "COMB_TERMINAL" }, status: "PENDING" }),
    });
    response.setHeader("Cache-Control", "no-store");
    response.status(201).json({ proposal: rows?.[0] || null });
  } catch (error) {
    response.status(503).json({ error: "memory proposal unavailable", detail: error.message });
  }
}
