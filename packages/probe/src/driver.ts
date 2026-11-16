import { chromium } from "playwright";
import { EVENT_PREFIX, type ProbeEvent, type ProbeRequest, type Sample } from "./protocol.js";
import { servePage } from "./server.js";

export interface ProbeOptions {
  request: ProbeRequest;
  /** Stop after this long, whatever happens. */
  durationMs: number;
  /** Host patterns the browser cannot resolve, e.g. "*.ckb.guide". */
  block?: string[];
  /** When set, the browser resolves only these hosts and nothing else. */
  only?: string[];
  /** Hosts to resolve to a fixed address, e.g. { "a.lifeline.test": "127.0.0.1" }. */
  map?: Record<string, string>;
  /** Accept certificates no public authority signed (the local devnet). */
  insecureTls?: boolean;
  /** Stop early once this returns true. */
  done?: (events: readonly ProbeEvent[]) => boolean;
  headless?: boolean;
}

export interface ProbeResult {
  events: ProbeEvent[];
  samples: Sample[];
  /** Browser console lines that were not probe events, for diagnosis. */
  log: string[];
  durationMs: number;
}

/**
 * Chromium's --host-resolver-rules: the browser's own DNS, so that "this
 * domain is down" can be tested without touching the computer's resolver.
 */
export function hostResolverRules(opts: Pick<ProbeOptions, "block" | "only" | "map">): string {
  const rules: string[] = [];
  for (const [host, address] of Object.entries(opts.map ?? {})) rules.push(`MAP ${host} ${address}`);
  for (const pattern of opts.block ?? []) rules.push(`MAP ${pattern} ~NOTFOUND`);
  if (opts.only) {
    rules.push("MAP * ~NOTFOUND");
    for (const host of [...opts.only, "localhost", "127.0.0.1"]) rules.push(`EXCLUDE ${host}`);
  }
  return rules.join(", ");
}

/** Starts a fresh browser (fresh storage, no remembered peers) and runs one probe. */
export async function runProbe(opts: ProbeOptions): Promise<ProbeResult> {
  const page = await servePage();
  const rules = hostResolverRules(opts);
  const browser = await chromium.launch({
    headless: opts.headless ?? true,
    channel: process.env.LIFELINE_CHROME_CHANNEL || undefined,
    args: rules ? [`--host-resolver-rules=${rules}`] : [],
  });
  const events: ProbeEvent[] = [];
  const log: string[] = [];
  const started = Date.now();
  try {
    const context = await browser.newContext({ ignoreHTTPSErrors: opts.insecureTls ?? false });
    const tab = await context.newPage();
    let finished: () => void = () => {};
    const done = new Promise<void>((resolve) => (finished = resolve));

    tab.on("console", (message) => {
      const text = message.text();
      if (text.startsWith(EVENT_PREFIX)) {
        events.push(JSON.parse(text.slice(EVENT_PREFIX.length)) as ProbeEvent);
        if (opts.done?.(events)) finished();
      } else if (log.length < 200) {
        log.push(`${message.type()}: ${text}`);
      }
    });
    tab.on("pageerror", (error) => log.push(`pageerror: ${error.message}`));

    await tab.addInitScript((request) => {
      (window as unknown as { __LIFELINE_REQUEST__: unknown }).__LIFELINE_REQUEST__ = request;
    }, opts.request);
    await tab.goto(page.url);

    const timer = setTimeout(finished, opts.durationMs);
    await done;
    clearTimeout(timer);
    await context.close();
  } finally {
    await browser.close();
    await page.close();
  }
  const samples = events.flatMap((e) => (e.kind === "sample" ? [e.sample] : []));
  return { events, samples, log, durationMs: Date.now() - started };
}
