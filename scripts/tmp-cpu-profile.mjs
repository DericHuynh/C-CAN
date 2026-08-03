// Temporary diagnostic: connect to the dev server's V8 inspector, capture a
// 5s CPU profile, and print the hottest self-time nodes.
const wsUrl = process.argv[2] ?? "ws://127.0.0.1:9229/97177578-732b-4788-a04b-f49a23b2db82";
const durationMs = Number(process.argv[3] ?? 5000);

const ws = new WebSocket(wsUrl);
let id = 0;
const pending = new Map();

function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const msgId = ++id;
    pending.set(msgId, { resolve, reject });
    ws.send(JSON.stringify({ id: msgId, method, params }));
  });
}

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    if (msg.error) reject(new Error(JSON.stringify(msg.error)));
    else resolve(msg.result);
  }
};

ws.onerror = (e) => {
  console.error("WS error", e.message ?? e);
  process.exit(1);
};

await new Promise((resolve, reject) => {
  ws.onopen = resolve;
  ws.onerror = reject;
});

await send("Profiler.enable");
await send("Profiler.start");
console.error(`Profiling for ${durationMs}ms...`);
await new Promise((r) => setTimeout(r, durationMs));
const { profile } = await send("Profiler.stop");

// Aggregate self time by function name.
const nodes = new Map();
for (const n of profile.nodes) {
  const key = `${n.callFrame.functionName || "(anonymous)"} @ ${n.callFrame.url}:${n.callFrame.lineNumber + 1}:${n.callFrame.columnNumber + 1}`;
  nodes.set(key, (nodes.get(key) ?? 0) + (n.hitCount ?? 0));
}
const total = [...nodes.values()].reduce((a, b) => a + b, 0) || 1;
const sorted = [...nodes.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30);
console.log(`\nTop self-time functions (total samples: ${total}, duration ${durationMs}ms):`);
for (const [key, hits] of sorted) {
  const pct = ((hits / total) * 100).toFixed(1);
  console.log(`${pct.padStart(6)}%  ${hits.toString().padStart(7)}  ${key}`);
}

// Also print a representative stack: take the deepest sample paths.
const samples = profile.samples ?? [];
const byStack = new Map();
for (const s of samples.slice(0, 20000)) {
  const path = [];
  let cur = s;
  const seen = new Set();
  while (cur != null && !seen.has(cur)) {
    seen.add(cur);
    const n = profile.nodes.find((x) => x.id === cur);
    if (!n) break;
    const f = n.callFrame;
    path.push(
      `${f.functionName || "(anonymous)"} (${(f.url ?? "").split("/").pop()}:${f.lineNumber + 1})`,
    );
    cur = n.parent;
  }
  const key = path.join(" <- ");
  byStack.set(key, (byStack.get(key) ?? 0) + 1);
}
const topStacks = [...byStack.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
console.log("\nTop sample stacks:");
for (const [stack, count] of topStacks) {
  console.log(`\n[${count} samples]\n  ${stack}`);
}

ws.close();
process.exit(0);
