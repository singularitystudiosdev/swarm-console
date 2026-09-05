/* ============================================================
   SWARM // COMMAND — adaptive agent constellation
   ============================================================ */
"use strict";

/* ---------- deterministic rng ---------- */
function makeRng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/* ---------- name / content pools ---------- */
const ROLES = ["scout", "indexer", "mapper", "coder", "reviewer", "relay", "ops", "sentinel", "forager", "analyst", "archivist", "weaver", "patcher", "tracer"];
const GLYPHS = ["α", "β", "γ", "δ", "ε", "ζ", "η", "θ", "ι", "κ"];

/* real Cosmos workspace projects (from list_workspace_projects) */
const CALLSIGNS = [
  "Swarm Console", "Chat Mesh", "Quick chats", "Superbot Button Page",
  "superbot-yes-man", "Wandful", "Site Ops", "V7 SPB VD",
  "SAAS INSPIRATION", "Click The Button Website", "Roblox Ads 3", "Roblox Ads 2",
  "Roblox Ads Operator", "superbot ascii 4", "Superbot ASCII 2", "Superbot ASCII 3",
  "Grok Bot 0.18 Reconstructed", "Contexty V2", "Houdini Intro", "gag2",
  "Tool-Repo", "gag.gg", "RobloxStudioTest", "COSMOSSS",
];

/* filler identities past the real projects, up to the slider cap of 30 */
const FALLBACK_CALLSIGNS = ["HELIOS", "VESPER", "KESTREL", "ORION", "LYRA", "NOVA"];

function agentName(i) {
  return i < CALLSIGNS.length ? CALLSIGNS[i] : FALLBACK_CALLSIGNS[(i - CALLSIGNS.length) % FALLBACK_CALLSIGNS.length];
}

const MAX_AGENTS = 30;

const ACCENTS = ["#57ffa8", "#57d7ff", "#b18cff", "#ffd257", "#ff8d5d", "#5dffd2", "#ff5da2", "#c8ff5d"];

const BRIEFS = [
  "deep-index sweep · orion archive",
  "anomaly triage · night feeds",
  "live ops relay · drone telemetry",
  "checkout audit · mixed content",
  "telemetry profiling · render loop",
  "docs sweep · stale API claims",
  "replay delta · capture path",
  "error sink watch · escalations",
  "session map · caller graph",
  "deploy notes · release console",
  "layout cache · dropped frames",
  "heartbeat spec · retry gate",
];

const USER_LINES = [
  "Map the session_timer module and report every caller.",
  "Triage the failed telemetry batch from 04:00 and find the root cause.",
  "Draft the deploy notes for the console release. Flag judgement calls.",
  "Find where the heartbeat diverges from the spec and patch it.",
  "Audit the checkout flow for dead links and mixed content.",
  "Profile the render loop, it dips under 60fps on long threads.",
  "Diff the capture path against replay and explain the delta.",
  "Sweep the docs for stale API claims and cite each one.",
  "Watch the error sink for the next hour, escalate anything new.",
  "Trace the dropped frames back to the layout cache.",
];

const SAY_LINES = [
  "On it. Pulling the module graph first, then I will walk every call site.",
  "Three candidates found. Ranking by blast radius before touching anything.",
  "Patched. Scoped suite is green; the full pass stays yours.",
  "The spec and the code diverge at the retry gate. Aligning code to spec.",
  "It is clock skew. The batch stamps lead the sink by 38 seconds. Pinning with a regression test.",
  "Drafted. Two calls need your eye, both marked in the notes.",
  "The dip is the layout cache invalidating per glyph. Batching the flush fixes it.",
  "Sweep done. Seven stale claims, each cited with the version that fixed it.",
  "Nothing new in the sink. Holding the watch and staying quiet.",
  "Replay differs only in header order. Capturing a fixture to prove it.",
];

const THINK_LINES = [
  "tracing callers of session_timer…",
  "ranking candidates by blast radius…",
  "comparing spec §4.2 against the retry gate…",
  "diffing capture vs replay paths…",
  "reading the error sink stream…",
  "walking the invalidation order…",
  "pricing the fixture formats…",
];

const TOOLS = [
  ["grep", '"session_timer"', "3 hits"],
  ["read", "src/agent/session.ts", "212 lines"],
  ["test", "scoped suite", "14 pass"],
  ["patch", "retry gate", "+6 −2"],
  ["probe", "telemetry batch 04:00", "skew +38s"],
  ["plan", "blast-radius order", "3 steps"],
  ["fetch", "changelog v2.4", "200 ok"],
  ["index", "module graph", "48 nodes"],
];

/* ---------- adaptive frame sizing (readability-first gradient) ----------
   Rule: at every agent count, a normal person must be able to READ the
   card at a glance — if not, compact it and drop information.
     1 agent  -> full chat: thread + input + footer
     2 agents -> compact chat: thread only, no input/footer
     3+       -> summary card: title + subagents + one "what it's doing" line
   Width still falls off continuously so the grid scales smoothly. */
let agentCount = 5;

function frameWFor(n) {
  return Math.min(Math.max(W * 0.8, 560), 1100);   // n === 1 focus card
}

/* context level is a function of the agent COUNT. Text never scales
   above native; extra room converts into MORE CONTEXT instead:
   1  full chat (input + footer)   2  chat thread
   3-12 compact mini-thread        13-30 summary card */
