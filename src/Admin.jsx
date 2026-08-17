import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  Check,
  Copy,
  ExternalLink,
  KeyRound,
  Link2,
  LogOut,
  Radio,
  RefreshCw,
  Save,
  ShieldCheck,
  Trash2,
} from "lucide-react";

const adminSessionKey = "comb-admin-access";

function shortAddress(value) {
  return value ? `${value.slice(0, 10)}...${value.slice(-8)}` : "UNBOUND";
}

function statusTone(value) {
  if (["CONNECTED", "TARGET_ACTIVE", "CURVE_ACTIVE", "GRADUATED", "READY"].includes(value)) return "ok";
  if (["VERIFYING", "AWAITING_LAUNCH", "UNBOUND"].includes(value)) return "warn";
  return "muted";
}

function AdminMetric({ label, value, tone = "" }) {
  return <div className="admin-metric"><span>{label}</span><strong className={tone}>{value}</strong></div>;
}

function CopyValue({ value, label }) {
  const [copied, setCopied] = useState(false);
  if (!value) return <span className="admin-empty">UNBOUND</span>;
  async function copy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }
  return (
    <span className="admin-copy-row">
      <code title={value}>{value}</code>
      <button type="button" className="admin-icon-button" onClick={copy} aria-label={`Copy ${label}`} title={`Copy ${label}`}>
        {copied ? <Check size={14} /> : <Copy size={14} />}
      </button>
    </span>
  );
}

