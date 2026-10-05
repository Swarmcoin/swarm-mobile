/** Reads the indicative SWM/USD price from the fixed SWARM price service URL, sending no wallet data. */
import { ErrorKeyed, errorKeyed } from '@app/AppState/types/Result';

export const SWM_PRICE_URL = 'https://wallet.swarm.green/api/price/swm';
export const SWM_PRICE_TIMEOUT_MS = 8_000;
export const SWM_PRICE_MAX_CHARS = 64 * 1024;
const SPARKLINE_MAX_POINTS = 48;

const DECIMAL = /^\d{1,12}(\.\d{1,18})?$/;
const POOL_ID = /^0x[0-9a-f]{64}$/i;
const SLUG = /^[a-z0-9-]{1,32}$/;

export type SwmPriceErrorKey =
  | 'price.error-timeout'
  | 'price.error-network'
  | 'price.error-response'
  | 'price.error-unavailable';

export type SwmPriceSource = 'geckoterminal' | 'dexscreener';

export type SwmPool = {
  chain: string;
  dex: string;
  id: string;
};

export type SwmPriceReading = {
  priceUsd: number;
  changePct24h?: number;
  sparklineUsd?: number[];
  source?: SwmPriceSource;
  generatedUnix: number;
  stale: boolean;
  pool?: SwmPool;
};

export type SwmPriceOutcome =
  { kind: 'swmPrice'; reading: SwmPriceReading } | ErrorKeyed<SwmPriceErrorKey>;

type Json = { [key: string]: unknown };

const isObject = (node: unknown): node is Json =>
  typeof node === 'object' && !!node && !Array.isArray(node);

const finite = (n: unknown): n is number =>
  typeof n === 'number' && Number.isFinite(n);

const sourceOf = (id: unknown): SwmPriceSource | undefined =>
  id === 'geckoterminal' || id === 'dexscreener' ? id : undefined;

const sparklineOf = (points: unknown): number[] | undefined => {
  if (!Array.isArray(points) || points.length < 2) {
    return undefined;
  }
  if (!points.every(p => finite(p) && p > 0)) {
    return undefined;
  }
  return points.slice(-SPARKLINE_MAX_POINTS);
};

const poolOf = (pool: unknown): SwmPool | undefined => {
  if (
    !isObject(pool) ||
    typeof pool.id !== 'string' ||
    !POOL_ID.test(pool.id) ||
    typeof pool.chain !== 'string' ||
    !SLUG.test(pool.chain) ||
    typeof pool.dex !== 'string' ||
    !SLUG.test(pool.dex)
  ) {
    return undefined;
  }
  return { chain: pool.chain, dex: pool.dex, id: pool.id.toLowerCase() };
};

/** Parses one relay body into a reading, or the key of what is wrong with it. */
export function parseSwmPrice(body: string): SwmPriceOutcome {
  let doc: unknown;
  try {
    doc = JSON.parse(body);
  } catch {
    return errorKeyed('price.error-response');
  }
  if (!isObject(doc) || doc.schema !== 'swarm-price/1') {
    return errorKeyed('price.error-response');
  }
  if (doc.error === 'unavailable') {
    return errorKeyed('price.error-unavailable');
  }
  if (
    doc.symbol !== 'SWM' ||
    doc.quote !== 'USD' ||
    typeof doc.price_usd !== 'string' ||
    !DECIMAL.test(doc.price_usd) ||
    !finite(doc.generated_unix) ||
    doc.generated_unix <= 0
  ) {
    return errorKeyed('price.error-response');
  }
  const priceUsd = Number(doc.price_usd);
  if (!(priceUsd > 0)) {
    return errorKeyed('price.error-response');
  }
  const h24 = isObject(doc.change_pct) ? doc.change_pct.h24 : undefined;
  return {
    kind: 'swmPrice',
    reading: {
      priceUsd,
      changePct24h: finite(h24) ? h24 : undefined,
      sparklineUsd: sparklineOf(doc.sparkline_usd),
      source: sourceOf(doc.source),
      generatedUnix: doc.generated_unix,
      stale: doc.stale === true,
      pool: poolOf(doc.pool),
    },
  };
}

/** Fetches the current reading from the SWARM price service. */
export async function fetchSwmPrice(): Promise<SwmPriceOutcome> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SWM_PRICE_TIMEOUT_MS);
  try {
    const response = await fetch(SWM_PRICE_URL, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      credentials: 'omit',
      signal: controller.signal,
    });
    const declared = Number(response.headers.get('content-length') ?? 0);
    if (declared > SWM_PRICE_MAX_CHARS) {
      return errorKeyed('price.error-response');
    }
    const body = await response.text();
    if (body.length > SWM_PRICE_MAX_CHARS) {
      return errorKeyed('price.error-response');
    }
    if (response.status === 503) {
      const parsed = parseSwmPrice(body);
      return parsed.kind === 'error'
        ? parsed
        : errorKeyed('price.error-response');
    }
    if (response.status !== 200) {
      return errorKeyed('price.error-response');
    }
    return parseSwmPrice(body);
  } catch {
    return errorKeyed(
      controller.signal.aborted ? 'price.error-timeout' : 'price.error-network',
    );
  } finally {
    clearTimeout(timer);
  }
}
