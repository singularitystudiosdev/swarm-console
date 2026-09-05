/* ============================================================
   SWARM // COMMAND — infinite zoom agent constellation
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

const ROOTS = [
  { name: "HELIOS",   brief: "deep-index sweep · orion archive",       accent: "#57ffa8", seed: 1101 },
  { name: "VESPER",   brief: "anomaly triage · night feeds",           accent: "#57d7ff", seed: 2202 },
  { name: "KESTREL",  brief: "live ops relay · drone telemetry",       accent: "#b18cff", seed: 3303 },
];

/* ---------- node model ---------- */
let NEXT_ID = 1;
const MAX_DEPTH = 7;

function makeNode({ name, brief, accent, depth, parent, seed, isRoot }) {
  const rng = makeRng(seed);
  return {
    id: "n" + (NEXT_ID++),
    name, brief, accent,
    depth, parent,
    isRoot: !!isRoot,
    rngSeed: seed,
    status: "running",
    bornAt: performance.now(),
    tokens: Math.floor(2000 + rng() * 14000),
    children: null,          // generated lazily
    convo: null,             // generated lazily on first full render
    floatA: rng() * Math.PI * 2,
    floatB: rng() * Math.PI * 2,
    orbitPhase: rng() * Math.PI * 2,
    backAngle: 0,            // angle from parent -> this, set when attached
    stream: null,            // active stream state {el, full, i}
    nextExchange: 0,
  };
}

