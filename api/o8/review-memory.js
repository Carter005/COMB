import { allowMethod, requireAdmin, supabaseRequest } from "../../lib/supabase-server.js";

const validActions = new Set(["ACCEPT", "DECLINE"]);

export default async function handler(request, response) {
  if (!allowMethod(request, response, ["GET", "POST"])) return;
  if (!requireAdmin(request, response)) return;

  try {
    if (request.method === "GET") {
      const rows = await supabaseRequest("/o8_memory_proposals?select=id,target_address,proposer_address,title,question,status,evidence,created_at,reviewed_at&order=created_at.desc&limit=64");
      response.setHeader("Cache-Control", "no-store");
      return response.status(200).json({ proposals: rows });
    }

    const proposalId = Number(request.body?.proposalId);
    const action = String(request.body?.action || "").toUpperCase();
    if (!Number.isSafeInteger(proposalId) || proposalId < 1 || !validActions.has(action)) {
      return response.status(400).json({ error: "proposalId and a valid review action are required" });
    }

    const rows = await supabaseRequest(`/o8_memory_proposals?id=eq.${proposalId}&select=*`);
    const proposal = rows?.[0];
    if (!proposal) return response.status(404).json({ error: "memory proposal not found" });
    if (proposal.status !== "PENDING") return response.status(409).json({ error: "memory proposal has already been reviewed" });

    const reviewedAt = new Date().toISOString();
    const nextStatus = action === "ACCEPT" ? "ACCEPTED" : "DECLINED";
    const reviewEvidence = {
      ...(proposal.evidence || {}),
      reviewedBy: "COMB_CONTROL",
      reviewedAt,
      reviewAction: action,
    };
    const [updated] = await supabaseRequest(`/o8_memory_proposals?id=eq.${proposalId}`, {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ status: nextStatus, reviewed_at: reviewedAt, evidence: reviewEvidence }),
    });

    let hiveCell = null;
    if (action === "ACCEPT") {
      const targetAddress = proposal.target_address || "unbound";
      const cellRows = await supabaseRequest("/o8_hive_cells", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({
          cell_key: `community-proposal-${proposal.id}`,
          cell_type: "COMMUNITY_MEMORY",
          status: "RETAINED",
          title: proposal.title,
          description: proposal.question,
          truth: "RULE",
          source_event_id: null,
          target_address: targetAddress,
          observed_block: null,
          evidence: { ...reviewEvidence, proposalId: proposal.id, proposerAddress: proposal.proposer_address || null },
        }),
      });
      hiveCell = cellRows?.[0] || null;
    }

    response.setHeader("Cache-Control", "no-store");
    return response.status(200).json({ proposal: updated, hiveCell });
  } catch (error) {
    return response.status(503).json({ error: "memory review unavailable" });
  }
}