function featuresForCount(n) {
  return {
    input:    n <= 5,   // chat composer attached: talk to the agent directly
    thread:   n <= 12,            // message thread (mini + compact text from 3)
    brief:    n <= 26,            // project brief line
    chip:     n <= 1,
    status:   n <= 12,
    activity: n >= 13 && n <= 22, // one-line "what it's doing"
    compact:  n >= 3,             // smaller message text on mini threads
  };
}

/* ---------- node model ---------- */
let NEXT_ID = 1;
const MAX_DEPTH = 7;

function makeNode({ name, brief, accent, depth, parent, seed, isRoot, subCount }) {
  const rng = makeRng(seed);
  return {
    id: "n" + (NEXT_ID++),
    name, brief, accent,
    depth, parent,
    isRoot: !!isRoot,
    subCount: subCount || 0,
    rngSeed: seed,
    status: "running",
    bornAt: performance.now(),
    tokens: Math.floor(2000 + rng() * 14000),
    children: null,          // generated lazily
    convo: null,             // generated lazily on first render
    floatA: rng() * Math.PI * 2,
    floatB: rng() * Math.PI * 2,
    orbitPhase: rng() * Math.PI * 2,
    backAngle: 0,
    stream: null,            // active stream state {el, full, i}
    nextExchange: 0,
  };
}

function childCountFor(node, rng) {
  if (node.depth >= MAX_DEPTH) return 0;
  if (node.depth === 0) return node.subCount;
  return 1 + Math.floor(rng() * 4);                          // 1-4 below
}

function ensureChildren(node) {
  if (node.children) return node.children;
  const rng = makeRng(node.rngSeed * 7 + 13);
  const n = childCountFor(node, rng);
  node.children = [];
  for (let i = 0; i < n; i++) {
    const role = ROLES[Math.floor(rng() * ROLES.length)];
    const glyph = GLYPHS[Math.floor(rng() * GLYPHS.length)];
    const kid = makeNode({
      name: `${role}-${glyph}`,
      brief: `spawned by ${node.name.toLowerCase()} · task ${i + 1}`,
      accent: node.accent,
      depth: node.depth + 1,
      parent: node,
      seed: (node.rngSeed * 31 + i * 977 + 7) >>> 0,
    });
    kid.backAngle = -Math.PI / 2 + (i - (n - 1) / 2) * (Math.PI * 1.7 / Math.max(n, 3)) + (rng() - 0.5) * 0.16;
    kid.status = rng() < 0.72 ? "running" : (rng() < 0.5 ? "thinking" : "done");
    node.children.push(kid);
  }
  return node.children;
}

/* conversation generation (lazy, once per node) */
function ensureConvo(node) {
  if (node.convo) return node.convo;
  const rng = makeRng(node.rngSeed * 3 + 91);
  const pick = (arr) => arr[Math.floor(rng() * arr.length)];
  const convo = [];
  convo.push({ kind: "user", text: pick(USER_LINES) });
  convo.push({ kind: "think", text: pick(THINK_LINES) });
  const steps = 2 + Math.floor(rng() * 3);
  for (let i = 0; i < steps; i++) {
    const t = pick(TOOLS);
    convo.push({ kind: "tool", tool: t[0], arg: t[1], res: t[2] });
    if (i < steps - 1 && rng() < 0.6) convo.push({ kind: "say", text: pick(SAY_LINES) });
  }
  convo.push({ kind: "say", text: pick(SAY_LINES) });
  node.convo = convo;
  return convo;
}

/* ---------- world state ---------- */
const worldEl = document.getElementById("world");
const starsCv = document.getElementById("stars");
const sctx = starsCv.getContext("2d");

let W = 0, H = 0, DPR = 1;

/* root agents — rebuilt whenever the slider moves */
let projects = [];

function buildProjects() {
  projects = [];
  for (let i = 0; i < agentCount; i++) {
    const seed = (1101 + i * 777) >>> 0;
    const rng = makeRng(seed * 3 + 11);
    projects.push(makeNode({
      name: agentName(i),
      brief: BRIEFS[(i * 7 + 3) % BRIEFS.length],
      accent: ACCENTS[i % ACCENTS.length],
      depth: 0, parent: null, seed, isRoot: true,
      subCount: 1 + Math.floor(rng() * 8),   // 1-8 subagents per agent
    }));
  }
}

let focus = null;          // null = root view
let entries = new Map();   // id -> entry
const pan = { x: 0, y: 0 }; // drag-to-pan camera offset