function childCountFor(node, rng) {
  if (node.depth >= MAX_DEPTH) return 0;
  if (node.depth === 0) {
    /* the three root hives always differ: a seed-rotated 2/3/4 */
    const offset = node.rngSeed % 3;
    return [2, 3, 4][(node.rootIndex + offset) % 3];
  }
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

/* total generated agent count */
function countTree(node) {
  let c = 1;
  if (node.children) for (const k of node.children) c += countTree(k);
  return c;
}

/* ---------- world state ---------- */
const worldEl = document.getElementById("world");
const starsCv = document.getElementById("stars");
const linksCv = document.getElementById("links");
const sctx = starsCv.getContext("2d");
const lctx = linksCv.getContext("2d");

let W = 0, H = 0, DPR = 1;

/* root projects */
const projects = ROOTS.map((r, i) => {
  const p = makeNode({
    name: r.name, brief: r.brief, accent: r.accent,
    depth: 0, parent: null, seed: r.seed, isRoot: true,
  });
  p.rootIndex = i;
  p.baseAngle = -Math.PI / 2 + (i * Math.PI * 2) / 3;
  return p;
});

let focus = null;          // null = root view
let entries = new Map();   // id -> entry
const pan = { x: 0, y: 0 }; // drag-to-pan camera offset
let fitScale = 1, fitTarget = 1; // constellation scale so every frame fits the viewport

function entryFor(id) { return entries.get(id); }

/* ---------- layout ---------- */
function frameW() { return Math.min(Math.max(W * 0.44, 400), 580); }

function layoutTargets() {
  const t = performance.now() / 1000;
  const R = Math.min(W, H);
  const targets = new Map();
  fitTarget = 1;

  if (!focus) {
    /* root view: the three projects in a wide triangle */
    const cx = W / 2, cy = H / 2;
    projects.forEach((p, i) => {
      const a = p.baseAngle + Math.sin(t * 0.05 + i) * 0.03;
      const r = R * 0.28;
      targets.set(p.id, {
        x: cx + Math.cos(a) * r,
        y: cy + Math.sin(a) * r,
        s: 0.44, o: 1, tier: "tier-mini", node: p, zoomable: true,
      });
      addDots(targets, p, 0.44);
    });
  } else {
    /* zoomed view: focus center-full, children mini ring, parent+siblings periph */
    const cx = W / 2, cy = H / 2;
    targets.set(focus.id, { x: cx, y: cy, s: 1, o: 1, tier: "tier-full", node: focus, zoomable: false });

    const kids = ensureChildren(focus);
    /* axis-aligned slots at full clearance, then fit-scale the whole
       formation so focus frame + all minis + dot rings fit the viewport */
    const frameEl = entries.get(focus.id)?.el?.querySelector(".frame");
    const hh = Math.min(frameEl ? frameEl.offsetHeight / 2 : 300, H * 0.45);
    const mx = frameW() / 2 + 240;
    const my = hh + 150;
    const slots = [
      { x: mx, y: 0, ax: "x" }, { x: -mx, y: 0, ax: "x" },
      { x: 0, y: -my, ax: "y" }, { x: 0, y: my, ax: "y" },
    ];
    kids.forEach((k, i) => {
      const s = slots[i % slots.length];
      const j = s.ax === "x"
        ? { dx: 0, dy: ((k.floatA % 1) - 0.5) * 220 }
        : { dx: ((k.floatA % 1) - 0.5) * 180, dy: 0 };
      targets.set(k.id, {
        x: cx + s.x + j.dx,
        y: cy + s.y + j.dy,
        s: 1, o: 1, tier: "tier-mini", node: k, zoomable: true,
        parentAnchorId: focus.id,
      });
      addDots(targets, k, 1);
    });

    /* fit scale: shrink the whole constellation until everything is on screen */
    let extX = frameW() / 2 + 30, extY = hh + 30;
    for (const tgt of targets.values()) {
      if (tgt.tier !== "tier-mini") continue;
      extX = Math.max(extX, Math.abs(tgt.x - cx) + 207);
      extY = Math.max(extY, Math.abs(tgt.y - cy) + 136);
    }
    fitTarget = Math.min(1, (W / 2 - 24) / extX, (H / 2 - 24) / extY);
  }
  return targets;
}

/* grandchild dots orbiting a mini-tier node: evenly spread around the card,
   clear of its edges, with a gentle sway instead of full rotation */
function addDots(targets, node, parentScale) {
  if (node.depth >= MAX_DEPTH) return;
  const kids = ensureChildren(node);
  kids.forEach((k, i) => {
    const n = kids.length;
    const a = baseAngle(k, i, n) + (k.orbitPhase % 0.3) - 0.15;
    targets.set(k.id, {
      dotOf: node.id, ang: a, r: 1,
      s: 0.1, o: 1, tier: "tier-dot", node: k, zoomable: true,
      parentAnchorId: node.id,
    });
  });
}
function baseAngle(k, i, n) { return -Math.PI / 2 + (i / n) * Math.PI * 2; }

/* ---------- entry lifecycle ---------- */
function makeEl(entry) {
  const el = document.createElement("div");
  el.className = "node";
  el.dataset.status = entry.node.status || "";
  {
    const accent = entry.node.accent || "#57ffa8";
    el.innerHTML = `
      <div class="dot-core" style="background:${accent};box-shadow:0 0 10px 2px ${hexA(accent, 0.55)}, 0 0 26px 6px ${hexA(accent, 0.18)}"></div>
      <div class="name-tag">${entry.node.name}</div>
      <div class="mini">
        <div class="mini-head">
          <span class="led led-run" data-led></span>
          <span class="m-title">${entry.node.name}</span>
        </div>
        <div class="m-sub">${entry.node.brief}</div>
        <div class="m-bars"><i></i><i></i><i></i></div>
        <div class="m-sub-count" data-subcount>⬡ — SUBAGENTS</div>
      </div>
      <div class="frame">
        <div class="frame-head">
          <span class="led led-run" data-led></span>
          <span class="f-title">${entry.node.name}</span>
          <span class="f-status" data-fstatus>RUNNING</span>
          <span class="f-chip">glm-5.3-flash</span>
        </div>
        <div class="frame-sub">${entry.node.brief}</div>
        <div class="thread" data-thread></div>
        <div class="frame-foot">
          <span data-tok>▲ 0 tok</span>
          <span data-eta>⏱ 00:00</span>
          <span class="spacer"></span>
          <span class="sub-count" data-subcount>⬡ — SUBAGENTS</span>
        </div>
        <div class="frame-input">
          <span class="prompt">▸</span>
          <input data-input placeholder="transmit to agent…" spellcheck="false">
          <button data-send>SEND</button>
        </div>
      </div>`;
    /* mini dot color override via accent: dot-core uses accent inline */
    buildThread(entry.node, el.querySelector("[data-thread]"));
    wireInput(entry.node, el);
    const kc = ensureChildren(entry.node).length;
    el.querySelectorAll("[data-subcount]").forEach((n) => {
      n.textContent = kc === 0 ? "⬡ 0 SUBAGENTS · STANDBY" : `⬡ ${kc} SUBAGENTS`;
    });
  }
  worldEl.appendChild(el);
  return el;
}

function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

function tierClass(entry) {
  return entry.tier; // set by layout
}
function applyTier(entry) {
  const el = entry.el;
  el.classList.remove("tier-dot", "tier-periph", "tier-mini", "tier-full");
  el.classList.add(entry.tier);
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
        tier: tgt.tier, zoomable: tgt.zoomable,
        parentAnchorId: tgt.parentAnchorId || null,
        dotOf: tgt.dotOf || null, ang: tgt.ang || 0, r: tgt.r || 0,
        ghost: !!tgt.ghost,
        hover: 0,
      };
      entries.set(id, e);
      if (e.dotOf) {
        /* seed dot position from its orbit so the transform is never NaN */
        const p = screenPosOf(id);
        if (p) { e.cur.x = p.x; e.cur.y = p.y; }
      }
      applyTier(e);
    } else {
      e.target = { x: tgt.x, y: tgt.y, s: tgt.s, o: tgt.o };
      e.tier = tgt.tier;
      e.zoomable = tgt.zoomable;
      e.parentAnchorId = tgt.parentAnchorId || null;
      e.dotOf = tgt.dotOf || null;
      e.ang = tgt.ang || 0;
      e.r = tgt.r || 0;
      e.ghost = !!tgt.ghost;
      if (e.dying) e.dying = false;
      applyTier(e);
    }
  }
}

