import { keccak256, toBytes, toFunctionSelector } from "viem";

const protocolSender = "0x00000000000000000000000000000000000a4b05";
const zeroAddress = "0x0000000000000000000000000000000000000000";
const highValueThreshold = 100n * 10n ** 18n;

const eventKinds = new Map([
  [keccak256(toBytes("Transfer(address,address,uint256)")), "transfer"],
  [keccak256(toBytes("Approval(address,address,uint256)")), "approval"],
  [keccak256(toBytes("OwnershipTransferred(address,address)")), "ownership_transferred"],
  [keccak256(toBytes("Upgraded(address)")), "proxy_upgraded"],
  [keccak256(toBytes("AdminChanged(address,address)")), "proxy_admin_changed"],
  [keccak256(toBytes("Paused(address)")), "paused"],
  [keccak256(toBytes("Unpaused(address)")), "unpaused"],
  [keccak256(toBytes("RoleGranted(bytes32,address,address)")), "role_granted"],
  [keccak256(toBytes("RoleRevoked(bytes32,address,address)")), "role_revoked"],
  [keccak256(toBytes("Swap(address,uint256,uint256,uint256,uint256,address)")), "swap_v2"],
  [keccak256(toBytes("Swap(address,address,int256,int256,uint160,uint128,int24)")), "swap_v3"],
]);

const adminActions = new Map([
  [toFunctionSelector("upgradeTo(address)"), "upgrade_to"],
  [toFunctionSelector("upgradeToAndCall(address,bytes)"), "upgrade_to_and_call"],
  [toFunctionSelector("changeAdmin(address)"), "change_admin"],
  [toFunctionSelector("transferOwnership(address)"), "transfer_ownership"],
  [toFunctionSelector("renounceOwnership()"), "renounce_ownership"],
  [toFunctionSelector("grantRole(bytes32,address)"), "grant_role"],
  [toFunctionSelector("revokeRole(bytes32,address)"), "revoke_role"],
  [toFunctionSelector("mint(address,uint256)"), "mint"],
  [toFunctionSelector("pause()"), "pause"],
  [toFunctionSelector("unpause()"), "unpause"],
]);

function numberFromHex(value) {
  if (!value || typeof value !== "string") return 0;
  return Number(BigInt(value));
}

function decimalFromHex(value) {
  if (!value || typeof value !== "string") return "0";
  return BigInt(value).toString(10);
}

function topicAddress(topic) {
  if (typeof topic !== "string" || topic.length !== 66) return null;
  return `0x${topic.slice(-40)}`.toLowerCase();
}

function selector(input) {
  return typeof input === "string" && input.length >= 10 ? input.slice(0, 10).toLowerCase() : null;
}

function receiptStatus(receipt) {
  if (!receipt?.status) return null;
  return BigInt(receipt.status) === 1n;
}