/* ---------- layout ---------- */
function layoutTargets() {
  const targets = new Map();

  if (!focus) {
    const cx = W / 2, cy = H / 2;
    const g = 28;              // gutter between cards
    const tw = W * 0.86, th = H * 0.86;

    /* one solver for every count: pick the grid shape, size each card to
       its cell, and let the content fill it — thread cards flex, summary
       cards zoom their content to fill, title-only chips keep a comfy
       fixed width so the densest grid stays readable */
    const feat = featuresForCount(agentCount);
    const titleOnly = !feat.thread && !feat.brief && !feat.activity;
    let cols, rows, cw, ch;
    if (titleOnly) {
      /* chips start at the brief-card height and ease down to a slim row */
      cw = 340;
      cols = Math.max(1, Math.min(agentCount, Math.floor((tw + g) / (cw + g))));
      rows = Math.ceil(agentCount / cols);
      ch = Math.round(88 - (88 - 36) * Math.max(0, Math.min(1, (agentCount - 26) / 4)));
    } else {
      const A = feat.thread || agentCount > 26 ? 1.5 : 3.2;
      cols = Math.max(1, Math.min(agentCount,
        Math.round(Math.sqrt(agentCount * tw / (th * A)))));
      rows = Math.ceil(agentCount / cols);
      cw = Math.round((tw - (cols - 1) * g) / cols);
      ch = Math.round((th - (rows - 1) * g) / rows);
    }

    projects.forEach((p, i) => {
      const row = Math.floor(i / cols), col = i % cols;
      const inRow = Math.min(cols, agentCount - row * cols);
      const rowOffsetX = ((cols - inRow) * (cw + g)) / 2;
      targets.set(p.id, {
        x: cx - ((cols - 1) * (cw + g)) / 2 + rowOffsetX + col * (cw + g),
        y: cy - ((rows - 1) * (ch + g)) / 2 + row * (ch + g),
        s: 1, o: 1, w: cw, h: ch, feat, node: p, zoomable: true,
      });
    });
  } else {
    /* zoomed view: focus center-full, subagent columns flanking —
       all solved to fit the viewport together */
    const cx = W / 2, cy = H / 2;
    const columns = [[], []]; // [right, left]
    ensureChildren(focus).forEach((k, i) => columns[i % 2].push(k));
    const maxCol = Math.max(columns[0].length, columns[1].length, 1);

    const kw = 300, kh = 120;            // kid card design size
    const minGap = 16;
    const availH = H * 0.92;
    const neededH = maxCol * kh + (maxCol - 1) * minGap;
    /* narrow the focus card so both side columns fit at native size */
    const fw = Math.max(560, Math.min(frameWFor(1), W - 2 * (kw + 96)));
    const sideW = (W - fw) / 2 - 40;
    const s = Math.max(0.5, Math.min(1, availH / neededH, sideW / kw));
    const gap = kh * s + Math.max(minGap, Math.min(72,
      (availH - maxCol * kh * s) / Math.max(maxCol - 1, 1)));
    const mx = fw / 2 + (kw * s) / 2 + 40;

    targets.set(focus.id, { x: cx, y: cy, s: 1, o: 1, w: Math.round(fw), h: Math.round(fw * 0.62), feat: featuresForCount(1), node: focus, zoomable: false });

    columns.forEach((col, side) => {
      const m = col.length;
      col.forEach((k, row) => {
        targets.set(k.id, {
          x: cx + (side === 0 ? mx : -mx),
          y: cy + (row - (m - 1) / 2) * gap,
          s, o: 1, w: kw, h: kh, feat: featuresForCount(13), node: k, zoomable: true,
          parentAnchorId: focus.id,
        });
      });
    });
  }
  return targets;
}

/* ---------- entry lifecycle ---------- */
function makeEl(entry) {
  const el = document.createElement("div");
  el.className = "node";
  el.dataset.status = entry.node.status || "";
  {
    el.innerHTML = `
      <div class="frame">
        <div class="frame-head">
          <span class="led led-run" data-led></span>
          <span class="f-title">${entry.node.name}</span>
          <span class="f-status" data-fstatus>RUNNING</span>
          <span class="f-sub" data-subcount>⬡ — SUBAGENTS</span>
          <span class="f-chip">glm-5.3-flash</span>
        </div>
        <div class="frame-sub">${entry.node.brief}</div>
        <div class="f-activity" data-activity>booting…</div>
        <div class="thread" data-thread></div>
        <div class="frame-foot">
          <span data-tok>▲ 0 tok</span>
          <span data-eta>⏱ 00:00</span>
        </div>
        <div class="composer">
          <div class="cp-row">
            <div class="cp-box">
              <input data-input placeholder="transmit to agent…" spellcheck="false">
              <div class="cp-line">
                <button class="cp-chip" title="Attach" aria-label="Attach">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
                </button>
                <button class="cp-chip" title="Voice input" aria-label="Voice input">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>
                </button>
                <span class="cp-chip">Agent
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                </span>
                <span class="cp-divider"></span>
                <span class="cp-chip cp-model">GLM 5.3 Flash Uncensored FP8 High</span>
                <div class="cp-approval" data-approval aria-label="Approval mode">
                  <button class="on-ask" data-mode="ask">Ask</button>
                  <button data-mode="yolo">Yolo</button>
                </div>
              </div>
            </div>
            <button class="cp-send" data-send title="Send" aria-label="Send message">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 7-7 7 7"/><path d="M12 19V5"/></svg>
            </button>
          </div>
        </div>
      </div>`;
    buildThread(entry.node, el.querySelector("[data-thread]"));
    wireInput(entry.node, el);
    const kc = ensureChildren(entry.node).length;
    el.querySelectorAll("[data-subcount]").forEach((n) => {
      /* the label span hides on summary cards, where the head is zoomed */
      n.innerHTML = kc === 0
        ? `⬡ 0 <span class="f-sub-l">SUBAGENTS · STANDBY</span>`
        : `⬡ ${kc} <span class="f-sub-l">SUBAGENTS</span>`;
    });
  }
  worldEl.appendChild(el);
  return el;
}