function destroyEl(e) {
  e.el.remove();
  entries.delete(e.id);
}

function refocus(newFocus) {
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
    if (e.tier !== "tier-full") continue; /* only animate when visible in full */
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

/* periodic: focused nodes continue their conversation */
function tickConvo(now) {
  for (const e of entries.values()) {
    const n = e.node;
    if (n.isHub || !n.convo) continue;
    if (e.tier !== "tier-full") continue;
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

/* occasional status churn across the visible swarm */
function tickStatuses() {
  const vis = [...entries.values()].filter((e) => !e.node.isHub && e.tier !== "tier-full" && Math.random() < 0.4);
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
  input.addEventListener("keydown", (ev) => {
    ev.stopPropagation();
    if (ev.key === "Enter") submit();
  });
  input.addEventListener("click", (ev) => ev.stopPropagation());
}
/* alias used in makeEl */
const wireInputRef = wireInput;
function wireInputMaybe(node, el) { wireInputRef(node, el); }

/* ---------- background: nebula gradients only, no stray dots ---------- */
function tickStars(t, dt) {
  sctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  sctx.clearRect(0, 0, W, H);
  const g1 = sctx.createRadialGradient(W * 0.78, H * 0.2, 0, W * 0.78, H * 0.2, Math.max(W, H) * 0.5);
  g1.addColorStop(0, "rgba(87,255,168,0.045)");
  g1.addColorStop(1, "rgba(0,0,0,0)");
  sctx.fillStyle = g1;
  sctx.fillRect(0, 0, W, H);
  const g2 = sctx.createRadialGradient(W * 0.15, H * 0.85, 0, W * 0.15, H * 0.85, Math.max(W, H) * 0.45);
  g2.addColorStop(0, "rgba(87,215,255,0.04)");
  g2.addColorStop(1, "rgba(0,0,0,0)");
  sctx.fillStyle = g2;
  sctx.fillRect(0, 0, W, H);
}

/* ---------- links canvas ---------- */
function screenPosOf(id) {
  const e = entries.get(id);
  if (!e) return null;
  if (e.dotOf) {
    const p = entries.get(e.dotOf);
    if (!p) return null;
    /* ellipse that clears the ~280px card: rx 195, ry 124 */
    const a = e.ang + Math.sin(performance.now() / 1600 + e.ang * 2) * 0.09;
    const wob = Math.sin(performance.now() / 900 + e.ang * 3) * 4;
    return {
      x: p.cur.x + Math.cos(a) * (195 + wob),
      y: p.cur.y + Math.sin(a) * (124 + wob * 0.6),
    };
  }
  return { x: e.cur.x, y: e.cur.y };
}

function drawLinks(edges) {
  lctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  lctx.clearRect(0, 0, W, H);
  const line = (a, b, color) => {
    lctx.strokeStyle = color;
    lctx.lineWidth = 1;
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    const dx = b.x - a.x, dy = b.y - a.y;
    const nx = -dy, ny = dx;
    const len = Math.hypot(nx, ny) || 1;
    const bow = Math.min(30, len * 0.08);
    lctx.beginPath();
    lctx.moveTo(a.x, a.y);
    lctx.quadraticCurveTo(mx + (nx / len) * bow, my + (ny / len) * bow, b.x, b.y);
    lctx.stroke();
  };
  /* root mesh: bright triangle between the three projects */
  if (!focus) {
    const pts = projects.map((p) => screenPosOf(p.id)).filter(Boolean);
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) line(pts[i], pts[j], "rgba(87,255,168,0.22)");
    }
  } else {
    /* focus view: faint ring mesh between sibling minis */
    const sibs = [...entries.values()].filter((e) => e.tier === "tier-mini" && !e.dying).map((e) => screenPosOf(e.id)).filter(Boolean);
    for (let i = 0; i < sibs.length; i++) {
      line(sibs[i], sibs[(i + 1) % sibs.length], "rgba(87,255,168,0.08)");
    }
  }
  /* hierarchy edges */
  for (const e of edges) {
    const a = screenPosOf(e.a), b = screenPosOf(e.b);
    if (!a || !b) continue;
    line(a, b, e.kind === "dot" ? "rgba(87,255,168,0.30)" : "rgba(87,255,168,0.20)");
  }
}

/* collect visible hierarchy edges */
function collectEdges() {
  const edges = [];
  for (const e of entries.values()) {
    if (e.ghost || e.dying) continue;
    if (e.parentAnchorId && entries.has(e.parentAnchorId)) {
      edges.push({ a: e.parentAnchorId, b: e.id, kind: e.tier === "tier-dot" ? "dot" : "child" });
    }
  }
  return edges;
}

/* ---------- render loop ---------- */
let lastT = performance.now();
let statTimer = 0;

function frame(now) {
  const dt = Math.min(0.05, (now - lastT) / 1000);
  lastT = now;
  const t = now / 1000;

  /* float offsets */
  for (const e of entries.values()) {
    const n = e.node;
    const amp = e.tier === "tier-dot" ? 9 : 5;
    let tx, ty, ts = e.target.s, to = e.target.o;
    if (e.dotOf) {
      /* dots resolve around their parent's live position and snap to it,
         so fast pans never leave them lagging behind their card */
      const p = screenPosOf(e.id);
      if (p) { e.cur.x = p.x; e.cur.y = p.y; }
      tx = e.cur.x; ty = e.cur.y;
    } else {
      const fx = Math.sin(t * (0.5 + n.floatB * 0.2) + n.floatA) * amp;
      const fy = Math.cos(t * (0.4 + n.floatA * 0.2) + n.floatB) * amp;
      tx = e.target.x + pan.x + fx; ty = e.target.y + pan.y + fy;
    }
    if (e.hover) ts *= 1.05;
    if (e.ghost) to = 0;
    const k = e.dotOf ? 1 : 1 - Math.exp(-dt * 5);
    e.cur.x += (tx - e.cur.x) * k;
    e.cur.y += (ty - e.cur.y) * k;
    e.cur.s += (ts - e.cur.s) * k;
    e.cur.o += (to - e.cur.o) * k;
    e.el.style.transform = `translate3d(${e.cur.x}px, ${e.cur.y}px, 0)`;
    e.el.style.opacity = e.cur.o.toFixed(3);
    if (e.dying && e.cur.o < 0.02) { destroyEl(e); continue; }
    /* live footer for full tier */
    if (e.tier === "tier-full" && !e.node.isHub) {
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

  /* dots inherit parent position: handled in screenPosOf via dotOf */
  const edges = collectEdges();
  drawLinks(edges);
  tickStars(t, dt);

  tickStreams(dt);
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
    const rad = e.tier === "tier-dot" ? 26 : 150 * e.cur.s + 40;
    if (d < rad && d < bestD) { best = e; bestD = d; }
  }
  return best;
}

/* drag-to-pan: a press on the void drags the constellation;
   a press that releases without moving counts as a click */
let drag = null;

function hudHit(ev) {
  return ev.target.closest(".frame");
}

addEventListener("pointerdown", (ev) => {
  if (hudHit(ev)) return;
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
  if (!d || d.moved || hudHit(ev)) { document.body.style.cursor = "default"; return; }
  const hit = pickNodeAt(ev.clientX, ev.clientY);
  if (hit && hit.node !== focus) {
    refocus(hit.node);
  } else if (!hit) {
    /* void click: zoom out one layer */
    if (focus) refocus(focus.parent || null);
  }
});

document.addEventListener("wheel", (ev) => {
  /* let an inner thread consume the scroll when it still has room */
  const th = ev.target && ev.target.closest ? ev.target.closest(".thread") : null;
  if (th) {
    const canScroll = ev.deltaY > 0
      ? th.scrollTop + th.clientHeight < th.scrollHeight - 2
      : th.scrollTop > 2;
    if (canScroll) return;
  }
  if (ev.deltaY > 0) {
    if (focus) refocus(focus.parent || null);
  } else if (ev.deltaY < 0) {
    const hit = pickNodeAt(mouse.x, mouse.y);
    if (hit && hit.node !== focus) refocus(hit.node);
  }
}, { passive: true });

const mouse = { x: innerWidth / 2, y: innerHeight / 2 };
addEventListener("pointermove", (ev) => { mouse.x = ev.clientX; mouse.y = ev.clientY; });

addEventListener("keydown", (ev) => {
  if (ev.key === "Escape" && focus) refocus(focus.parent || null);
});

/* hover cursor */
addEventListener("pointermove", (ev) => {
  if (drag && drag.moved) return; /* grabbing cursor already set */
  if (ev.target.closest(".frame")) { document.body.style.cursor = "default"; return; }
  const hit = pickNodeAt(ev.clientX, ev.clientY);
  document.body.style.cursor = hit ? "pointer" : "grab";
  for (const e of entries.values()) e.hover = hit === e ? 1 : 0;
});

/* ---------- resize ---------- */
function resize() {
  DPR = Math.min(2, devicePixelRatio || 1);
  W = innerWidth; H = innerHeight;
  for (const cv of [starsCv, linksCv]) {
    cv.width = W * DPR; cv.height = H * DPR;
    cv.style.width = W + "px"; cv.style.height = H + "px";
  }
  layoutTargetsAndSync();
}
addEventListener("resize", resize);

/* ---------- boot ---------- */
function layoutTargetsAndSyncGuard() { layoutTargetsAndSync(); }

resize();
requestAnimationFrame(frame);