export function parseChainSnapshot(block, receipts = [], target = null) {
  const receiptMap = new Map(receipts.map((receipt) => [receipt.transactionHash?.toLowerCase(), receipt]));
  const senderCounts = new Map();
  let nativeValueWei = 0n;
  let nativeTransferCount = 0;
  let contractCallCount = 0;
  let contractCreationCount = 0;
  let failedTransactionCount = 0;
  let adminCallCount = 0;
  let highValueTransferCount = 0;

  const transactions = (block.transactions || []).map((transaction) => {
    const hash = transaction.hash.toLowerCase();
    const from = transaction.from?.toLowerCase();
    const to = transaction.to?.toLowerCase() || null;
    const type = numberFromHex(transaction.type);
    const value = BigInt(transaction.value || "0x0");
    const inputSelector = selector(transaction.input);
    const adminAction = inputSelector ? adminActions.get(inputSelector) || null : null;
    const receipt = receiptMap.get(hash);
    const isProtocol = type === 106 || from === protocolSender;
    const isCreation = !to;
    const isCall = Boolean(to && transaction.input && transaction.input !== "0x");

    if (!isProtocol && from) senderCounts.set(from, (senderCounts.get(from) || 0) + 1);
    if (value > 0n) {
      nativeTransferCount += 1;
      nativeValueWei += value;
      if (value >= highValueThreshold) highValueTransferCount += 1;
    }
    if (isCall && !isProtocol) contractCallCount += 1;
    if (isCreation) contractCreationCount += 1;
    if (receiptStatus(receipt) === false) failedTransactionCount += 1;
    if (adminAction) adminCallCount += 1;

    let classification = "plain_transaction";
    if (isProtocol) classification = "protocol_transaction";
    else if (isCreation) classification = "contract_creation";
    else if (adminAction) classification = "administrative_call";
    else if (isCall) classification = "contract_call";
    else if (value > 0n) classification = "native_transfer";

    return {
      hash,
      transaction_index: numberFromHex(transaction.transactionIndex),
      from_address: from,
      to_address: to,
      value_wei: value.toString(10),
      nonce: numberFromHex(transaction.nonce),
      transaction_type: type,
      input_selector: inputSelector,
      input_size: Math.max(0, Math.floor(((transaction.input?.length || 2) - 2) / 2)),
      classification,
      status: receiptStatus(receipt),
      gas_used: receipt?.gasUsed ? decimalFromHex(receipt.gasUsed) : "",
      effective_gas_price_wei: receipt?.effectiveGasPrice ? decimalFromHex(receipt.effectiveGasPrice) : "",
      contract_address: receipt?.contractAddress?.toLowerCase() || null,
      admin_action: adminAction,
    };
  });

  const events = receipts.flatMap((receipt) => (receipt.logs || []).map((log) => {
    const topics = log.topics || [];
    const topic0 = topics[0]?.toLowerCase() || null;
    const eventKind = eventKinds.get(topic0) || "unclassified";
    let fromAddress = null;
    let toAddress = null;
    let amountOrTokenId = "";
    if (eventKind === "transfer" || eventKind === "approval") {
      fromAddress = topicAddress(topics[1]);
      toAddress = topicAddress(topics[2]);
      const raw = topics[3] || (log.data && log.data !== "0x" ? log.data : null);
      if (raw) amountOrTokenId = BigInt(raw).toString(10);
    }
    return {
      transaction_hash: log.transactionHash.toLowerCase(),
      log_index: numberFromHex(log.logIndex),
      contract_address: log.address.toLowerCase(),
      topic0,
      topics,
      data: log.data || "0x",
      event_kind: eventKind,
      from_address: fromAddress,
      to_address: toAddress,
      amount_or_token_id_raw: amountOrTokenId,
    };
  }));

  const tokenAddress = target?.tokenAddress?.toLowerCase() || null;
  const poolAddress = target?.poolAddress?.toLowerCase() || null;
  const targetContracts = new Set([tokenAddress, poolAddress].filter(Boolean));
  const targetEvents = tokenAddress
    ? events.filter((event) => targetContracts.has(event.contract_address))
    : [];
  const targetTransactionHashes = new Set(targetEvents.map((event) => event.transaction_hash));
  const targetTransactions = tokenAddress
    ? transactions.filter((transaction) => targetContracts.has(transaction.to_address)
      || transaction.contract_address === tokenAddress
      || targetTransactionHashes.has(transaction.hash))
    : [];
  const tokenTransfers = targetEvents.filter((event) => event.contract_address === tokenAddress && event.event_kind === "transfer");
  const poolSwaps = poolAddress
    ? targetEvents.filter((event) => event.contract_address === poolAddress && ["swap_v2", "swap_v3"].includes(event.event_kind))
    : [];
  const buyTransfers = poolAddress ? tokenTransfers.filter((event) => event.from_address === poolAddress) : [];
  const sellTransfers = poolAddress ? tokenTransfers.filter((event) => event.to_address === poolAddress) : [];
  const mintTransfers = tokenTransfers.filter((event) => event.from_address === zeroAddress);
  const burnTransfers = tokenTransfers.filter((event) => event.to_address === zeroAddress);
  const participantAddresses = new Set(tokenTransfers.flatMap((event) => [event.from_address, event.to_address])
    .filter((address) => address && address !== zeroAddress && address !== poolAddress));
  const targetSenderCounts = new Map();
  for (const transaction of targetTransactions) {
    if (transaction.from_address) {
      targetSenderCounts.set(transaction.from_address, (targetSenderCounts.get(transaction.from_address) || 0) + 1);
    }
  }
  const sumRaw = (items) => items.reduce((sum, event) => sum + BigInt(event.amount_or_token_id_raw || "0"), 0n).toString(10);
  const targetSnapshot = tokenAddress ? {
    tokenAddress,
    poolAddress,
    status: target.status || null,
    transactionCount: targetTransactions.length,
    transactionHashes: targetTransactions.map((transaction) => transaction.hash).slice(0, 12),
    tokenTransferCount: tokenTransfers.length,
    transferVolumeRaw: sumRaw(tokenTransfers),
    buyTransferCount: buyTransfers.length,
    buyVolumeRaw: sumRaw(buyTransfers),
    sellTransferCount: sellTransfers.length,
    sellVolumeRaw: sumRaw(sellTransfers),
    mintTransferCount: mintTransfers.length,
    burnTransferCount: burnTransfers.length,
    poolSwapCount: poolSwaps.length,
    poolEventCount: targetEvents.filter((event) => event.contract_address === poolAddress).length,
    uniqueParticipantCount: participantAddresses.size,
    failedTransactionCount: targetTransactions.filter((transaction) => transaction.status === false).length,
    adminCallCount: targetTransactions.filter((transaction) => transaction.to_address === tokenAddress && transaction.admin_action).length,
    repeatedSenderCount: [...targetSenderCounts.values()].filter((count) => count >= 3).length,
    nativeValueWei: targetTransactions.reduce((sum, transaction) => sum + BigInt(transaction.value_wei || "0"), 0n).toString(10),
  } : null;

  return {
    block: {
      blockNumber: numberFromHex(block.number),
      blockHash: block.hash,
      parentHash: block.parentHash,
      timestamp: new Date(numberFromHex(block.timestamp) * 1000).toISOString(),
      transactionCount: transactions.length,
    },
    transactions,
    events,
    metrics: {
      nativeTransferCount,
      nativeValueWei: nativeValueWei.toString(10),
      transferEventCount: events.filter((event) => event.event_kind === "transfer").length,
      contractCallCount,
      contractCreationCount,
      failedTransactionCount,
      adminCallCount,
      repeatedSenderCount: [...senderCounts.values()].filter((count) => count >= 3).length,
      highValueTransferCount,
      uniqueSenderCount: senderCounts.size,
    },
    target: targetSnapshot,
  };
}
