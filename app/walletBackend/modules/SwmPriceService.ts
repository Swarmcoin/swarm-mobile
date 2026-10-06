/** Reads the SWM/USD price from the fixed SWARM price service URL, sending no wallet data. */
import { ErrorKeyed, errorKeyed } from '@app/AppState/types/Result';

export const SWM_PRICE_URL = 'https://wallet.swarm.green/api/price/swm';
export const SWM_PRICE_TIMEOUT_MS = 8_000;
export const SWM_PRICE_MAX_CHARS = 64 * 1024;
const HOURLY_CLOSES = 48;
const DAILY_CLOSES = 30;
const HOUR = 3600;
const DAY = 86400;

const DECIMAL = /^\d{1,12}(\.\d{1,18})?$/;
const POOL_ID = /^0x[0-9a-f]{64}$/i;
const SLUG = /^[a-z0-9-]{1,32}$/;

export type SwmPriceErrorKey =
  | 'price.error-timeout'
  | 'price.error-network'
  | 'price.error-response'
  | 'price.error-unavailable';

/**
 * The service's readings in its order of trust (specs/PRICE-DISPLAY.md 2.2):
 * `pool` is the pool's own price read on chain, then the two aggregators.
 */
export type SwmPriceSource = 'pool' | 'dexscreener' | 'geckoterminal';

export type SwmPool = {
  chain: string;
  dex: string;
  id: string;
  feePct?: number;
  createdUnix?: number;
};

export type SwmSourceReading = {
  id: SwmPriceSource;
  ok: boolean;
  priceUsd?: number;
};

export type SwmPriceDetails = {
  priceEth?: number;
  changePct1h?: number;
  changePct6h?: number;
  hourlyFromUnix?: number;
  hourlyEndsLive: boolean;
  dailyUsd?: number[];
  dailyFromUnix?: number;
  dailyEndsLive: boolean;
  transactions24h?: { buys: number; sells: number };
  liquidityUsd?: number;
  volume24hUsd?: number;
  fdvUsd?: number;
  sources: SwmSourceReading[];
};

export type SwmPriceReading = {
  priceUsd: number;
  changePct24h?: number;
  sparklineUsd?: number[];
  source?: SwmPriceSource;
  generatedUnix: number;
  stale: boolean;
  pool?: SwmPool;
  details: SwmPriceDetails;
};

export type SwmPriceOutcome =
  { kind: 'swmPrice'; reading: SwmPriceReading } | ErrorKeyed<SwmPriceErrorKey>;

type Json = { [key: string]: unknown };

const isObject = (node: unknown): node is Json =>
  typeof node === 'object' && !!node && !Array.isArray(node);

const finite = (n: unknown): n is number =>
  typeof n === 'number' && Number.isFinite(n);

const sourceOf = (id: unknown): SwmPriceSource | undefined =>
  id === 'pool' || id === 'dexscreener' || id === 'geckoterminal'
    ? id
    : undefined;

const seriesOf = (points: unknown, max: number): number[] | undefined => {
  if (!Array.isArray(points) || points.length < 2) {
    return undefined;
  }
  if (!points.every(p => finite(p) && p > 0)) {
    return undefined;
  }
  return points.slice(-max);
};

const amountOf = (n: unknown): number | undefined =>
  finite(n) && n >= 0 ? n : undefined;

const unixOf = (n: unknown): number | undefined =>
  finite(n) && n > 0 ? n : undefined;

const countOf = (n: unknown): number | undefined =>
  Number.isInteger(n) && finite(n) && n >= 0 ? n : undefined;

const decimalOf = (text: unknown): number | undefined =>
  typeof text === 'string' && DECIMAL.test(text) && Number(text) > 0
    ? Number(text)
    : undefined;

const transactionsOf = (
  node: unknown,
): { buys: number; sells: number } | undefined => {
  if (!isObject(node)) {
    return undefined;
  }
  const buys = countOf(node.buys);
  const sells = countOf(node.sells);
  return buys === undefined || sells === undefined
    ? undefined
    : { buys, sells };
};

const sourcesOf = (nodes: unknown): SwmSourceReading[] =>
  Array.isArray(nodes)
    ? nodes.flatMap(node => {
        const id = isObject(node) ? sourceOf(node.id) : undefined;
        if (!isObject(node) || !id) {
          return [];
        }
        const ok = node.ok === true;
        return [
          { id, ok, priceUsd: ok ? decimalOf(node.price_usd) : undefined },
        ];
      })
    : [];

const hourlyClosesOf = (doc: Json): number =>
  Math.min(countOf(doc.sparkline_hours) || HOURLY_CLOSES, HOURLY_CLOSES);

const trimmedOf = (points: unknown, max: number): number =>
  Array.isArray(points) ? Math.max(points.length - max, 0) : 0;

const shifted = (
  from: number | undefined,
  trimmed: number,
  step: number,
): number | undefined =>
  from === undefined ? undefined : from + trimmed * step;

const detailsOf = (doc: Json): SwmPriceDetails => {
  const change = isObject(doc.change_pct) ? doc.change_pct : {};
  const hourlyCloses = hourlyClosesOf(doc);
  const hourly = seriesOf(doc.sparkline_usd, hourlyCloses + 1);
  const daily = seriesOf(doc.daily_usd, DAILY_CLOSES + 1);
  return {
    priceEth: decimalOf(doc.price_eth),
    changePct1h: finite(change.h1) ? change.h1 : undefined,
    changePct6h: finite(change.h6) ? change.h6 : undefined,
    hourlyFromUnix: shifted(
      unixOf(doc.hourly_from_unix),
      trimmedOf(doc.sparkline_usd, hourlyCloses + 1),
      HOUR,
    ),
    hourlyEndsLive: hourly?.length === hourlyCloses + 1,
    dailyUsd: daily,
    dailyFromUnix: shifted(
      unixOf(doc.daily_from_unix),
      trimmedOf(doc.daily_usd, DAILY_CLOSES + 1),
      DAY,
    ),
    dailyEndsLive: daily?.length === DAILY_CLOSES + 1,
    transactions24h: transactionsOf(doc.transactions_24h),
    liquidityUsd: amountOf(doc.liquidity_usd),
    volume24hUsd: amountOf(doc.volume_24h_usd),
    fdvUsd: amountOf(doc.fdv_usd),
    sources: sourcesOf(doc.sources),
  };
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
  return {
    chain: pool.chain,
    dex: pool.dex,
    id: pool.id.toLowerCase(),
    feePct:
      finite(pool.fee_pct) && pool.fee_pct >= 0 && pool.fee_pct < 100
        ? pool.fee_pct
        : undefined,
    createdUnix: unixOf(pool.created_unix),
  };
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
      sparklineUsd: seriesOf(doc.sparkline_usd, hourlyClosesOf(doc) + 1),
      source: sourceOf(doc.source),
      generatedUnix: doc.generated_unix,
      stale: doc.stale === true,
      pool: poolOf(doc.pool),
      details: detailsOf(doc),
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
