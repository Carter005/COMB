import { randomUUID } from "node:crypto";
import { allowMethod, supabaseRequest } from "../../lib/supabase-server.js";
import { askMiniMax } from "../../lib/minimax.js";

const agentKeywords = {
  1: ["block", "rpc", "finality", "network", "区块", "节点", "确认", "网络"],
  2: ["flow", "swap", "volume", "momentum", "price", "资金", "交易", "成交量", "价格", "趋势", "买入", "卖出"],
  3: ["liquidity", "pool", "slippage", "lp", "curve", "流动性", "池子", "滑点", "内盘", "外盘", "毕业"],
  4: ["holder", "community", "distribution", "wallets", "持币", "社区", "钱包分布", "参与者"],
  5: ["contract", "permission", "mint", "upgrade", "risk", "合约", "权限", "增发", "升级", "风险"],
  6: ["anomaly", "bot", "coordinated", "funding", "异常", "机器人", "协同", "资金来源"],
  7: ["treasury", "reserve", "runway", "储备", "金库", "财库", "供应", "销毁"],
  8: ["memory", "remember", "consensus", "disagree", "system", "记忆", "共识", "分歧", "系统"],
};

function selectAgent(question, arms) {
  const normalized = question.toLowerCase();
  const numbered = normalized.match(/(?:arm\s*[-#:]?\s*)?(0?[1-8])\b/i);
  if (numbered) return { agent: arms.find((arm) => arm.id === Number(numbered[1])), matched: true };
  const named = arms.find((arm) => normalized.includes(arm.agent_name.toLowerCase()));
  if (named) return { agent: named, matched: true };
  const scored = arms.map((arm) => ({
    arm,
    score: (agentKeywords[arm.id] || []).reduce((sum, keyword) => sum + (normalized.includes(keyword) ? 1 : 0), 0),
  })).sort((a, b) => b.score - a.score || a.arm.id - b.arm.id);
  return scored[0].score > 0
    ? { agent: scored[0].arm, matched: true }
    : { agent: arms.find((arm) => arm.id === 8), matched: false };
}

function normalizeCitations(text, validEvidence) {
  return text.replace(/\[((?:E\d+)(?:\s*,\s*E\d+)*)\]/g, (_, group) => group
    .split(",")
    .map((item) => Number(item.trim().slice(1)))
    .filter((id, index, ids) => validEvidence.has(id) && ids.indexOf(id) === index)
    .map((id) => `[E${id}]`)
    .join(""));
}

function fitTerminalAnswer(text) {
  const normalized = text.replace(/[\u0400-\u04ff]+/g, " ").replace(/\s+/g, " ").trim();
  const hasChinese = /[\u3400-\u9fff]/.test(normalized);
  const limit = hasChinese ? 420 : 920;
  if (normalized.length <= limit) return normalized;
  const sentences = normalized.split(/(?<=[.!?\u3002\uff01\uff1f])\s+/);
  const fitted = [];
  for (const sentence of sentences) {
    const candidate = [...fitted, sentence].join(" ");
    if (candidate.length > limit) break;
    fitted.push(sentence);
  }
  if (fitted.length) return fitted.join(" ");
  return `${normalized.slice(0, limit - 3).trimEnd()}...`;
}

function formatNativeValue(weiValue) {
  const wei = BigInt(weiValue || "0");
  const base = 10n ** 18n;
  const whole = wei / base;
  const fraction = (wei % base).toString().padStart(18, "0").replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole.toString();
}

function compactEvidence({ specimen, events, source, bindings, chainBlocks, chainTransactions, chainEvents, tokenTarget, tokenLifecycle }) {
  const blockNumbers = new Set(chainBlocks.map((block) => Number(block.block_number)));
  const transactions = chainTransactions.filter((tx) => blockNumbers.has(Number(tx.block_number)));
  const transactionShape = (tx) => ({
    hash: tx.hash,
    blockNumber: tx.block_number,
    index: tx.transaction_index,
    from: tx.from_address,
    to: tx.to_address,
    valueWei: tx.value_wei,
    valueEth: formatNativeValue(tx.value_wei),
    selector: tx.input_selector,
    classification: tx.classification,
    status: tx.status,
    gasUsed: tx.gas_used,
    contractAddress: tx.contract_address,
    adminAction: tx.admin_action,
  });
  const repeatedSenders = new Map();
  transactions.filter((tx) => tx.classification !== "protocol_transaction").forEach((tx) => {
    const key = `${tx.block_number}:${tx.from_address}`;
    const current = repeatedSenders.get(key) || { blockNumber: tx.block_number, from: tx.from_address, hashes: [] };
    current.hashes.push(tx.hash);
    repeatedSenders.set(key, current);
  });
  const transactionDetailCoverage = chainBlocks.map((block) => {
    const loaded = transactions.filter((tx) => Number(tx.block_number) === Number(block.block_number)).length;
    return {
      blockNumber: block.block_number,
      expected: block.transaction_count,
      loaded,
      complete: loaded === Number(block.transaction_count),
    };
  });
  return JSON.stringify({
    systemState: {
      status: specimen.status,
      updatedAt: specimen.updated_at,
    },
    bindings: bindings.map((item) => item.id === "minimax" ? {
      id: "agent-voices",
      status: item.details?.providerConfigured ? "READY" : "DORMANT",
      details: { agents: ["WATCHER", "CURRENT", "DEPTH", "CHORUS", "AUDITOR", "HUNTER", "KEEPER", "ARCHIVE"] },
    } : { id: item.id, status: item.status, details: item.details }),
    externalSource: source ? { id: source.id, status: source.status, truth: source.truth, payload: source.payload } : null,
    ponsTokenTarget: tokenTarget ? {
      platform: tokenTarget.platform,
      status: tokenTarget.status,
      name: tokenTarget.token_name,
      symbol: tokenTarget.symbol,
      tokenAddress: tokenTarget.token_address,
      deployer: tokenTarget.deployer_address,
      pool: tokenTarget.pool_address,
      pairToken: tokenTarget.pair_token_address,
      launchTxHash: tokenTarget.launch_tx_hash,
      launchBlock: tokenTarget.launch_block,
      launchedAt: tokenTarget.launched_at,
      graduationProgressPct: tokenTarget.graduation_progress,
      pairedPrincipalWei: tokenTarget.paired_principal_wei,
      graduationThresholdWei: tokenTarget.graduation_threshold_wei,
      graduated: tokenTarget.graduated,
      metadata: tokenTarget.metadata,
    } : null,
    ponsLifecycle: tokenLifecycle.map((item) => ({
      observedAt: item.observed_at,
      status: item.status,
      graduationProgressPct: item.graduation_progress,
      pairedPrincipalWei: item.paired_principal_wei,
      graduationThresholdWei: item.graduation_threshold_wei,
      pool: item.pool_address,
      observedBlock: item.observed_block,
    })),
    retainedEvents: events.map((item) => ({ id: item.id, at: item.created_at, source: item.source, truth: item.truth, type: item.type, text: item.text, metadata: item.metadata })),
    sampledChainBlocks: chainBlocks.map((block) => ({
      blockNumber: block.block_number,
      at: block.block_timestamp,
      transactionCount: block.transaction_count,
      sampledGap: block.sampled_gap,
      nativeTransferCount: block.native_transfer_count,
      nativeValueWei: block.native_value_wei,
      nativeValueEth: formatNativeValue(block.native_value_wei),
      transferEventCount: block.transfer_event_count,
      contractCallCount: block.contract_call_count,
      contractCreationCount: block.contract_creation_count,
      failedTransactionCount: block.failed_transaction_count,
      adminCallCount: block.admin_call_count,
      repeatedSenderCount: block.repeated_sender_count,
      highValueTransferCount: block.high_value_transfer_count,
      coverage: block.coverage,
    })),
    transactionDetailCoverage,
    sampledChainSignals: {
      nativeValueTransactions: transactions.filter((tx) => BigInt(tx.value_wei || "0") > 0n).slice(0, 20).map(transactionShape),
      failedTransactions: transactions.filter((tx) => tx.status === false).slice(0, 20).map(transactionShape),
      knownAdministrativeTransactions: transactions.filter((tx) => tx.admin_action).slice(0, 20).map(transactionShape),
      repeatedSendersInOneSampledBlock: [...repeatedSenders.values()]
        .filter((item) => item.hashes.length >= 3)
        .slice(0, 12)
        .map((item) => ({ ...item, transactionCount: item.hashes.length })),
      recentTransactions: transactions.slice(0, 16).map(transactionShape),
    },
    sampledEvents: chainEvents.map((event) => ({
      transactionHash: event.transaction_hash,
      blockNumber: event.block_number,
      logIndex: event.log_index,
      contract: event.contract_address,
      kind: event.event_kind,
      from: event.from_address,
      to: event.to_address,
      amountOrTokenIdRaw: event.amount_or_token_id_raw,
    })),
  });
}

async function getConversation(sessionId) {
  const encoded = encodeURIComponent(sessionId);
  const existing = await supabaseRequest(`/o8_conversations?session_id=eq.${encoded}&status=eq.active&select=id&order=created_at.desc&limit=1`);
  if (existing[0]) return existing[0];
  const created = await supabaseRequest("/o8_conversations", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ session_id: sessionId }),
  });
  return created[0];
}

