import { allowMethod, supabaseRequest } from "../../lib/supabase-server.js";

export default async function handler(request, response) {
  if (!allowMethod(request, response, ["GET"])) return;
  try {
    const afterId = Math.max(0, Number.parseInt(request.query.afterId || "0", 10) || 0);
    const limit = Math.min(100, Math.max(1, Number.parseInt(request.query.limit || "40", 10) || 40));
    const after = afterId ? `&id=gt.${afterId}` : "";
    const [targets, recentItems, lifecycleRecords, storyMilestones, microMilestones] = await Promise.all([
      supabaseRequest("/o8_token_targets?id=eq.o8&select=token_address,status&limit=1"),
      supabaseRequest(`/o8_events?select=id,created_at,type,source,truth,text,metadata${after}&order=id.desc&limit=${Math.max(limit, 100)}`),
      supabaseRequest("/o8_lifecycle_events?select=id,target_address,phase_code,phase_name,title,description,truth,observed_block,evidence,occurred_at&order=occurred_at.desc&limit=32"),
      supabaseRequest("/o8_story_milestones?select=id,target_address,event_key,event_type,title,description,truth,source,observed_block,evidence,occurred_at&order=occurred_at.desc&limit=64"),
      supabaseRequest("/o8_micro_milestones?select=id,target_address,milestone_key,milestone_type,title,description,truth,observed_block,evidence,occurred_at&order=occurred_at.desc&limit=64"),
    ]);
    const activeTarget = targets?.[0]?.token_address?.toLowerCase() || null;
    const liveItems = activeTarget
      ? recentItems.filter((item) => item.metadata?.tokenAddress?.toLowerCase() === activeTarget)
      : recentItems.filter((item) => !item.metadata?.tokenAddress);
    const targetRecords = (records) => activeTarget
      ? records.filter((record) => record.target_address?.toLowerCase() === activeTarget)
      : [];

    // These tables are the canonical retained history. Keeping them in the
    // read model prevents a cleared/transient event stream from making the
    // public memory panel look as though the target was never observed.
    const retainedLifecycle = targetRecords(lifecycleRecords).map((record) => ({
      id: `lifecycle-${record.id}`,
      created_at: record.occurred_at,
      type: "lifecycle_phase",
      source: "COMB-LIFECYCLE",
      truth: record.truth || "RULE",
      text: `${record.title} ${record.description}`,
      metadata: { ...(record.evidence || {}), tokenAddress: record.target_address, coverage: "TARGET_SCOPED", observedBlock: record.observed_block, phaseCode: record.phase_code, phaseName: record.phase_name, retainedKind: "LIFECYCLE" },
    }));
    const retainedStories = targetRecords(storyMilestones).map((record) => ({
      id: `story-${record.id}`,
      created_at: record.occurred_at,
      type: record.event_type || "story_milestone",
      source: record.source || "COMB-STORY",
      truth: record.truth || "RULE",
      text: `${record.title} ${record.description}`,
      metadata: { ...(record.evidence || {}), tokenAddress: record.target_address, coverage: "TARGET_SCOPED", observedBlock: record.observed_block, eventKey: record.event_key, retainedKind: "STORY" },
    }));
    const retainedMicroMilestones = targetRecords(microMilestones).map((record) => ({
      id: `milestone-${record.id}`,
      created_at: record.occurred_at,
      type: record.milestone_type || "micro_milestone",
      source: "COMB-MILESTONE",
      truth: record.truth || "RULE",
      text: `${record.title} ${record.description}`,
      metadata: { ...(record.evidence || {}), tokenAddress: record.target_address, coverage: "TARGET_SCOPED", observedBlock: record.observed_block, milestoneKey: record.milestone_key, retainedKind: "MICRO_MILESTONE" },
    }));
    const items = [...liveItems, ...retainedLifecycle, ...retainedStories, ...retainedMicroMilestones]
      .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime())
      .slice(0, limit);
    response.setHeader("Cache-Control", "no-store");
    response.status(200).json({
      items: items.map((item) => ({ id: item.id, at: item.created_at, type: item.type, source: item.source, truth: item.truth, text: item.text, metadata: item.metadata })),
      latestId: liveItems.reduce((latest, item) => Math.max(latest, Number(item.id) || 0), afterId),
    });
  } catch (error) {
    response.status(503).json({ error: "feed unavailable", detail: error.message });
  }
}