function applyFeatures(entry) {
  const el = entry.el;
  const frame = el.querySelector(".frame");
  const f = entry.feat;
  frame.style.width = Math.round(entry.w) + "px";
  frame.style.height = entry.h ? Math.round(entry.h) + "px" : "";
  frame.style.maxHeight = "";
  /* summary cards zoom their content to fill the cell (title grows too),
     capped so the densest grids keep native-size text */
  if (f.activity || (f.brief && !f.thread)) {
    const contentH = 30 + (f.brief ? 28 : 0) + (f.activity ? 30 : 0);
    const cz = Math.max(1, Math.min(2.2, entry.w / 260, entry.h / contentH));
    frame.style.setProperty("--cz", cz.toFixed(3));
  } else {
    frame.style.setProperty("--cz", "1");
  }
  frame.classList.toggle("fx-input", f.input);
  frame.classList.toggle("fx-thread", f.thread);
  frame.classList.toggle("fx-brief", f.brief);
  frame.classList.toggle("fx-chip", f.chip);
  frame.classList.toggle("fx-activity", f.activity);
  frame.classList.toggle("fx-status", f.status);
  frame.classList.toggle("fx-compact", f.compact);
  el.classList.toggle("focused", entry.node === focus);
  el.classList.toggle("zoomable", !!entry.zoomable);
}

function syncEntries(targets) {
  /* retire entries no longer targeted */
  for (const [id, e] of entries) {
    if (!targets.has(id)) {
      e.dying = true;
      e.target.o = 0;
    }
  }
  for (const [id, tgt] of targets) {
    let e = entries.get(id);
    if (e && e.dying) { destroyEl(e); e = null; }
    if (!e) {
      const el = makeEl({ node: tgt.node });
      e = {
        id, node: tgt.node, el,
        cur: { x: tgt.x, y: tgt.y, s: tgt.s * 0.7, o: 0 },
        target: { x: tgt.x, y: tgt.y, s: tgt.s, o: tgt.o },
        w: tgt.w, h: tgt.h, feat: tgt.feat,
        zoomable: tgt.zoomable,
        parentAnchorId: tgt.parentAnchorId || null,
        ghost: !!tgt.ghost,
        hover: 0,
      };
      entries.set(id, e);
      applyFeatures(e);
    } else {
      e.target = { x: tgt.x, y: tgt.y, s: tgt.s, o: tgt.o };
      e.w = tgt.w;
      e.h = tgt.h;
      e.feat = tgt.feat;
      e.zoomable = tgt.zoomable;
      e.parentAnchorId = tgt.parentAnchorId || null;
      e.ghost = !!tgt.ghost;
      if (e.dying) e.dying = false;
      applyFeatures(e);
    }
  }
}

function destroyEl(e) {
  e.el.remove();
  entries.delete(e.id);
}

function refocus(newFocus) {
  /* with a lone agent there is no root view to return to — stay zoomed in */
  if (!newFocus && agentCount === 1) newFocus = projects[0];
  focus = newFocus;
  if (focus) ensureChildren(focus);
  layoutTargetsAndSync();
}

function layoutTargetsAndSync() {
  syncEntries(layoutTargets());
}

/* ---------- thread rendering ---------- */
function msgEl(m) {
  const d = document.createElement("div");
  if (m.kind === "user") { d.className = "msg msg-user"; d.textContent = m.text; }
  else if (m.kind === "say") { d.className = "msg msg-say"; d.innerHTML = `<span data-txt></span>`; d.querySelector("[data-txt]").textContent = m.text; }
  else if (m.kind === "think") {
    d.className = "msg msg-think";
    d.innerHTML = `<div class="t-label"><span class="t-orb"></span>THINKING</div><span data-txt></span>`;
    d.querySelector("[data-txt]").textContent = m.text;
  }
  else if (m.kind === "tool") {
    d.className = "msg msg-tool";
    d.innerHTML = `<span>▸</span><span class="t-name">${m.tool}</span><span>${m.arg}</span><span class="t-res">${m.res}</span>`;
  }
  else if (m.kind === "sys") { d.className = "msg msg-sys"; d.textContent = m.text; }
  return d;
}

function buildThread(node, threadEl) {
  const convo = ensureConvo(node);
  threadEl.innerHTML = "";
  for (const m of convo) threadEl.appendChild(msgEl(m));
  /* start a live stream on the final say */
  startStream(node, threadEl);
  threadEl.scrollTop = threadEl.scrollHeight;
}

function startStream(node, threadEl) {
  const last = node.convo[node.convo.length - 1];
  if (!last || last.kind !== "say") return;
  const el = threadEl.lastElementChild.querySelector("[data-txt]");
  if (!el) return;
  node.stream = { el, full: last.text, i: 0, threadEl, done: false };
  setStatus(node, "running");
}