export default async function handler(request, response) {
  if (!allowMethod(request, response, ["POST"])) return;
  const question = String(request.body?.q || "").trim().slice(0, 500);
  const suppliedSession = String(request.body?.sessionId || "").trim();
  const sessionId = /^[a-zA-Z0-9_-]{12,80}$/.test(suppliedSession) ? suppliedSession : randomUUID();
  if (!question) return response.status(400).json({ error: "question required" });

  try {
    const [specimens, arms, events, sources, bindings, chainBlocks, chainTransactions, chainEvents, tokenTargets, tokenLifecycle] = await Promise.all([
      supabaseRequest("/o8_specimen?id=eq.o8&select=*"),
      supabaseRequest("/o8_arms?select=*&order=id.asc"),
      supabaseRequest("/o8_events?select=id,created_at,type,source,truth,text,metadata&order=id.desc&limit=100"),
      supabaseRequest("/o8_sources?select=id,status,truth,payload&order=id.asc&limit=4"),
      supabaseRequest("/o8_system_bindings?select=id,status,details"),
      supabaseRequest("/o8_chain_blocks?select=*&order=block_number.desc&limit=5"),
      supabaseRequest("/o8_chain_transactions?select=hash,block_number,transaction_index,from_address,to_address,value_wei,input_selector,classification,status,gas_used,contract_address,admin_action&order=block_number.desc,transaction_index.asc&limit=200"),
      supabaseRequest("/o8_chain_events?select=transaction_hash,block_number,log_index,contract_address,event_kind,from_address,to_address,amount_or_token_id_raw&order=block_number.desc,log_index.asc&limit=200"),
      supabaseRequest("/o8_token_targets?id=eq.o8&select=*"),
      supabaseRequest("/o8_token_lifecycle_snapshots?target_id=eq.o8&select=*&order=id.desc&limit=8"),
    ]);
    const specimen = specimens[0];
    const tokenTarget = tokenTargets[0];
    const targetAddress = tokenTarget?.token_address?.toLowerCase() || null;
    const poolAddress = tokenTarget?.pool_address?.toLowerCase() || null;
    const targetContracts = new Set([targetAddress, poolAddress].filter(Boolean));
    const scopedEvents = (targetAddress
      ? events.filter((event) => event.metadata?.tokenAddress?.toLowerCase() === targetAddress)
      : events.filter((event) => !event.metadata?.tokenAddress)).slice(0, 20);
    const scopedChainEvents = targetAddress
      ? chainEvents.filter((event) => targetContracts.has(event.contract_address?.toLowerCase()))
      : chainEvents;
    const scopedHashes = new Set(scopedChainEvents.map((event) => event.transaction_hash?.toLowerCase()));
    const scopedChainTransactions = targetAddress
      ? chainTransactions.filter((transaction) => targetContracts.has(transaction.to_address?.toLowerCase())
        || targetContracts.has(transaction.contract_address?.toLowerCase())
        || scopedHashes.has(transaction.hash?.toLowerCase()))
      : chainTransactions;
    const conversation = await getConversation(sessionId);
    const historyTarget = targetAddress
      ? `context_target_address=eq.${targetAddress}`
      : "context_target_address=is.null";
    const history = await supabaseRequest(`/o8_messages?conversation_id=eq.${conversation.id}&${historyTarget}&select=role,content,agent_id&order=id.desc&limit=6`);
    const decision = selectAgent(question, arms);
    const previousAgentId = history.find((item) => item.role === "agent" || item.role === "o8")?.agent_id;
    const agent = !decision.matched && previousAgentId
      ? arms.find((item) => item.id === previousAgentId) || decision.agent
      : decision.agent;
    const evidenceIds = scopedEvents.map((event) => event.id);
    const chainReady = Boolean(bindings.find((item) => item.id === "robinhood-chain")?.details?.rpcConfigured)
      && sources.some((item) => item.id === "robinhood-mainnet" && item.status === "CONNECTED");
    const domainGuard = {
      2: targetAddress
        ? "CURRENT may report exact O8-scoped token transfer counts and raw amounts. Pool-to-wallet and wallet-to-pool are observed transfer directions, not guaranteed economic buys or sells. It must not infer price momentum or net flow."
        : "CURRENT may report exact sampled network counts and native-value amounts. It must not describe momentum, direction, trend, net flow, opportunity, or price because those facts are not derived here.",
      3: "DEPTH may report verified Pons curve progress, paired principal, graduation threshold, pool address, pool liquidity, and exact sampled pool events. It must not infer price direction or slippage without supplied evidence.",
      4: "CHORUS may report only distinct participant addresses observed in sampled O8 transfer events. This is not a complete holder count, holder distribution, or community-size measurement.",
      5: "AUDITOR may report exact target-scoped status, selectors, contract addresses, failures, and known adminAction values. Unknown selectors remain unnamed and do not establish risk or safety.",
      6: "HUNTER may report only explicit target-scoped repeated-sender rule results. A rule match is an observation, not a bot verdict, coordination claim, intent, or attribution.",
      7: "KEEPER may report verified Pons paired principal, pool activity, and exact mint or burn transfer counts. It must not call these project treasury balances or infer treasury ownership.",
    }[agent.id];
    const languageGuard = /[\u3400-\u9fff]/.test(question)
      ? "The visitor wrote in Chinese. Answer entirely in Chinese except exact registered names, addresses, hashes, and status codes."
      : "The visitor wrote in English. Answer in English.";
    const tokenGuard = tokenTarget?.status === "AWAITING_LAUNCH"
      ? "$O8 has no registered token address. For $O8 launch questions, report only the verified Pons platform configuration and the absence of a registered token. Do not use unrelated sampled transactions, swaps, approvals, pools, prices, or graduations as $O8 evidence."
      : "Use only the registered $O8 target and its lifecycle records for token-specific claims.";
    const system = [
      `You are ARM-${String(agent.id).padStart(2, "0")} ${agent.agent_name}, one of eight agents in THE OCTOPUS (O8).`,
      `Role: ${agent.role}. Domain: ${agent.domain}. Temperament: ${agent.temperament}. Current mood: ${agent.mood}. Voice: ${agent.voice}.`,
      "Answer in the same language as the visitor. Output one compact paragraph, at most 5 sentences and at most 180 Chinese characters or 120 English words.",
      "Use only facts present in EVIDENCE. Never invent chain activity, token status, prices, transactions, predictions, consciousness, or agent work that did not occur.",
      "Emotion changes wording only, never facts. State missing or unbound data directly. Cite relevant retained event IDs as [E123] when available.",
      "The only valid agent names are WATCHER, CURRENT, DEPTH, CHORUS, AUDITOR, HUNTER, KEEPER, and ARCHIVE. Never create another agent, node, mode, or subsystem name.",
      "Do not infer facts from missing data. Event citations are optional; use one only when that exact retained event and its metadata directly support the sentence.",
      "Never abbreviate an address or transaction hash. List at most three full hashes; if more exist, report the exact count and say only three are shown.",
      "Use supplied valueEth and nativeValueEth strings exactly. Never calculate, round, or rewrite a wei-to-ETH conversion yourself.",
      "A selector is opaque unless EVIDENCE supplies adminAction. Never attach a function name such as multicall to an otherwise unknown selector.",
      "repeatedSenderCount means the number of non-protocol senders that each submitted at least three transactions inside that one sampled block. It says nothing about recurrence across blocks, bots, intent, or coordination.",
      "Use transactionDetailCoverage before claiming transaction-level completeness. If complete is false, distinguish the block summary count from the loaded transaction details.",
      "When answering in English, use ASCII punctuation and do not emit Cyrillic characters.",
      languageGuard,
      domainGuard,
      tokenGuard,
      "Model vendor and infrastructure names are private implementation details. Never mention MiniMax, M3, model providers, APIs, endpoints, regions, or provider connectivity.",
      "Speak only through the registered arm identities: WATCHER, CURRENT, DEPTH, CHORUS, AUDITOR, HUNTER, KEEPER, and ARCHIVE.",
      chainReady
        ? targetAddress
          ? `TARGET MODE is active for ${targetAddress}${poolAddress ? ` and verified pool ${poolAddress}` : ""}. Token-specific answers must use only target-scoped retained events, target contract or pool logs, and Pons lifecycle evidence.`
          : "NETWORK MODE is active. Robinhood Chain mainnet is the sole connected market evidence source; do not infer O8 token activity before a CA is registered."
        : "There are zero connected market evidence sources because Robinhood Chain is unavailable.",
      "All chain observations are sampled, not complete chain coverage. Never describe sampled counts as total network counts. Never infer intent, coordination, price direction, or risk from a selector or repeated sender alone.",
      "Pons lifecycle facts may be reported only from ponsTokenTarget, ponsLifecycle, and the pons-launchpad binding. AWAITING_LAUNCH means the launchpad is verified but no $O8 token address has been registered; it does not mean a token exists.",
      `EVIDENCE: ${compactEvidence({ specimen, events: scopedEvents, source: sources.find((item) => item.id === "robinhood-mainnet"), bindings, chainBlocks, chainTransactions: scopedChainTransactions, chainEvents: scopedChainEvents, tokenTarget, tokenLifecycle })}`,
    ].join("\n");
    const messages = [
      ...history.reverse().map((item) => ({ role: item.role === "user" ? "user" : "assistant", content: item.content })),
      { role: "user", content: question },
    ];

    await supabaseRequest("/o8_messages", {
      method: "POST",
      body: JSON.stringify({ conversation_id: conversation.id, role: "user", content: question, context_target_address: targetAddress }),
    });

    const result = await askMiniMax({ system, messages, maxTokens: 440 });
    const validEvidence = new Set(evidenceIds);
    const normalizedCitations = normalizeCitations(result.answer, validEvidence);
    const answer = fitTerminalAnswer(normalizedCitations.replace(/\[E(\d+)\]/g, (citation, id) => validEvidence.has(Number(id)) ? citation : ""));
    const citedEvidenceIds = [...new Set([...answer.matchAll(/\[E(\d+)\]/g)].map((match) => Number(match[1])))];
    await Promise.all([
      supabaseRequest("/o8_messages", {
        method: "POST",
        body: JSON.stringify({ conversation_id: conversation.id, role: "agent", agent_id: agent.id, content: answer, evidence: citedEvidenceIds, context_target_address: targetAddress }),
      }),
      supabaseRequest("/o8_agent_runs", {
        method: "POST",
        body: JSON.stringify({
          conversation_id: conversation.id,
          agent_id: agent.id,
          mood: agent.mood,
          provider: "MiniMax",
          model: result.model,
          status: "completed",
          target_address: targetAddress,
          input_evidence: evidenceIds,
          interpretation: answer,
          latency_ms: result.latencyMs,
          token_usage: result.usage,
        }),
      }),
      supabaseRequest(`/o8_conversations?id=eq.${conversation.id}`, {
        method: "PATCH",
        body: JSON.stringify({ updated_at: new Date().toISOString() }),
      }),
    ]);

    response.setHeader("Cache-Control", "no-store");
    response.status(200).json({
      answer,
      sessionId,
      evidenceEventIds: citedEvidenceIds,
      agent: { id: agent.id, name: agent.agent_name, role: agent.role, mood: agent.mood },
      latencyMs: result.latencyMs,
    });
  } catch (error) {
    response.status(503).json({ error: "agent response unavailable" });
  }
}
