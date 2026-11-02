// Raw JSON-RPC requests from a real browser at the deployed origin, one result per endpoint.
//   node test/rpc-origin-check.mjs /path/to/playwright/index.mjs [rpc-url ...]
// The gateway cannot always be reached, so only the document is intercepted. The browser still
// sends the true Origin and enforces CORS, and every RPC request goes to the real network.
const { chromium } = await import(process.argv[2] ?? "playwright");
const urls = process.argv.slice(3);
if (!urls.length) urls.push("https://rpc.sepolia.ethpandaops.io");
const ORIGIN = "https://squeekville-a-little-town-hamste.identitymd.eth.limo";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.route(`${ORIGIN}/**`, (route) =>
  route.fulfill({
    contentType: "text/html",
    body: "<!doctype html><title>Origin check</title>",
  }),
);
await page.goto(`${ORIGIN}/`);
const output = await page.evaluate(async (urls) => {
  const CORE = "0x74665dAecA35A2303e767E76a2FF1FB6F93e119f";
  const MINING = "0x3beE588fC20dE788Bac17d33b41Da7346cb27EC4";
  const IMPLEMENTATION =
    "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
  const ADMIN =
    "0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103";
  const STATE = "0xc19d93fb";
  const results = { origin: location.origin };
  for (const url of urls) {
    const post = async (body) => {
      try {
        const response = await fetch(url, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        });
        const text = await response.text();
        try {
          return { http: response.status, json: JSON.parse(text) };
        } catch {
          return { http: response.status, json: text.slice(0, 120) };
        }
      } catch (error) {
        return { thrown: `${error.name}: ${error.message}` };
      }
    };
    const one = (method, params = []) =>
      post({ jsonrpc: "2.0", id: 1, method, params });
    const view = (reply) =>
      reply.thrown ??
      (reply.http !== 200
        ? `HTTP ${reply.http} ${JSON.stringify(reply.json).slice(0, 100)}`
        : reply.json.error
          ? `RPC ${JSON.stringify(reply.json.error)}`
          : String(reply.json.result?.number ?? reply.json.result).slice(
              0,
              70,
            ));
    const log = {};
    log.chainId = view(await one("eth_chainId"));
    const finalized = await one("eth_getBlockByNumber", ["finalized", false]);
    log.finalized = view(finalized);
    const block = finalized.json?.result?.number;
    if (block) {
      log.coreImplementationSlot = view(
        await one("eth_getStorageAt", [CORE, IMPLEMENTATION, block]),
      );
      log.miningAdminSlot = view(
        await one("eth_getStorageAt", [MINING, ADMIN, block]),
      );
      log.stateCall = view(
        await one("eth_call", [{ to: CORE, data: STATE }, block]),
      );
      const old = `0x${(BigInt(block) - 100000n).toString(16)}`;
      log.storage100kBlocksBack = view(
        await one("eth_getStorageAt", [CORE, IMPLEMENTATION, old]),
      );
      log.call100kBlocksBack = view(
        await one("eth_call", [{ to: CORE, data: STATE }, old]),
      );
      const batch = await post([
        { jsonrpc: "2.0", id: 1, method: "eth_chainId", params: [] },
        {
          jsonrpc: "2.0",
          id: 2,
          method: "eth_getStorageAt",
          params: [CORE, IMPLEMENTATION, block],
        },
        {
          jsonrpc: "2.0",
          id: 3,
          method: "eth_call",
          params: [{ to: CORE, data: STATE }, block],
        },
        {
          jsonrpc: "2.0",
          id: 4,
          method: "eth_getBlockByNumber",
          params: [block, false],
        },
      ]);
      log.batch =
        batch.thrown ??
        (Array.isArray(batch.json)
          ? batch.json
              .map(
                (item) =>
                  `${item.id}:${item.error ? `error ${item.error.code}` : "ok"}`,
              )
              .join(" ")
          : `HTTP ${batch.http} ${JSON.stringify(batch.json).slice(0, 100)}`);
    }
    results[url] = log;
  }
  return results;
}, urls);
console.log(JSON.stringify(output, null, 2));
await browser.close();