function tickStreams(dt) {
  for (const e of entries.values()) {
    const st = e.node.stream;
    if (!st || st.done) continue;
    if (!e.feat.thread) continue; /* only animate where the thread shows */
    st.i = Math.min(st.full.length, st.i + dt * 34);
    const n = Math.floor(st.i);
    st.el.textContent = st.full.slice(0, n);
    if (n >= st.full.length) {
      st.done = true;
      st.el.parentElement.querySelector(".cursor")?.remove();
      e.node.stream = null;
      e.node.nextExchange = performance.now() + 5200 + Math.random() * 5000;
      e.node.tokens += Math.floor(Math.random() * 900);
    } else {
      /* blinking cursor while streaming */
      let c = st.el.parentElement.querySelector(".cursor");
      if (!c) { c = document.createElement("span"); c.className = "cursor"; st.el.parentElement.appendChild(c); }
    }
    st.threadEl.scrollTop = st.threadEl.scrollHeight;
  }
}

/* periodic: every visible node keeps living — cards without a thread
   still show the exchange through their activity line */
function tickConvo(now) {
  for (const e of entries.values()) {
    const n = e.node;
    if (!n.convo) continue;
    if (n.stream || now < (n.nextExchange || 0)) continue;
    const rng = Math.random;
    const thread = e.el.querySelector("[data-thread]");
    const pick = (arr) => arr[Math.floor(rng() * arr.length)];
    n.convo.push({ kind: "user", text: pick(USER_LINES) });
    thread.appendChild(msgEl(n.convo[n.convo.length - 1]));
    const th = { kind: "think", text: pick(THINK_LINES) };
    n.convo.push(th);
    const thEl = msgEl(th);
    thread.appendChild(thEl);
    setStatus(n, "thinking");
    thread.scrollTop = thread.scrollHeight;
    /* after a delay, resolve thinking into a tool + streaming say */
    const say = { kind: "say", text: pick(SAY_LINES) };
    const tool = TOOLS[Math.floor(rng() * TOOLS.length)];
    setTimeout(() => {
      if (!n.convo) return;
      thEl.remove();
      n.convo = n.convo.filter((m) => m !== th);
      const t = { kind: "tool", tool: tool[0], arg: tool[1], res: tool[2] };
      n.convo.push(t);
      thread.appendChild(msgEl(t));
      n.convo.push(say);
      const sEl = msgEl(say);
      thread.appendChild(sEl);
      startStream(n, thread);
      thread.scrollTop = thread.scrollHeight;
    }, 1400 + rng() * 1600);
    n.nextExchange = now + 9999999; /* rearmed when stream completes */
  }
}

function setStatus(node, status) {
  node.status = status;
  const ledClass = "led " + ({ running: "led-run", thinking: "led-think", done: "led-done", blocked: "led-block" }[status] || "led-run");
  for (const e of entries.values()) {
    if (e.node === node) {
      e.el.dataset.status = status;
      e.el.querySelectorAll("[data-led]").forEach((led) => { led.className = ledClass; });
      const fs = e.el.querySelector("[data-fstatus]");
      if (fs) { fs.textContent = status.toUpperCase(); fs.className = "f-status " + status; }
    }
  }
}

/* occasional status churn across the compact swarm (quiet nodes only —
   never contradicts a live exchange) */
function tickStatuses() {
  const now = performance.now();
  const vis = [...entries.values()].filter((e) => !e.feat.thread
    && !e.node.stream && (e.node.nextExchange || 0) < now + 8e6
    && Math.random() < 0.4);
  if (!vis.length) return;
  const e = vis[Math.floor(Math.random() * vis.length)];
  const roll = Math.random();
  const next = roll < 0.7 ? "running" : roll < 0.9 ? "thinking" : "blocked";
  setStatus(e.node, next);
}

/* ---------- input wiring ---------- */
function wireInput(node, el) {
  const input = el.querySelector("[data-input]");
  const send = el.querySelector("[data-send]");
  const thread = el.querySelector("[data-thread]");
  const submit = () => {
    const v = input.value.trim();
    if (!v) return;
    input.value = "";
    const m = { kind: "user", text: v };
    node.convo.push(m);
    thread.appendChild(msgEl(m));
    const th = { kind: "think", text: THINK_LINES[Math.floor(Math.random() * THINK_LINES.length)] };
    node.convo.push(th);
    const thEl = msgEl(th);
    thread.appendChild(thEl);
    setStatus(node, "thinking");
    thread.scrollTop = thread.scrollHeight;
    const say = { kind: "say", text: SAY_LINES[Math.floor(Math.random() * SAY_LINES.length)] };
    const tl = TOOLS[Math.floor(Math.random() * TOOLS.length)];
    setTimeout(() => {
      if (!entries.has(node.id) && node !== focus) return;
      thEl.remove();
      node.convo = node.convo.filter((x) => x !== th);
      const t = { kind: "tool", tool: tl[0], arg: tl[1], res: tl[2] };
      node.convo.push(t);
      thread.appendChild(msgEl(t));
      node.convo.push(say);
      thread.appendChild(msgEl(say));
      startStream(node, thread);
      thread.scrollTop = thread.scrollHeight;
    }, 1200 + Math.random() * 1500);
  };
  send.addEventListener("click", (ev) => { ev.stopPropagation(); submit(); });
  /* Ask / Yolo approval toggle — cosmetic parity with the Cosmos composer */
  const approval = el.querySelector("[data-approval]");
  if (approval) {
    approval.addEventListener("click", (ev) => {
      ev.stopPropagation();
      const b = ev.target.closest("button");
      if (!b) return;
      approval.querySelectorAll("button").forEach((x) => x.classList.remove("on-ask", "on-yolo"));
      b.classList.add(b.dataset.mode === "yolo" ? "on-yolo" : "on-ask");
    });
  }
  input.addEventListener("keydown", (ev) => {
    ev.stopPropagation();
    if (ev.key === "Enter") submit();
  });
  input.addEventListener("click", (ev) => ev.stopPropagation());
}

