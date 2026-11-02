import deployment from "./sepolia-deployment.json";

// The stage a refresh stopped at. "local save" is the browser's own storage, never the chain.
export type FailureStage =
  | "network"
  | "finalized block"
  | "Core proxy verification"
  | "Mining proxy verification"
  | "configuration/links"
  | "state"
  | "roundPage"
  | "local save";
// rpc: the request did not produce a usable answer. deployment: the chain answered and the
// answer disagrees with the official record. consistency: verified contracts returned data
// that does not reconcile (or the anchor changed). local: browser storage.
export type FailureKind = "rpc" | "deployment" | "consistency" | "local";

export const FAILURE_LABELS: Record<FailureKind, string> = {
  rpc: "RPC or network failure",
  deployment: "Deployment mismatch",
  consistency: "Inconsistent chain data",
  local: "Browser save",
};

export class SnapshotError extends Error {
  readonly stage: FailureStage;
  readonly kind: FailureKind;
  constructor(
    stage: FailureStage,
    kind: FailureKind,
    message: string,
    cause?: unknown,
  ) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = "SnapshotError";
    this.stage = stage;
    this.kind = kind;
  }
}

export type ConnectionDiagnostics = {
  stage: FailureStage;
  kind: FailureKind;
  rpcHost: string;
  errorName: string;
  shortMessage: string;
  cause: string | null;
  rpcCode: number | null;
  httpStatus: number | null;
};

type ErrorLike = {
  name?: unknown;
  message?: unknown;
  shortMessage?: unknown;
  details?: unknown;
  code?: unknown;
  status?: unknown;
  cause?: unknown;
};

function causeChain(error: unknown): ErrorLike[] {
  const chain: ErrorLike[] = [];
  let current = error;
  while (current && typeof current === "object" && chain.length < 12) {
    chain.push(current as ErrorLike);
    current = (current as ErrorLike).cause;
  }
  return chain;
}

// viem reports any JSON-RPC -32603 as "reverted", so the error class alone cannot separate a
// contract that refused the call from a node that failed to run it. Code 3, an explicit
// revert reason, or an undecodable empty answer come from the contract side. All else is RPC.
const NO_DATA_ERRORS = new Set([
  "ContractFunctionZeroDataError",
  "AbiDecodingZeroDataError",
  "AbiDecodingDataSizeTooSmallError",
]);
export function classifyFailure(error: unknown): FailureKind {
  return causeChain(error).some(
    (item) =>
      item.code === 3 ||
      (typeof item.name === "string" && NO_DATA_ERRORS.has(item.name)) ||
      (typeof item.details === "string" && /revert/i.test(item.details)),
  )
    ? "deployment"
    : "rpc";
}

// Addresses published in the official record are public; any other may be the player's wallet.
const PUBLIC_ADDRESSES = new Set(
  [
    ...Object.values(deployment.contracts),
    ...Object.values(deployment.operational),
  ].map((item) => item.address.toLowerCase()),
);
const CAUSE_LIMIT = 240;

export function sanitizeDetail(text: string): string {
  const cleaned = text
    // viem appends request bodies and call arguments, including the sender, after these labels.
    .split(
      /\b(?:Request body|Raw Call Arguments|Request Arguments|Contract Call|Docs|Version|Details):/,
    )[0]
    .replace(/\b(?:https?|wss?):\/\/[^\s"'<>)]+/gi, (url) => {
      try {
        return new URL(url).hostname;
      } catch {
        return "[url]";
      }
    })
    .replace(/\bBearer\s+\S+/gi, "[credential]")
    .replace(
      /\b(api[-_]?key|access[-_]?token|token|secret|password|authorization|auth|key)(["']?\s*[=:]\s*["']?)[^\s"'&,;]+/gi,
      "$1$2[credential]",
    )
    .replace(/\beyJ[\w-]+\.[\w-]+\.[\w-]+/g, "[credential]")
    // Signatures, calldata, hashes and private keys.
    .replace(/\b0x[0-9a-f]{41,}\b/gi, "[hex data]")
    .replace(/\b[0-9a-f]{64,}\b/gi, "[hex data]")
    .replace(/\b0x[0-9a-f]{40}\b/gi, (address) =>
      PUBLIC_ADDRESSES.has(address.toLowerCase()) ? address : "[address]",
    )
    .replace(/\b(?!0x[0-9a-f]{40}\b)[a-z0-9_-]{32,}\b/gi, "[redacted]")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.length > CAUSE_LIMIT
    ? `${cleaned.slice(0, CAUSE_LIMIT - 1)}…`
    : cleaned;
}

const text = (value: unknown) =>
  typeof value === "string" && value.trim() ? value : null;

export function describeFailure(
  error: unknown,
  rpcHost: string,
): ConnectionDiagnostics {
  const snapshot = error instanceof SnapshotError ? error : null;
  // Checks this app wrote carry no underlying error. Their text holds only public contract
  // values read from public storage, and it must stay exact to be useful for a review.
  const authored = snapshot !== null && snapshot.cause === undefined;
  const source = snapshot && !authored ? snapshot.cause : error;
  const chain = causeChain(source);
  const outer = chain[0] ?? {};
  const shortMessage =
    text(outer.shortMessage) ?? text(outer.message) ?? "No message was given.";
  // viem uses -1 as its own "unknown" placeholder, wrapping the code the RPC really sent.
  const firstNumber = (field: "code" | "status") => {
    const hit = chain.find(
      (item) => typeof item[field] === "number" && item[field] !== -1,
    );
    return hit ? (hit[field] as number) : null;
  };
  const deepest = [...chain]
    .reverse()
    .find((item) => text(item.details) ?? text(item.message));
  const causeText = deepest
    ? (text(deepest.details) ?? text(deepest.message))
    : null;
  const causeName = deepest ? text(deepest.name) : null;
  const cause =
    authored || !causeText
      ? null
      : sanitizeDetail(
          causeName && !causeText.startsWith(causeName)
            ? `${causeName}: ${causeText}`
            : causeText,
        );
  return {
    stage: snapshot?.stage ?? "local save",
    kind: snapshot?.kind ?? "local",
    rpcHost,
    errorName:
      authored && snapshot.kind === "deployment"
        ? "DeploymentMismatchError"
        : authored && snapshot.kind === "consistency"
          ? "ChainConsistencyError"
          : (text(outer.name) ?? "Error"),
    shortMessage: authored ? shortMessage : sanitizeDetail(shortMessage),
    cause,
    rpcCode: firstNumber("code"),
    httpStatus: firstNumber("status"),
  };
}

export function failureNote(
  report: ConnectionDiagnostics,
  message: string,
): string {
  if (report.kind === "rpc")
    return `Unable to read Sepolia through ${report.rpcHost}. This is an RPC or network failure, not a deployment change. Progress is saved; energy accrual is paused until a read succeeds.`;
  if (report.kind === "deployment")
    return "The live Squeekchain deployment does not match the official record. Connected mode stays off until the change is reviewed. Progress is saved; energy accrual is paused.";
  return message;
}
