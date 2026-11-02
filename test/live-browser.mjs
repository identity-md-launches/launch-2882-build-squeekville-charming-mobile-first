// Live check of the production export. Real browser, real Sepolia RPC, real settled rounds.
//   node test/live-browser.mjs /path/to/playwright/index.mjs
// Doubles: only the wallet (a throwaway key) and the document host. dist/ is served at the
// deployed hostname by route interception, so the browser sends the true Origin and enforces
// CORS against the live RPC. Saved checkpoints are moved back to replay rounds already settled:
// that models a returning player, and no round or chain answer is invented.
import { readFile, mkdir } from "node:fs/promises";
import { extname, resolve } from "node:path";
import assert from "node:assert/strict";
import { createPublicClient, http } from "viem";
import { sepolia } from "viem/chains";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
const { chromium } = await import(process.argv[2] ?? "playwright");
const ORIGIN =
  process.argv[3] ??
  "https://squeekville-a-little-town-hamste.identitymd.eth.limo";
const RPC = "https://rpc.sepolia.ethpandaops.io";
const CORE = "0x74665dAecA35A2303e767E76a2FF1FB6F93e119f";
const coreAbi = JSON.parse(await readFile("src/chain/SqueekCore.json", "utf8"));
const shots = "test/scratch/live-browser";
await mkdir(shots, { recursive: true });
const mime = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".png": "image/png",
};
// Facts for the seeds come straight from the chain, independently of the app's adapter.
const chain = createPublicClient({ chain: sepolia, transport: http(RPC) });
const block = await chain.getBlock({ blockTag: "finalized" });
const read = { address: CORE, abi: coreAbi, blockNumber: block.number };
const state = await chain.readContract({ ...read, functionName: "state" });
const frontier = state.settledThroughRound;
const position = async (round) =>
  (
    await chain.readContract({
      ...read,
      functionName: "roundPage",
      args: [round, round, 0n],
    })
  ).end.cumulativeWork;