/* ---------- background: nebula gradients only, no stray dots ---------- */
function tickStars(t, dt) {
  sctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  sctx.clearRect(0, 0, W, H);
  const g1 = sctx.createRadialGradient(W * 0.78, H * 0.2, 0, W * 0.78, H * 0.2, Math.max(W, H) * 0.5);
  g1.addColorStop(0, hexToRgba(TOKEN_ACCENT, 0.045));
  g1.addColorStop(1, "rgba(0,0,0,0)");
  sctx.fillStyle = g1;
  sctx.fillRect(0, 0, W, H);
  const g2 = sctx.createRadialGradient(W * 0.15, H * 0.85, 0, W * 0.15, H * 0.85, Math.max(W, H) * 0.45);
  g2.addColorStop(0, hexToRgba(TOKEN_VERIFY, 0.035));
  g2.addColorStop(1, "rgba(0,0,0,0)");
  sctx.fillStyle = g2;
  sctx.fillRect(0, 0, W, H);
}

/* ---------- screen position (used by picking) ---------- */
function screenPosOf(id) {
  const e = entries.get(id);
  return e ? { x: e.cur.x, y: e.cur.y } : null;
}

/* ---------- live activity line ---------- */
/* always returns text for what the agent is doing — a bare dot never shows */
function activityFor(node, threadShown) {
  if (node.status === "blocked") return "⊘ blocked · awaiting input";
  if (node.status === "done") return "✓ complete · standing by";
  if (node.stream && !node.stream.done) {
    if (!threadShown) return "▸ " + node.stream.full; /* no thread to animate in: show the whole line */
    const n = Math.floor(node.stream.i);
    return "▸ " + (n > 0 ? node.stream.full.slice(0, n) : "composing reply…");
  }
  const c = node.convo;
  for (let i = (c ? c.length : 0) - 1; i >= 0; i--) {
    const m = c[i];
    if (m.kind === "think") return "◌ " + m.text;
    if (m.kind === "tool") return `▸ ${m.tool} ${m.arg} · ${m.res}`;
    if (m.kind === "say") return m.text;
    if (m.kind === "user") return "received new directive";
  }
  return "booting…";
}

function tickActivity() {
  for (const e of entries.values()) {
    const els = e.el.querySelectorAll("[data-activity]");
    if (!els.length) continue;
    let txt = activityFor(e.node, e.feat.thread);
    /* very compact cards: cut to a readable clause instead of letting
       the ellipsis truncate a long sentence mid-word (effective width
       = base width x card scale) */
    if (e.w * e.target.s < 310 && txt.length > 42) {
      txt = txt.slice(0, 42).replace(/\s+\S*$/, "") + "…";
    }
    for (const el of els) {
      if (el.textContent !== txt) el.textContent = txt;
    }
  }
}

/* ---------- link lines: subagent cards -> parent frame ---------- */
const SVG_NS = "http://www.w3.org/2000/svg";
const linksSvg = document.createElementNS(SVG_NS, "svg");
linksSvg.id = "links";
worldEl.insertBefore(linksSvg, worldEl.firstChild);
const linkPool = new Map(); // childId -> <line>

function hexToRgba(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

/* read a :root token value (keeps JS-drawn chrome on the CSS palette) */
function tokenColor(name, fallback) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}
const TOKEN_ACCENT = tokenColor("--accent", "#7aa2ff");
const TOKEN_VERIFY = tokenColor("--verify", "#c08cff");

/* span [t0,t1] of segment p1->p2 inside rect, or null */
function segRectSpan(x1, y1, x2, y2, rc) {
  const dx = x2 - x1, dy = y2 - y1;
  let t0 = 0, t1 = 1;
  const clips = [
    [-dx, x1 - rc.x], [dx, rc.x + rc.w - x1],
    [-dy, y1 - rc.y], [dy, rc.y + rc.h - y1],
  ];
  for (const [p, q] of clips) {
    if (p === 0) { if (q < 0) return null; continue; }
    const r = q / p;
    if (p < 0) { if (r > t1) return null; if (r > t0) t0 = r; }
    else       { if (r < t0) return null; if (r < t1) t1 = r; }
  }
  return [t0, t1];
}

function rectAround(entry, sel) {
  const el = entry.el.querySelector(sel);
  if (!el) return null;
  return { x: entry.cur.x - el.offsetWidth / 2, y: entry.cur.y - el.offsetHeight / 2, w: el.offsetWidth, h: el.offsetHeight };
}