export default function Admin() {
  const [accessKey, setAccessKey] = useState(() => window.sessionStorage.getItem(adminSessionKey) || "");
  const [authenticated, setAuthenticated] = useState(false);
  const [checking, setChecking] = useState(Boolean(accessKey));
  const [state, setState] = useState(null);
  const [twitterUrl, setTwitterUrl] = useState("");
  const [tokenAddress, setTokenAddress] = useState("");
  const [launchTxHash, setLaunchTxHash] = useState("");
  const [clearConfirmed, setClearConfirmed] = useState(false);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState(null);

  const bindings = useMemo(
    () => Object.fromEntries((state?.bindings || []).map((binding) => [binding.id, binding])),
    [state],
  );
  const targetMonitor = bindings["target-monitor"];
  const railway = bindings["railway-observer"];
  const pons = bindings["pons-launchpad"];
  const targetMode = targetMonitor?.details?.mode || "NETWORK";

  const authorizedFetch = useCallback(async (url, options = {}) => {
    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessKey}`,
        ...options.headers,
      },
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || `request failed (${response.status})`);
    return body;
  }, [accessKey]);

  const refresh = useCallback(async ({ quiet = false } = {}) => {
    if (!quiet) setBusy("refresh");
    try {
      const [nextState, config] = await Promise.all([
        fetch("/api/o8/state", { cache: "no-store" }).then((response) => {
          if (!response.ok) throw new Error("state unavailable");
          return response.json();
        }),
        authorizedFetch("/api/o8/config", { method: "GET" }),
      ]);
      setState(nextState);
      setTwitterUrl(config.details?.twitterUrl || "");
      setAuthenticated(true);
      window.sessionStorage.setItem(adminSessionKey, accessKey);
      return true;
    } catch (error) {
      if (!quiet) setNotice({ tone: "error", text: error.message });
      if (error.message === "unauthorized") {
        setAuthenticated(false);
        window.sessionStorage.removeItem(adminSessionKey);
      }
      return false;
    } finally {
      setChecking(false);
      if (!quiet) setBusy("");
    }
  }, [accessKey, authorizedFetch]);

  useEffect(() => {
    if (accessKey && !authenticated) refresh({ quiet: true });
  }, []); // Validate the session key once on entry.

  useEffect(() => {
    if (!authenticated) return undefined;
    const interval = window.setInterval(() => refresh({ quiet: true }), 5000);
    return () => window.clearInterval(interval);
  }, [authenticated, refresh]);

  async function login(event) {
    event.preventDefault();
    setNotice(null);
    setChecking(true);
    const valid = await refresh();
    if (valid) setNotice({ tone: "success", text: "ADMIN SESSION AUTHORIZED" });
  }

  function logout() {
    window.sessionStorage.removeItem(adminSessionKey);
    setAccessKey("");
    setAuthenticated(false);
    setState(null);
    setNotice(null);
  }

  async function bindToken(event) {
    event.preventDefault();
    setBusy("bind");
    setNotice(null);
    try {
      const result = await authorizedFetch("/api/o8/register-token", {
        method: "POST",
        body: JSON.stringify({ tokenAddress: tokenAddress.trim(), launchTxHash: launchTxHash.trim() || null }),
      });
      setNotice({ tone: "success", text: `CA ACCEPTED / ${result.status}` });
      setTokenAddress("");
      setLaunchTxHash("");
      await refresh({ quiet: true });
    } catch (error) {
      setNotice({ tone: "error", text: error.message.toUpperCase() });
    } finally {
      setBusy("");
    }
  }

  async function clearToken() {
    if (!clearConfirmed) return;
    setBusy("clear");
    setNotice(null);
    try {
      await authorizedFetch("/api/o8/register-token", { method: "DELETE" });
      setClearConfirmed(false);
      setNotice({ tone: "success", text: "TARGET DATA CLEARED / NETWORK MODE RESTORED" });
      await refresh({ quiet: true });
    } catch (error) {
      setNotice({ tone: "error", text: error.message.toUpperCase() });
    } finally {
      setBusy("");
    }
  }

  async function saveTwitter(event) {
    event.preventDefault();
    setBusy("twitter");
    setNotice(null);
    try {
      const result = await authorizedFetch("/api/o8/config", {
        method: "POST",
        body: JSON.stringify({ twitterUrl: twitterUrl.trim() || null }),
      });
      setTwitterUrl(result.details?.twitterUrl || "");
      setNotice({ tone: "success", text: result.status === "CONNECTED" ? "X LINK PUBLISHED" : "X LINK CLEARED" });
    } catch (error) {
      setNotice({ tone: "error", text: error.message.toUpperCase() });
    } finally {
      setBusy("");
    }
  }

  async function clearTwitter() {
    setBusy("twitter-clear");
    setNotice(null);
    try {
      await authorizedFetch("/api/o8/config", {
        method: "POST",
        body: JSON.stringify({ twitterUrl: null }),
      });
      setTwitterUrl("");
      setNotice({ tone: "success", text: "X LINK CLEARED" });
    } catch (error) {
      setNotice({ tone: "error", text: error.message.toUpperCase() });
    } finally {
      setBusy("");
    }
  }

  async function reviewProposal(proposalId, action) {
    setBusy(`proposal-${proposalId}`);
    setNotice(null);
    try {
      await authorizedFetch("/api/o8/review-memory", { method: "POST", body: JSON.stringify({ proposalId, action }) });
      setNotice({ tone: "success", text: action === "ACCEPT" ? "MEMORY ACCEPTED / HIVE CELL RETAINED" : "MEMORY PROPOSAL DECLINED" });
      await refresh({ quiet: true });
    } catch (error) {
      setNotice({ tone: "error", text: error.message.toUpperCase() });
    } finally {
      setBusy("");
    }
  }

  if (!authenticated) {
    return (
      <main className="admin-login-shell">
        <form className="admin-login" onSubmit={login}>
          <div className="admin-login-mark"><ShieldCheck size={24} /><span>COMB CONTROL</span></div>
          <label htmlFor="admin-key">ADMIN ACCESS KEY</label>
          <div className="admin-login-input">
            <KeyRound size={15} />
            <input id="admin-key" type="password" autoComplete="current-password" value={accessKey} onChange={(event) => setAccessKey(event.target.value)} required />
          </div>
          <button type="submit" disabled={checking || !accessKey}>{checking ? <RefreshCw size={14} className="spin" /> : <ShieldCheck size={14} />} AUTHORIZE</button>
          {notice && <div className={`admin-notice ${notice.tone}`} role="status">{notice.text}</div>}
          <a href="/">RETURN TO PUBLIC TERMINAL</a>
        </form>
      </main>
    );
  }

  const token = state?.token;
  const pendingProposals = (state?.memoryProposals || []).filter((proposal) => proposal.status === "PENDING");
  const activeArms = state?.arms?.filter((arm) => !["STANDBY", "OFFLINE"].includes(arm.state)).length || 0;
  const explorer = "https://robinhoodchain.blockscout.com";

  return (
    <main className="admin-shell">
      <header className="admin-header">
        <div>
          <span className="admin-kicker">COMB / RESTRICTED CONTROL SURFACE</span>
          <h1>THE HIVE CONTROL</h1>
        </div>
        <div className="admin-header-actions">
          <a href="/" target="_blank" rel="noreferrer"><ExternalLink size={14} /> PUBLIC TERMINAL</a>
          <button type="button" onClick={() => refresh()} disabled={busy === "refresh"}><RefreshCw size={14} className={busy === "refresh" ? "spin" : ""} /> REFRESH</button>
          <button type="button" onClick={logout}><LogOut size={14} /> LOCK</button>
        </div>
      </header>

      <section className="admin-status-strip" aria-label="System status">
        <AdminMetric label="MODE" value={targetMode} tone={statusTone(targetMonitor?.status)} />
        <AdminMetric label="TOKEN" value={token?.status || "UNKNOWN"} tone={statusTone(token?.status)} />
        <AdminMetric label="PONS" value={pons?.status || "UNKNOWN"} tone={statusTone(pons?.status)} />
        <AdminMetric label="RAILWAY" value={railway?.status || "UNKNOWN"} tone={statusTone(railway?.status)} />
        <AdminMetric label="AGENTS" value={`${String(activeArms).padStart(2, "0")} / 08`} />
        <AdminMetric label="CHAIN HEAD" value={railway?.details?.head?.toLocaleString?.() || railway?.details?.head || "--"} />
      </section>

      {notice && <div className={`admin-notice admin-global-notice ${notice.tone}`} role="status">{notice.text}</div>}

      <section className="admin-grid">
        <section className="admin-section admin-target-section" aria-labelledby="target-heading">
          <div className="admin-section-heading">
            <div><span>01 / TARGET CONTROL</span><h2 id="target-heading">PONS TOKEN BINDING</h2></div>
            <strong className={statusTone(token?.status)}>{token?.status || "UNKNOWN"}</strong>
          </div>

          <div className="admin-target-readout">
            <div><span>TOKEN NAME</span><b>{token?.name || "$COMB / NOT LAUNCHED"}</b></div>
            <div><span>SYMBOL</span><b>{token?.symbol || "COMB"}</b></div>
            <div><span>CURVE</span><b>{token?.graduationProgressPct === null || token?.graduationProgressPct === undefined ? "--" : `${Number(token.graduationProgressPct).toFixed(2)}%`}</b></div>
            <div><span>GRADUATION</span><b>{pons?.details?.graduationThresholdEth ? `${pons.details.graduationThresholdEth} ETH` : "4.2 ETH"}</b></div>
          </div>

          <dl className="admin-address-list">
            <div><dt>TOKEN CA</dt><dd><CopyValue value={token?.tokenAddress} label="token CA" /></dd></div>
            <div><dt>POOL CA</dt><dd><CopyValue value={token?.poolAddress} label="pool CA" /></dd></div>
            <div><dt>LAUNCH TX</dt><dd><CopyValue value={token?.launchTxHash} label="launch transaction" /></dd></div>
          </dl>

          <form className="admin-form" onSubmit={bindToken}>
            <label htmlFor="token-ca">TOKEN CA</label>
            <input id="token-ca" value={tokenAddress} onChange={(event) => setTokenAddress(event.target.value)} placeholder="0x..." spellCheck="false" required />
            <label htmlFor="launch-tx">LAUNCH TX HASH / OPTIONAL</label>
            <input id="launch-tx" value={launchTxHash} onChange={(event) => setLaunchTxHash(event.target.value)} placeholder="0x..." spellCheck="false" />
            <button type="submit" disabled={busy === "bind"}><Link2 size={14} /> {busy === "bind" ? "BINDING" : "BIND PONS CA"}</button>
          </form>

          <div className="admin-danger-row">
            <label><input type="checkbox" checked={clearConfirmed} onChange={(event) => setClearConfirmed(event.target.checked)} /> CONFIRM TARGET DATA RESET</label>
            <button type="button" className="danger" onClick={clearToken} disabled={!clearConfirmed || busy === "clear"}><Trash2 size={14} /> {busy === "clear" ? "CLEARING" : "CLEAR CA"}</button>
          </div>
        </section>

        <section className="admin-section" aria-labelledby="runtime-heading">
          <div className="admin-section-heading">
            <div><span>02 / RUNTIME</span><h2 id="runtime-heading">OBSERVATION PIPELINE</h2></div>
            <Activity size={18} />
          </div>
          <div className="admin-runtime-list">
            <div><Radio size={14} /><span>NETWORK</span><b>{bindings["robinhood-chain"]?.status || "UNKNOWN"}</b></div>
            <div><Radio size={14} /><span>PONS FACTORY</span><b>{pons?.status || "UNKNOWN"}</b></div>
            <div><Radio size={14} /><span>TARGET MONITOR</span><b>{targetMonitor?.status || "UNKNOWN"}</b></div>
            <div><Radio size={14} /><span>DELIVERY</span><b>{railway?.details?.delivery || "UNKNOWN"}</b></div>
            <div><Radio size={14} /><span>LAST TARGET BLOCK</span><b>{targetMonitor?.details?.lastObservedBlock?.toLocaleString?.() || targetMonitor?.details?.lastObservedBlock || "--"}</b></div>
          </div>
          <div className="admin-agent-grid">
            {(state?.arms || []).map((arm) => (
              <div key={arm.id}><span>SCOUT-{String(arm.id).padStart(2, "0")} / {arm.agentName}</span><b className={statusTone(arm.state)}>{arm.state}</b><small>{arm.nodeName}</small></div>
            ))}
          </div>
        </section>

        <section className="admin-section" aria-labelledby="public-heading">
          <div className="admin-section-heading">
            <div><span>03 / PUBLIC CONFIG</span><h2 id="public-heading">EXTERNAL LINKS</h2></div>
            <ExternalLink size={18} />
          </div>
          <form className="admin-form" onSubmit={saveTwitter}>
            <label htmlFor="twitter-url">X / TWITTER URL</label>
            <input id="twitter-url" type="url" value={twitterUrl} onChange={(event) => setTwitterUrl(event.target.value)} placeholder="https://x.com/..." spellCheck="false" />
            <div className="admin-form-actions">
              <button type="button" onClick={clearTwitter} disabled={!twitterUrl || busy === "twitter-clear"}><Trash2 size={14} /> {busy === "twitter-clear" ? "CLEARING" : "CLEAR X LINK"}</button>
              <button type="submit" disabled={busy === "twitter"}><Save size={14} /> {busy === "twitter" ? "SAVING" : "SAVE X LINK"}</button>
            </div>
          </form>
          <div className="admin-public-state">
            <span>PUBLIC BUTTON</span>
            <b>{twitterUrl ? "CONNECTED" : "UNBOUND"}</b>
            {twitterUrl && <a href={twitterUrl} target="_blank" rel="noreferrer">{shortAddress(twitterUrl)} <ExternalLink size={12} /></a>}
          </div>
        </section>

        <section className="admin-section admin-proposal-section" aria-labelledby="proposal-heading">
          <div className="admin-section-heading">
            <div><span>04 / COMMUNITY MEMORY</span><h2 id="proposal-heading">REVIEW QUEUE</h2></div>
            <strong className={pendingProposals.length ? "warn" : "ok"}>{pendingProposals.length} PENDING</strong>
          </div>
          <div className="admin-proposal-list">
            {pendingProposals.length ? pendingProposals.map((proposal) => (
              <article key={proposal.id}>
                <span>PROPOSAL {String(proposal.id).padStart(3, "0")}</span><b>{proposal.title}</b><p>{proposal.question}</p>
                <small>{proposal.proposerAddress ? shortAddress(proposal.proposerAddress) : "ANONYMOUS"}</small>
                <div><button type="button" onClick={() => reviewProposal(proposal.id, "DECLINE")} disabled={busy === `proposal-${proposal.id}`}>DECLINE</button><button type="button" onClick={() => reviewProposal(proposal.id, "ACCEPT")} disabled={busy === `proposal-${proposal.id}`}>{busy === `proposal-${proposal.id}` ? "REVIEWING" : "ACCEPT"}</button></div>
              </article>
            )) : <p className="admin-empty">NO COMMUNITY MEMORY AWAITS REVIEW</p>}
          </div>
        </section>
      </section>

      <footer className="admin-footer">
        <span><ShieldCheck size={13} /> ADMIN SESSION / AUTHORIZED</span>
        <span>STATE {new Date(state?.serverTime || Date.now()).toLocaleTimeString("en-GB", { hour12: false })}</span>
        <span>COMB CONTROL / EVIDENCE BEFORE ACTION</span>
      </footer>
    </main>
  );
}
