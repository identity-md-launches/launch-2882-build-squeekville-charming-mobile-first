// Production-export tests. Wallets and changing chain data below are TEST DOUBLES,
// injected only by Playwright. The shipped application has no test or simulation switch.
import { createServer } from "node:http";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve, extname } from "node:path";
import assert from "node:assert/strict";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import {
  decodeFunctionData,
  encodeFunctionResult,
  keccak256,
  toHex,
} from "viem";
const { chromium, webkit } = await import(process.argv[2] ?? "playwright");
const coreAbi = JSON.parse(await readFile("src/chain/SqueekCore.json", "utf8"));
const fixture = JSON.parse(
  await readFile("test/fixtures/sepolia-identity.json", "utf8"),
);
const recordedBlock = fixture.calls.find(
  (c) => c.method === "eth_getBlockByNumber",
).result;
const core = "0x74665daeca35a2303e767e76a2ff1fb6f93e119f";
const root = resolve("dist");
const mime = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".json": "application/json",
};
const server = createServer(async (request, response) => {
  try {
    const path = new URL(request.url, "http://localhost").pathname;
    if (!path.startsWith("/town/")) throw new Error("Wrong static subpath");
    const file = resolve(
      root,
      "." +
        path.slice("/town".length) +
        (path.endsWith("/") ? "index.html" : ""),
    );
    if (!file.startsWith(root + "/")) throw new Error("Outside export");
    response.setHeader(
      "content-type",
      mime[extname(file)] ?? "application/octet-stream",
    );
    response.end(await readFile(file));
  } catch {
    response.writeHead(404).end();
  }
});
await new Promise((done) => server.listen(0, "127.0.0.1", done));
const url = `http://127.0.0.1:${server.address().port}/town/`;
await mkdir("test/scratch/browser-check", { recursive: true });
const results = [];
results.push = function (...items) {
  items.forEach((item) => console.log(item));
  return Array.prototype.push.apply(this, items);
};
const browser = await chromium.launch({ headless: true });
const errors = [];
let lastPage;
const watchdog = setTimeout(() => {
  console.error("Browser validation exceeded its 120-second limit");
  process.exitCode = 1;
  browser.close();
  server.close();
}, 120000);
watchdog.unref();
function inspect(page) {
  lastPage = page;
  page.setDefaultTimeout(10000);
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("response", (response) => {
    if (response.url().startsWith(url) && response.status() >= 400)
      errors.push(`Missing local resource: ${response.url()}`);
  });
}
async function saveState(page, practice = false) {
  return page.evaluate(async (practice) => {
    const db = await new Promise((resolve, reject) => {
      const r = indexedDB.open("squeekville-v1", 1);
      r.onsuccess = () => resolve(r.result);
      r.onerror = reject;
    });
    return new Promise((resolve, reject) => {
      const request = db.transaction("towns").objectStore("towns").getAll();
      request.onsuccess = () => {
        const data = request.result.filter((x) =>
          practice ? x.key === "practice:v1" : x.key.startsWith("connected:"),
        );
        db.close();
        resolve(
          data.map((x) => ({
            key: x.key,
            energy: x.energy,
            checkpoint: x.checkpoint,
            pending: !!x.pending,
            completed: x.completed.length,
            journal: x.journal.length,
            settings: x.settings,
          })),
        );
      };
      request.onerror = reject;
    });
  }, practice);
}
async function waitForState(page, check, practice = false) {
  for (let i = 0; i < 100; i++) {
    const state = await saveState(page, practice);
    if (check(state)) return state;
    await page.waitForTimeout(50);
  }
  throw new Error("Saved town did not reach the expected state");
}
try {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  inspect(page);
  await page.goto(url);
  await page
    .getByRole("heading", { name: "The hamster powers the town." })
    .waitFor();
  await page.evaluate(() => document.fonts.ready);
  assert.ok(
    (
      await page
        .getByRole("button", { name: "Sign mayor order", exact: true })
        .boundingBox()
    ).y +
      48 <=
      844,
    "Primary action must be on the first 390px screen",
  );
  await page.screenshot({
    path: "test/scratch/browser-check/390-initial.png",
    fullPage: true,
  });
  results.push("390px first screen shows town, choices and signing action");
  await page
    .getByRole("button", { name: "Connect wallet", exact: true })
    .focus();
  await page.keyboard.press("Enter");
  await page.getByRole("dialog").waitFor();
  assert.ok(
    await page.evaluate(() =>
      document.querySelector("dialog").contains(document.activeElement),
    ),
  );
  await page.keyboard.press("Escape");
  assert.equal(await page.getByRole("dialog").isVisible(), false);
  assert.match(
    await page.evaluate(() => document.activeElement.textContent),
    /Connect wallet/,
  );
  results.push(
    "Keyboard opens wallet dialog, focus stays inside and Escape restores focus",
  );
  await page.getByRole("button", { name: "Practice", exact: true }).click();
  await page
    .getByText("Practice mode - simulated data", { exact: true })
    .waitFor();
  await page
    .getByRole("button", { name: "Place demo order", exact: true })
    .click();
  await page.getByText("Unsigned demo order", { exact: true }).waitFor();
  assert.equal((await saveState(page, true))[0].energy, 0);
  await page.getByRole("button", { name: "Simulate a settled round" }).click();
  await page.locator('.town-scene[data-event="bakery"]').waitFor();
  await waitForState(
    page,
    (rows) => rows[0]?.completed === 1 && rows[0].energy === 0,
    true,
  );
  await page.screenshot({
    path: "test/scratch/browser-check/390-bakery.png",
    fullPage: true,
  });
  await page
    .locator('.town-scene[data-event="idle"]')
    .waitFor({ timeout: 12000 });
  for (const location of ["park", "square"]) {
    await page
      .getByRole("button", {
        name:
          location === "park" ? "Start the Fountain" : "Light Up the Square",
      })
      .click();
    await page
      .getByRole("button", { name: "Simulate a settled round" })
      .click();
    await page
      .getByRole("button", { name: "Place demo order", exact: true })
      .click();
    await page.locator(`.town-scene[data-event="${location}"]`).waitFor();
    await page.screenshot({
      path: `test/scratch/browser-check/390-${location}.png`,
      fullPage: true,
    });
    await page
      .locator('.town-scene[data-event="idle"]')
      .waitFor({ timeout: 12000 });
  }
  const practiceSave = (await saveState(page, true))[0];
  assert.equal(practiceSave.completed, 3);
  assert.equal(practiceSave.energy, 0);
  await page.reload();
  await page.getByRole("button", { name: "Practice", exact: true }).click();
  await waitForState(page, (rows) => rows[0]?.completed === 3, true);
  assert.equal(
    await page.locator(".town-scene").getAttribute("data-event"),
    "idle",
  );
  await page
    .getByRole("checkbox", { name: "Positive work (+3 energy)" })
    .uncheck();
  await page.getByRole("button", { name: "Simulate a settled round" }).click();
  await waitForState(page, (rows) => rows[0]?.energy === 1, true);
  await page.getByText("How it works", { exact: true }).click();
  await page
    .getByRole("checkbox", { name: "Reduce town motion", exact: true })
    .check();
  await waitForState(
    page,
    (rows) => rows[0]?.settings.reducedMotion === true,
    true,
  );
  results.push(
    "All three 10-second Practice events, zero/positive simulation, reload, settings and no animation replay pass",
  );
  for (const width of [320, 390, 760, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
      `Overflow at ${width}px`,
    );
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({
    path: "test/scratch/browser-check/1440-practice.png",
    fullPage: true,
  });
  results.push(
    "No overflow at 320, 390, 760 and 1440 with expanded rules and stored state",
  );
  await context.close();
  const phone = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1",
  });
  const phonePage = await phone.newPage();
  inspect(phonePage);
  await phonePage.goto(url);
  await phonePage
    .getByRole("button", { name: "Connect wallet", exact: true })
    .click();
  for (const name of ["MetaMask", "Coinbase Wallet", "Rabby", "Phantom"])
    await phonePage
      .getByRole("link", { name: `Open in ${name}`, exact: true })
      .waitFor();
  await phonePage
    .getByRole("button", { name: /Coinbase Smart Wallet/ })
    .waitFor();
  const rabbyLink = new URL(
    await phonePage
      .getByRole("link", { name: "Open in Rabby", exact: true })
      .getAttribute("href"),
  );
  assert.equal(rabbyLink.searchParams.get("_cmd"), "open-dapp");
  assert.equal(rabbyLink.searchParams.get("dapp"), url);
  assert.equal(
    await phonePage.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  await phonePage.screenshot({
    path: "test/scratch/browser-check/390-phone-wallets.png",
  });
  await phone.close();
  results.push(
    "Phone sheet offers four wallet-app links with local marks and Coinbase Smart Wallet; actual site URL is preserved",
  );

  const accounts = [
    privateKeyToAccount(generatePrivateKey()),
    privateKeyToAccount(generatePrivateKey()),
  ];
  const connected = await browser.newContext({
    viewport: { width: 390, height: 844 },
    reducedMotion: "reduce",
  });
  await connected.exposeFunction("__testSign", async (index, data) =>
    accounts[index].signTypedData(data),
  );
  await connected.addInitScript(
    ({ addresses }) => {
      const listeners = {};
      const state = {
        index: 0,
        chain: Number(localStorage.getItem("__test_wallet_chain") ?? 1),
        connected: localStorage.getItem("__test_wallet_permission") === "yes",
        reject: false,
        accountDuringSign: false,
        rejectConnection:
          localStorage.getItem("__test_wallet_permission") !== "yes",
        unknownSepolia:
          localStorage.getItem("__test_wallet_chain") !== "11155111",
        methods: [],
      };
      const emit = (name, data) =>
        (listeners[name] ?? []).forEach((fn) => fn(data));
      const provider = {
        isMetaMask: true,
        on(name, fn) {
          (listeners[name] ??= []).push(fn);
        },
        removeListener(name, fn) {
          listeners[name] = (listeners[name] ?? []).filter((f) => f !== fn);
        },
        async request({ method, params }) {
          state.methods.push(method);
          if (method === "eth_chainId") return "0x" + state.chain.toString(16);
          if (method === "eth_accounts")
            return state.connected ? [addresses[state.index]] : [];
          if (method === "eth_requestAccounts") {
            if (state.rejectConnection)
              throw Object.assign(new Error("User rejected the request"), {
                code: 4001,
              });
            state.connected = true;
            localStorage.setItem("__test_wallet_permission", "yes");
            return [addresses[state.index]];
          }
          if (
            method === "wallet_getPermissions" ||
            method === "wallet_requestPermissions"
          )
            return [{ parentCapability: "eth_accounts" }];
          if (
            method === "wallet_switchEthereumChain" ||
            method === "wallet_addEthereumChain"
          ) {
            if (method === "wallet_switchEthereumChain" && state.unknownSepolia)
              throw Object.assign(new Error("Unknown chain"), { code: 4902 });
            if (method === "wallet_addEthereumChain")
              state.unknownSepolia = false;
            state.chain = parseInt(params[0].chainId, 16);
            localStorage.setItem("__test_wallet_chain", String(state.chain));
            emit("chainChanged", params[0].chainId);
            return null;
          }
          if (method === "eth_signTypedData_v4") {
            if (state.reject)
              throw Object.assign(new Error("User rejected the request"), {
                code: 4001,
              });
            const signature = await window.__testSign(
              state.index,
              JSON.parse(params[1]),
            );
            if (state.accountDuringSign) {
              state.index = 1;
              emit("accountsChanged", [addresses[1]]);
            }
            return signature;
          }
          if (method === "wallet_revokePermissions") return null;
          throw new Error(`Unexpected wallet method: ${method}`);
        },
      };
      window.ethereum = provider;
      window.__walletTest = {
        state,
        account(index) {
          state.index = index;
          emit("accountsChanged", [addresses[index]]);
        },
        disconnect() {
          state.connected = false;
          emit("disconnect", { code: 4900, message: "Disconnected" });
        },
        chain(chain) {
          state.chain = chain;
          emit("chainChanged", "0x" + chain.toString(16));
        },
      };
      const announce = () =>
        dispatchEvent(
          new CustomEvent("eip6963:announceProvider", {
            detail: {
              info: {
                uuid: "6e3f7e27-e309-4ad9-931f-813c43832cc0",
                name: "Squeekville test wallet",
                icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"/>',
                rdns: "test.squeekville.wallet",
              },
              provider,
            },
          }),
        );
      addEventListener("eip6963:requestProvider", announce);
      announce();
    },
    { addresses: accounts.map((a) => a.address) },
  );
  let frontier = 100n;
  let generation = 0;
  let failing = false;
  const work = new Map();
  const position = (round) => {
    let cumulativeWork = 1000n;
    for (const [id, value] of work) if (id <= round) cumulativeWork += value;
    return {
      cumulativeWork,
      cumulativeBlockUnits: cumulativeWork * 1_000_000_000n,
      workPerThousandBlocks: 10875,
    };
  };
  const blockFor = (number) => ({
    ...recordedBlock,
    number: toHex(number),
    hash: keccak256(toHex(`squeekville-test-block-${number}`)),
  });
  const rpc = (request) => {
    const { method, params = [] } = request;
    if (method === "eth_chainId") return "0xaa36a7";
    if (method === "eth_getBlockByNumber")
      return blockFor(
        params[0] === "finalized"
          ? BigInt(recordedBlock.number) + BigInt(generation)
          : BigInt(params[0]),
      );
    if (method === "eth_call" && params[0].to?.toLowerCase() === core) {
      let decoded;
      try {
        decoded = decodeFunctionData({ abi: coreAbi, data: params[0].data });
      } catch {}
      if (decoded?.functionName === "state") {
        const p = position(frontier);
        return encodeFunctionResult({
          abi: coreAbi,
          functionName: "state",
          result: {
            settledThroughRound: frontier,
            ...p,
            blockHeight: p.cumulativeBlockUnits / 1_000_000_000n,
            blockProgress: p.cumulativeBlockUnits % 1_000_000_000n,
            authorizationNonce: frontier,
            paused: false,
          },
        });
      }
      if (decoded?.functionName === "roundPage") {
        const [after, through, max] = decoded.args;
        assert.ok(after <= through && through <= frontier && max <= 16n);
        const all = [...work]
          .filter(([id, value]) => id > after && id <= through && value > 0n)
          .sort((a, b) => Number(a[0] - b[0]));
        const end =
          all.length > Number(max) ? all[Number(max)][0] - 1n : through;
        const rounds = all.slice(0, Number(max)).map(([id]) => ({
          roundId: id,
          ...position(id),
          dataHash: keccak256(toHex(`test-round-${id}`)),
        }));
        return encodeFunctionResult({
          abi: coreAbi,
          functionName: "roundPage",
          result: {
            certifiedThroughRound: end,
            start: position(after),
            end: position(end),
            rounds,
          },
        });
      }
    }
    const match = fixture.calls.find(
      (call) =>
        call.method === method &&
        (method === "eth_call"
          ? call.params[0].to?.toLowerCase() === params[0].to?.toLowerCase() &&
            call.params[0].data === params[0].data
          : method === "eth_getCode"
            ? call.params[0].toLowerCase() === params[0].toLowerCase()
            : method === "eth_getStorageAt"
              ? call.params[0].toLowerCase() === params[0].toLowerCase() &&
                call.params[1] === params[1]
              : false),
    );
    if (!match) throw new Error(`Unrecorded chain read: ${method}`);
    return match.result;
  };
  await connected.route(
    "https://11155111.rpc.thirdweb.com/**",
    async (route) => {
      if (failing) {
        await route.fulfill({ status: 503, body: "Test RPC unavailable" });
        return;
      }
      const body = route.request().postDataJSON();
      const respond = (request) => ({
        jsonrpc: "2.0",
        id: request.id,
        result: rpc(request),
      });
      try {
        await route.fulfill({
          contentType: "application/json",
          body: JSON.stringify(
            Array.isArray(body) ? body.map(respond) : respond(body),
          ),
        });
      } catch (error) {
        errors.push(error.message);
        await route.fulfill({ status: 500, body: error.message });
      }
    },
  );
  const live = await connected.newPage();
  inspect(live);
  await live.goto(url);
  await live
    .getByRole("button", { name: "Connect wallet", exact: true })
    .click();
  await live.getByRole("button", { name: /Squeekville test wallet/ }).click();
  await live
    .getByText(
      "Request declined in your wallet. Nothing was changed. You can try again.",
      { exact: true },
    )
    .waitFor();
  await live.evaluate(() => {
    window.__walletTest.state.rejectConnection = false;
  });
  await live.getByRole("button", { name: /Squeekville test wallet/ }).click();
  await live
    .getByRole("button", { name: "Switch to Sepolia", exact: true })
    .waitFor();
  assert.equal(
    await live
      .getByRole("button", { name: "Sign mayor order", exact: true })
      .isDisabled(),
    true,
  );
  await live
    .getByRole("button", { name: "Switch to Sepolia", exact: true })
    .click();
  await live.getByText("Connected to Squeekchain", { exact: true }).waitFor();
  await waitForState(
    live,
    (rows) => rows[0]?.checkpoint === "100" && rows[0].energy === 0,
  );
  const earlyMethods = await live.evaluate(
    () => window.__walletTest.state.methods,
  );
  assert.ok(earlyMethods.includes("wallet_addEthereumChain"));
  assert.equal(earlyMethods.includes("eth_signTypedData_v4"), false);
  results.push(
    "Injected EIP-6963 wallet, rejected connection, wrong network and Sepolia switch/add fallback pass",
  );
  await live.evaluate(() => {
    window.__walletTest.state.reject = true;
  });
  await live
    .getByRole("button", { name: "Sign mayor order", exact: true })
    .click();
  await live.getByText(/Signature declined/).waitFor();
  assert.equal((await saveState(live))[0].pending, false);
  await live.evaluate(() => {
    window.__walletTest.state.reject = false;
  });
  await live
    .getByRole("button", { name: "Sign mayor order", exact: true })
    .click();
  await live.getByText("Local order signed", { exact: true }).waitFor();
  results.push(
    "Rejected signature leaves no order; accepted EIP-712 signature is verified and waits at zero energy",
  );
  // A second tab races the first when the same newly settled round arrives.
  const second = await connected.newPage();
  inspect(second);
  await second.goto(url);
  await second.getByText("Local order signed", { exact: true }).waitFor();
  frontier++;
  work.set(frontier, 6n);
  generation++;
  await Promise.all([
    live.getByRole("button", { name: "Refresh verified rounds" }).click(),
    second.getByRole("button", { name: "Refresh verified rounds" }).click(),
  ]);
  await waitForState(
    live,
    (rows) =>
      rows[0]?.completed === 1 && rows[0].energy === 0 && !rows[0].pending,
  );
  await live.reload();
  await live.getByText("Connected to Squeekchain", { exact: true }).waitFor();
  assert.equal((await saveState(live))[0].completed, 1);
  assert.equal(
    await live.locator(".town-scene").getAttribute("data-event"),
    "idle",
  );
  await second.close();
  results.push(
    "Two tabs process one signed order exactly once; reload and repeated reads do not replay it",
  );
  // An RPC failure is not a zero-work round and cannot change energy or checkpoint.
  failing = true;
  frontier++;
  work.set(frontier, 4n);
  generation++;
  await live.getByRole("button", { name: "Refresh verified rounds" }).click();
  await live.getByText("Chain connection paused", { exact: true }).waitFor();
  assert.equal((await saveState(live))[0].checkpoint, "101");
  assert.equal((await saveState(live))[0].energy, 0);
  assert.equal(
    await live
      .getByRole("button", { name: "Sign mayor order", exact: true })
      .isDisabled(),
    true,
  );
  failing = false;
  await live
    .getByRole("button", { name: "Retry connection", exact: true })
    .click();
  await live.getByText("Connected to Squeekchain", { exact: true }).waitFor();
  await waitForState(
    live,
    (rows) => rows[0]?.energy === 3 && rows[0].checkpoint === "102",
  );
  results.push(
    "RPC failure pauses connected play and accrual; retry recovers the complete missing round once",
  );
  for (const location of ["park", "square"]) {
    if (location === "square") {
      frontier++;
      work.set(frontier, 2n);
      generation++;
      await live
        .getByRole("button", { name: "Refresh verified rounds" })
        .click();
      await waitForState(live, (rows) => rows[0]?.energy === 3);
    }
    await live
      .getByRole("button", {
        name:
          location === "park" ? /Start the Fountain/ : /Light Up the Square/,
      })
      .click();
    await live
      .getByRole("button", { name: "Sign mayor order", exact: true })
      .click();
    await live.locator(`.town-scene[data-event="${location}"]`).waitFor();
    await live
      .locator('.town-scene[data-event="idle"]')
      .waitFor({ timeout: 12000 });
  }
  results.push(
    "All three locations execute from cryptographically verified EIP-712 orders; saved energy executes immediately after signing",
  );
  frontier++;
  work.set(frontier, 1n);
  generation++;
  await live.getByRole("button", { name: "Refresh verified rounds" }).click();
  await waitForState(
    live,
    (rows) => rows[0]?.energy === 3 && rows[0]?.checkpoint === "104",
  );
  await live.evaluate(() => window.__walletTest.account(1));
  await waitForState(
    live,
    (rows) =>
      rows.length === 2 &&
      rows.some(
        (x) =>
          x.key.endsWith(accounts[1].address.toLowerCase()) &&
          x.energy === 0 &&
          x.checkpoint === "104",
      ),
  );
  await live.evaluate(() => window.__walletTest.account(0));
  await live.getByRole("button", { name: /Start the Fountain/ }).click();
  await live.evaluate(() => {
    window.__walletTest.state.accountDuringSign = true;
  });
  await live
    .getByRole("button", { name: "Sign mayor order", exact: true })
    .click();
  await waitForState(
    live,
    (rows) => rows.length === 2 && rows.every((x) => !x.pending),
  );
  assert.ok(
    (await saveState(live)).find((x) =>
      x.key.endsWith(accounts[0].address.toLowerCase()),
    ).energy === 3,
  );
  results.push(
    "Account switching isolates progress and a change during signing cannot save or execute the old account’s order",
  );
  await live.evaluate(() => window.__walletTest.disconnect());
  await live
    .getByRole("button", { name: "Connect wallet", exact: true })
    .waitFor();
  assert.equal(
    await live
      .getByRole("button", { name: "Sign mayor order", exact: true })
      .isDisabled(),
    true,
  );
  const methods = await live.evaluate(() => window.__walletTest.state.methods);
  assert.equal(
    methods.some((m) =>
      /sendTransaction|sendRawTransaction|signTransaction/.test(m),
    ),
    false,
  );
  results.push(
    "Provider disconnection disables signing; no transaction, approval or transfer method was requested",
  );
  await connected.close();
  assert.deepEqual(errors, []);
  results.push(
    "Production export works at a nested /town/ path with zero script errors and missing local resources",
  );
  let safari;
  try {
    safari = await webkit.launch({ headless: true });
  } catch {
    results.push(
      "LIMITATION: WebKit runtime unavailable; native Safari and physical wallet apps not tested",
    );
  }
  if (safari) {
    try {
      const page = await safari.newPage({
        viewport: { width: 390, height: 844 },
      });
      inspect(page);
      await page.goto(url);
      await page.getByRole("button", { name: "Practice", exact: true }).click();
      await page
        .getByRole("button", { name: "Place demo order", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Simulate a settled round" })
        .click();
      await page.locator('.town-scene[data-event="bakery"]').waitFor();
      results.push("WebKit primary Practice interaction passes");
    } finally {
      await safari.close();
    }
  }
  await writeFile(
    "test/scratch/browser-check/results.json",
    JSON.stringify({ results, errors }, null, 2),
  );
  console.log(JSON.stringify({ results, errors }, null, 2));
} catch (error) {
  if (lastPage && !lastPage.isClosed()) {
    await lastPage.screenshot({
      path: "test/scratch/browser-check/failure.png",
      fullPage: true,
    });
    console.error(await lastPage.locator("body").innerText());
  }
  throw error;
} finally {
  clearTimeout(watchdog);
  await browser.close();
  await new Promise((done) => server.close(done));
}