// The save keeps its newest 40 journal lines, and one refresh reads up to four pages. To see a
// real positive-work line, start where the fourth page stops on an active round.
async function pageFrom(cursor) {
  const through = cursor + 128n < frontier ? cursor + 128n : frontier;
  return chain.readContract({
    ...read,
    functionName: "roundPage",
    args: [cursor, through, 16n],
  });
}
async function denseStart() {
  const stops = [];
  for (let cursor = 0n; cursor < frontier;) {
    const page = await pageFrom(cursor);
    stops.push({
      cursor,
      next: page.certifiedThroughRound,
      endsActive: page.rounds.at(-1)?.roundId === page.certifiedThroughRound,
    });
    cursor = page.certifiedThroughRound;
  }
  for (let index = stops.length - 1; index >= 3; index--)
    if (stops[index].endsActive)
      return { start: stops[index - 3].cursor, stop: stops[index].next };
  throw new Error("No dense active region found");
}
const dense = await denseStart();
const account = privateKeyToAccount(generatePrivateKey());
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  reducedMotion: "reduce",
});
const stats = {
  requests: 0,
  batches: 0,
  single: 0,
  statuses: {},
  hosts: new Set(),
  origins: new Set(),
  methods: {},
  tags: new Set(),
};
const errors = [];
await context.route(`${ORIGIN}/**`, async (route) => {
  const path = new URL(route.request().url()).pathname;
  const file = resolve("dist", `.${path === "/" ? "/index.html" : path}`);
  try {
    await route.fulfill({
      body: await readFile(file),
      contentType: mime[extname(file)] ?? "application/octet-stream",
    });
  } catch {
    await route.fulfill({ status: 404, body: "" });
  }
});
context.on("request", async (request) => {
  if (request.method() !== "POST" || request.url().startsWith(ORIGIN)) return;
  const url = new URL(request.url());
  stats.hosts.add(url.hostname);
  stats.requests++;
  stats.origins.add((await request.allHeaders()).origin);
  const body = request.postDataJSON();
  const list = Array.isArray(body) ? body : [body];
  Array.isArray(body) ? stats.batches++ : stats.single++;
  for (const { method, params = [] } of list) {
    stats.methods[method] = (stats.methods[method] ?? 0) + 1;
    const tag =
      method === "eth_call"
        ? params[1]
        : method === "eth_getBlockByNumber"
          ? params[0]
          : null;
    if (tag && !tag.startsWith("0x")) stats.tags.add(tag);
  }
});
context.on("response", (response) => {
  if (response.url().startsWith(RPC))
    stats.statuses[response.status()] =
      (stats.statuses[response.status()] ?? 0) + 1;
});
await context.exposeFunction("__liveSign", (data) =>
  account.signTypedData(data),
);
await context.addInitScript(
  ({ address }) => {
    const listeners = {};
    const provider = {
      on: (name, fn) => (listeners[name] ??= []).push(fn),
      removeListener: (name, fn) =>
        (listeners[name] = (listeners[name] ?? []).filter((f) => f !== fn)),
      async request({ method, params }) {
        if (method === "eth_chainId") return "0xaa36a7";
        if (method === "eth_accounts")
          return localStorage.getItem("__live_wallet") ? [address] : [];
        if (method === "eth_requestAccounts") {
          localStorage.setItem("__live_wallet", "yes");
          return [address];
        }
        if (method.endsWith("Permissions"))
          return [{ parentCapability: "eth_accounts" }];
        if (method === "eth_signTypedData_v4")
          return window.__liveSign(JSON.parse(params[1]));
        throw new Error(`Unexpected wallet method: ${method}`);
      },
    };
    const announce = () =>
      dispatchEvent(
        new CustomEvent("eip6963:announceProvider", {
          detail: {
            info: {
              uuid: "0b6f2c59-1c1a-4f6a-9a55-6b4f3bd6f1aa",
              name: "Live check wallet",
              icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"/>',
              rdns: "test.squeekville.live",
            },
            provider,
          },
        }),
      );
    addEventListener("eip6963:requestProvider", announce);
    announce();
  },
  { address: account.address },
);
const key = `connected:11155111:${account.address.toLowerCase()}`;
const withStore = (page, fn, arg) =>
  page.evaluate(
    async ({ source, key, arg }) => {
      const db = await new Promise((done, fail) => {
        const open = indexedDB.open("squeekville-v1", 1);
        open.onsuccess = () => done(open.result);
        open.onerror = fail;
      });
      const change = new Function(`return (${source})`)();
      return new Promise((done, fail) => {
        const tx = db.transaction("towns", "readwrite");
        const store = tx.objectStore("towns");
        const get = store.get(key);
        let out;
        get.onsuccess = () => {
          out = change(get.result, arg);
          if (out?.write) store.put(out.write);
        };
        tx.oncomplete = () => {
          db.close();
          done(out?.read);
        };
        tx.onerror = fail;
      });
    },
    { source: fn.toString(), key, arg },
  );
const saved = (page) =>
  withStore(page, (save) => ({
    read: {
      energy: save.energy,
      checkpoint: save.checkpoint,
      journal: save.journal.length,
      completed: save.completed.length,
      pending: !!save.pending,
      lastSuccess: save.lastSuccess,
      anchor: save.anchor?.number,
      latest: save.journal[0]?.text,
      texts: save.journal.map((entry) => entry.text),
    },
  }));
async function until(page, check, label, ms = 40_000) {
  const end = Date.now() + ms;
  for (;;) {
    const value = await saved(page);
    if (check(value)) return value;
    if (Date.now() > end)
      throw new Error(`${label}: ${JSON.stringify(value).slice(0, 400)}`);
    await page.waitForTimeout(200);
  }
}
const seed = (page, checkpoint, work) =>
  withStore(
    page,
    (save, { checkpoint, work }) => ({
      write: {
        ...save,
        energy: 0,
        checkpoint,
        checkpointWork: work,
        pending: null,
      },
    }),
    { checkpoint: checkpoint.toString(), work: work.toString() },
  );
const connectedText = (page) =>
  page.getByText("Connected to Squeekchain", { exact: true });