function tickLinks() {
  const want = new Set();
  for (const e of entries.values()) {
    if (e.dying || e.node === focus) continue;
    const pid = e.parentAnchorId || (e.node.parent ? e.node.parent.id : null);
    const p = pid ? entries.get(pid) : null;
    if (!p || p.dying) continue;
    want.add(e.id);
    let line = linkPool.get(e.id);
    if (!line) {
      line = document.createElementNS(SVG_NS, "line");
      line.setAttribute("stroke-width", "1");
      linksSvg.appendChild(line);
      linkPool.set(e.id, line);
    }
    const x1 = e.cur.x, y1 = e.cur.y, x2 = p.cur.x, y2 = p.cur.y;
    const dx = x2 - x1, dy = y2 - y1;
    let t0 = 0, t1 = 1;
    const cr = rectAround(e, ".frame"), pr = rectAround(p, ".frame");
    const sc = cr && segRectSpan(x1, y1, x2, y2, cr);
    const sp = pr && segRectSpan(x1, y1, x2, y2, pr);
    if (sc) t0 = Math.max(t0, sc[1]);
    if (sp) t1 = Math.min(t1, sp[0]);
    if (t0 >= t1) { line.setAttribute("opacity", "0"); continue; }
    line.setAttribute("x1", (x1 + dx * t0).toFixed(1));
    line.setAttribute("y1", (y1 + dy * t0).toFixed(1));
    line.setAttribute("x2", (x1 + dx * t1).toFixed(1));
    line.setAttribute("y2", (y1 + dy * t1).toFixed(1));
    line.style.stroke = `color-mix(in srgb, ${e.node.accent} 35%, transparent)`;
    line.setAttribute("opacity", (0.4 + 0.6 * e.cur.o).toFixed(3));
  }
  for (const [id, line] of linkPool) {
    if (!want.has(id)) { line.remove(); linkPool.delete(id); }
  }
}

/* ---------- render loop ---------- */
let lastT = performance.now();
let statTimer = 0;
const actTick = { last: 0 };

function frame(now) {
  const dt = Math.min(0.05, (now - lastT) / 1000);
  lastT = now;
  const t = now / 1000;

  /* card positions: static — no idle drift, no hover scaling
     (a hover lift would overlap the cell-packed neighbors) */
  for (const e of entries.values()) {
    let ts = e.target.s, to = e.target.o;
    const tx = e.target.x + pan.x, ty = e.target.y + pan.y;
    if (e.ghost) to = 0;
    const k = 1 - Math.exp(-dt * 5);
    e.cur.x += (tx - e.cur.x) * k;
    e.cur.y += (ty - e.cur.y) * k;
    e.cur.s += (ts - e.cur.s) * k;
    e.cur.o += (to - e.cur.o) * k;
    e.el.style.transform = `translate3d(${e.cur.x}px, ${e.cur.y}px, 0) scale(${e.cur.s.toFixed(4)})`;
    e.el.style.opacity = e.cur.o.toFixed(3);
    if (e.dying && e.cur.o < 0.02) { destroyEl(e); continue; }
    /* live footer for frames showing input+footer */
    if (e.feat.input) {
      const eta = e.el.querySelector("[data-eta]");
      if (eta && now - (e.etaTick || 0) > 1000) {
        e.etaTick = now;
        const el = Math.floor((now - e.node.bornAt) / 1000);
        const mm = String(Math.floor(el / 60)).padStart(2, "0");
        const ss = String(el % 60).padStart(2, "0");
        eta.textContent = `⏱ ${mm}:${ss}`;
        const tok = e.el.querySelector("[data-tok]");
        if (tok) tok.textContent = `▲ ${(e.node.tokens / 1000).toFixed(1)}k tok`;
      }
    }
  }

  tickStars(t, dt);
  tickLinks();

  tickStreams(dt);
  if (now - (actTick.last || 0) > 400) { actTick.last = now; tickActivity(); }
  if (now - (tickConvo.last || 0) > 500) { tickConvo.last = now; tickConvo(now); }
  statTimer += dt;
  if (statTimer > 1.6) { statTimer = 0; tickStatuses(); }

  requestAnimationFrame(frame);
}

/* ---------- input: click / wheel / keys ---------- */
function pickNodeAt(x, y) {
  let best = null, bestD = 1e9;
  for (const e of entries.values()) {
    if (!e.zoomable || e.dying || e.ghost) continue;
    const p = screenPosOf(e.id);
    if (!p) continue;
    const d = Math.hypot(p.x - x, p.y - y);
    const rad = 170 * e.cur.s + 50;
    if (d < rad && d < bestD) { best = e; bestD = d; }
  }
  return best;
}

/* drag-to-pan: a press on the void (or an unfocused frame) drags the
   constellation; a press that releases without moving counts as a click */
let drag = null;

function hudHit(ev) {
  return ev.target.closest(".frame, #hud");
}

function frameEntryFromEvent(ev) {
  const fr = ev.target.closest(".frame");
  if (!fr) return null;
  for (const e of entries.values()) {
    if (e.el.contains(fr)) return e;
  }
  return null;
}

addEventListener("pointerdown", (ev) => {
  /* the chat composer never pans, never zooms — it is just for typing */
  if (ev.target.closest("#hud, .composer")) return;
  const fe = frameEntryFromEvent(ev);
  if (fe && fe.node === focus) return; /* focused frame is interactive */
  drag = { x: ev.clientX, y: ev.clientY, px: pan.x, py: pan.y, moved: false };
});

addEventListener("pointermove", (ev) => {
  if (drag) {
    const dx = ev.clientX - drag.x, dy = ev.clientY - drag.y;
    if (!drag.moved && Math.abs(dx) + Math.abs(dy) > 6) {
      drag.moved = true;
      document.body.style.cursor = "grabbing";
    }
    if (drag.moved) { pan.x = drag.px + dx; pan.y = drag.py + dy; }
  }
});

addEventListener("pointerup", (ev) => {
  const d = drag;
  drag = null;
  document.body.style.cursor = "default";
  if (!d || d.moved) return;
  /* a click on any zoomable agent focuses it, even through its frame */
  const hit = pickNodeAt(ev.clientX, ev.clientY);
  if (hit && hit.node !== focus) { refocus(hit.node); return; }
  if (hudHit(ev)) return; /* inside the focused frame or the HUD */
  /* void click: zoom out one layer */
  if (focus) refocus(focus.parent || null);
});

document.addEventListener("wheel", (ev) => {
  if (ev.target.closest && ev.target.closest("#hud")) return;
  /* let an inner thread consume the scroll when it still has room */
  const th = ev.target && ev.target.closest ? ev.target.closest(".thread") : null;
  if (th) {
    const canScroll = ev.deltaY > 0
      ? th.scrollTop + th.clientHeight < th.scrollHeight - 2
      : th.scrollTop > 2;
    if (canScroll) return;
  }
  /* scroll only zooms OUT; zooming IN is click-only */
  if (ev.deltaY > 0 && focus) refocus(focus.parent || null);
}, { passive: true });

const mouse = { x: innerWidth / 2, y: innerHeight / 2 };
addEventListener("pointermove", (ev) => { mouse.x = ev.clientX; mouse.y = ev.clientY; });

addEventListener("keydown", (ev) => {
  if (ev.key === "Escape" && focus) refocus(focus.parent || null);
});

/* hover cursor */
addEventListener("pointermove", (ev) => {
  if (drag && drag.moved) return; /* grabbing cursor already set */
  const hit = pickNodeAt(ev.clientX, ev.clientY);
  document.body.style.cursor = hit ? "pointer" : (ev.target.closest(".frame") ? "default" : "grab");
  for (const e of entries.values()) e.hover = hit === e ? 1 : 0;
});

/* ---------- agent-count slider ---------- */
const slider = document.getElementById("agent-slider");
const agentCountEl = document.getElementById("agent-count");

function setAgentCount(n) {
  agentCount = Math.max(1, Math.min(MAX_AGENTS, n));
  slider.value = String(agentCount);
  agentCountEl.textContent = String(agentCount);
  buildProjects();
  /* a lone agent starts zoomed in — the root view IS its focus view */
  if (agentCount === 1) { refocus(projects[0]); return; }
  const prev = focus;
  if (prev) {
    const again = projects.find((p) => p.name === prev.name);
    refocus(again || null);
  } else {
    layoutTargetsAndSync();
  }
}

slider.addEventListener("input", () => setAgentCount(+slider.value));
slider.addEventListener("pointerdown", (ev) => ev.stopPropagation());
slider.addEventListener("pointerup", (ev) => ev.stopPropagation());

/* ---------- resize ---------- */
function resize() {
  DPR = Math.min(2, devicePixelRatio || 1);
  W = innerWidth; H = innerHeight;
  starsCv.width = W * DPR; starsCv.height = H * DPR;
  starsCv.style.width = W + "px"; starsCv.style.height = H + "px";
  layoutTargetsAndSync();
}
addEventListener("resize", resize);

/* ---------- boot ---------- */
resize();

/* deep links: ?agents=N sets the count, ?focus=NAME opens zoomed into that agent */
const params = new URLSearchParams(location.search);
const bootAgents = parseInt(params.get("agents"), 10);
buildProjects();
if (!isNaN(bootAgents)) setAgentCount(bootAgents);
else layoutTargetsAndSync(); /* plain load: resize() synced before projects existed */

const bootFocus = params.get("focus");
const bootProject = bootFocus && projects.find((p) => p.name.toLowerCase() === bootFocus.toLowerCase());
if (bootProject) refocus(bootProject);

/* legibility audit (?sweep=1): measures every agent level — effective
   on-screen text size (font x grid-fit scale) and how much of the
   activity line survives truncation — and prints a table into the DOM */
if (params.get("sweep")) {
  const rows = [];
  for (let n = 1; n <= MAX_AGENTS; n++) {
    setAgentCount(n);
    tickActivity(); /* fill real activity text before measuring */
    let title = Infinity, act = Infinity, vis = Infinity;
    for (const e of entries.values()) {
      if (e.dying) continue;
      title = Math.min(title, 12.5 * e.target.s);
      if (e.feat.activity) {
        const el = e.el.querySelector(".f-activity");
        vis = Math.min(vis, Math.min(1, (el.clientWidth * e.target.s) / Math.max(1, el.scrollWidth)));
        act = Math.min(act, 11 * e.target.s);
      }
    }
    if (!isFinite(title)) title = 0;
    if (!isFinite(act)) act = 0;
    if (!isFinite(vis)) vis = 1;
    rows.push(`${n}\t${title.toFixed(1)}\t${act.toFixed(1)}\t${Math.round(vis * 100)}%`);
  }
  const pre = document.createElement("pre");
  pre.id = "sweep-report";
  pre.textContent = "n\ttitle_px\tactivity_px\tline_visible\n" + rows.join("\n");
  document.body.appendChild(pre);
}

requestAnimationFrame(frame);