const log = (line) => console.log(`PASS ${line}`);
const watch = (page) => {
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
};
const summary = {
  origin: ORIGIN,
  finalizedAtStart: block.number.toString(),
  frontier: frontier.toString(),
  activeRegion: `${dense.start}..${dense.stop}`,
};
try {
  const page = await context.newPage();
  watch(page);
  await page.goto(`${ORIGIN}/`);
  await page
    .getByRole("button", { name: "Connect wallet", exact: true })
    .click();
  await page.getByRole("button", { name: /Live check wallet/ }).click();
  await connectedText(page).waitFor({ timeout: 40_000 });
  const first = await until(page, (s) => s?.checkpoint !== null, "initialize");
  assert.equal(first.energy, 0);
  assert.equal(first.checkpoint, frontier.toString());
  assert.equal(await page.locator(".connection-error").count(), 0);
  assert.equal(
    await page
      .getByRole("button", { name: "Sign mayor order", exact: true })
      .isEnabled(),
    true,
  );
  const action = await page
    .getByRole("button", { name: "Sign mayor order", exact: true })
    .boundingBox();
  assert.ok(
    action.y + action.height <= 844,
    "Signing action below first screen",
  );
  await page.mouse.move(0, 0);
  await page.screenshot({ path: `${shots}/390-connected.png` });
  log(
    `first connect verifies both proxies and initializes at round ${first.checkpoint}, finalized block ${first.anchor}, 0 energy, no history credit`,
  );

  // Three real zero-work rounds: exactly +1 each.
  await seed(page, frontier - 3n, await position(frontier - 3n));
  await page.reload();
  const zero = await until(
    page,
    (s) => s.checkpoint === frontier.toString(),
    "zero rounds",
  );
  assert.equal(zero.energy, 3);
  assert.ok(
    zero.texts.some((text) =>
      text.includes(`Verified settled round ${frontier}: 0 work. +1`),
    ),
  );
  log(
    `returning save read real settled rounds ${frontier - 2n}..${frontier} at zero work: energy 0 -> 3`,
  );

  const baseline = await saved(page);
  const same = (s) =>
    s.energy === baseline.energy &&
    s.checkpoint === baseline.checkpoint &&
    s.journal === baseline.journal;
  for (let i = 0; i < 2; i++) {
    await page.reload();
    await connectedText(page).waitFor({ timeout: 40_000 });
    assert.ok(same(await saved(page)), "reload changed progress");
  }
  log("two reloads: energy, checkpoint and journal unchanged");
  await page.getByRole("button", { name: "Refresh verified rounds" }).click();
  await connectedText(page).waitFor({ timeout: 40_000 });
  const before = baseline.lastSuccess;
  await until(page, (s) => s.lastSuccess !== before, "refresh", 40_000);
  assert.ok(same(await saved(page)), "repeated read changed progress");
  log("repeated verified read: energy, checkpoint and journal unchanged");

  // Reconnect: real disconnect control, then connect again.
  await page.getByRole("button", { name: /…/ }).first().click();
  await page.getByRole("button", { name: /^Disconnect/ }).click();
  await page
    .getByRole("button", { name: "Connect wallet", exact: true })
    .waitFor();
  await page
    .getByRole("button", { name: "Connect wallet", exact: true })
    .click();
  await page.getByRole("button", { name: /Live check wallet/ }).click();
  await connectedText(page).waitFor({ timeout: 40_000 });
  await page.waitForTimeout(1500);
  assert.ok(same(await saved(page)), "reconnect changed progress");
  log(
    "wallet disconnect and reconnect: energy, checkpoint and journal unchanged",
  );

  // Two tabs racing from the same older cursor over real rounds.
  await seed(page, frontier - 3n, await position(frontier - 3n));
  const second = await context.newPage();
  watch(second);
  await Promise.all([page.reload(), second.goto(`${ORIGIN}/`)]);
  const raced = await until(
    page,
    (s) => s.checkpoint === frontier.toString(),
    "tab race",
  );
  await connectedText(second).waitFor({ timeout: 40_000 });
  await page.waitForTimeout(2000);
  const afterRace = await saved(page);
  assert.equal(raced.energy, 3);
  assert.equal(afterRace.energy, 3);
  assert.equal(afterRace.checkpoint, frontier.toString());
  await second.close();
  log(
    "two tabs reading the same real rounds at once credit them once: energy 3",
  );

  // A real signed local order spends 3 once.
  await page
    .getByRole("button", { name: "Sign mayor order", exact: true })
    .click();
  await page
    .locator('.town-scene[data-event="bakery"]')
    .waitFor({ timeout: 20_000 });
  const spent = await until(page, (s) => s.completed === 1, "order");
  assert.equal(spent.energy, 0);
  assert.equal(spent.pending, false);
  await page.reload();
  await connectedText(page).waitFor({ timeout: 40_000 });
  const reloaded = await saved(page);
  assert.equal(reloaded.completed, 1);
  assert.equal(reloaded.energy, 0);
  assert.equal(
    await page.locator(".town-scene").getAttribute("data-event"),
    "idle",
  );
  log(
    "EIP-712 order signed at the deployed origin ran once from verified energy; reload did not replay it",
  );

  // Real active rounds with positive work.
  await seed(page, dense.start, await position(dense.start));
  await page.reload();
  const credited = await until(
    page,
    (s) => s.checkpoint === dense.stop.toString(),
    "active rounds",
    60_000,
  );
  assert.equal(credited.energy, 12);
  const line = credited.texts[0];
  assert.match(
    line,
    new RegExp(`^Verified settled round ${dense.stop}: [1-9][0-9]* work\\.`),
  );
  const done = await until(
    page,
    (s) => s.checkpoint === frontier.toString(),
    "catch up",
    120_000,
  );
  assert.equal(done.energy, 12);
  log(
    `real active rounds credited from ${dense.start}: newest line "${line}"; caught up in bounded pages to ${frontier}; energy held at the 12 cap`,
  );

  // A real browser fetch failure against the production export, then recovery from the live RPC.
  await context.route(`${RPC}/**`, (route) => route.abort("failed"));
  await page.getByRole("button", { name: "Refresh verified rounds" }).click();
  await page
    .getByText("Chain connection paused", { exact: true })
    .waitFor({ timeout: 30_000 });
  await page.locator(".diagnostics summary").click();
  const text = await page.locator(".diagnostics dl").innerText();
  assert.match(text, /Failed stage\s+network/);
  assert.match(text, /rpc\.sepolia\.ethpandaops\.io/);
  assert.match(text, /Failed to fetch/);
  const paused = await saved(page);
  await page.locator(".diagnostics").scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${shots}/390-diagnostics.png` });
  await context.unroute(`${RPC}/**`);
  await page
    .getByRole("button", { name: "Retry connection", exact: true })
    .click();
  await connectedText(page).waitFor({ timeout: 40_000 });
  const recovered = await saved(page);
  assert.equal(recovered.energy, paused.energy);
  assert.equal(recovered.checkpoint, paused.checkpoint);
  assert.equal(await page.locator(".diagnostics").count(), 0);
  log(
    "blocked RPC shows staged diagnostics, changes nothing, and recovers from the live RPC",
  );

  // Failed-fetch lines are the deliberate outage above; anything else is a defect.
  const unexpected = errors.filter(
    (message) => !/Failed to load resource|ERR_FAILED/.test(message),
  );
  assert.deepEqual(unexpected, []);
  summary.rpc = {
    ...stats,
    hosts: [...stats.hosts],
    origins: [...stats.origins],
    tags: [...stats.tags],
  };
  assert.deepEqual(summary.rpc.hosts, ["rpc.sepolia.ethpandaops.io"]);
  assert.deepEqual(summary.rpc.origins, [ORIGIN]);
  assert.deepEqual(summary.rpc.tags, ["finalized"]);
  assert.ok(stats.batches > 0 && stats.statuses[200] > 0);
  console.log(JSON.stringify(summary, null, 2));
} catch (error) {
  for (const open of context.pages()) {
    await open.screenshot({ path: `${shots}/failure.png` }).catch(() => {});
    console.error(
      (
        await open
          .locator("#mayor-controls")
          .innerText()
          .catch(() => "")
      ).slice(0, 900),
    );
  }
  console.error(errors.slice(0, 8));
  throw error;
} finally {
  await browser.close();
}
