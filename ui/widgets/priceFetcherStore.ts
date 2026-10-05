import { useEffect, useReducer, useSyncExternalStore } from 'react';
import { AppState, NativeEventSubscription } from 'react-native';
import {
  fetchSwmPrice,
  SwmPriceErrorKey,
  SwmPriceOutcome,
  SwmPriceReading,
} from '@app/walletBackend';
import { errorKeyed } from '@app/AppState/types/Result';
import ZecPriceType from '@app/AppState/types/ZecPriceType';
import { loadSwmPrice, saveSwmPrice } from '@app/services/swmPriceCache';

export const PRICE_REFRESH_MIN_MS = 55_000;
export const PRICE_REFRESH_MAX_MS = 65_000;
const PRICE_FETCH_TIMEOUT_MS = 10_000;
export const PRICE_FRESH_MS = 5 * 60_000;
export const PRICE_AGEING_MS = 30 * 60_000;
export const PRICE_UNAVAILABLE_MS = 60 * 60_000;
export const PRICE_STALE_MS = PRICE_FRESH_MS;
const FETCH_BURST_COOLDOWN_MS = 5_000;
const FLIGHT_TTL_MS = 2 * PRICE_REFRESH_MAX_MS;

type PriceInputs = {
  setZecPrice: (price: ZecPriceType) => void;
  priceFetchable: boolean;
};

type PriceSurfaceSnapshot = {
  loading: boolean;
  nextFetchAt: number;
  nextFetchDelayMs: number;
  surfaceActive: boolean;
  lastErrorKey: SwmPriceErrorKey | undefined;
};

type Cadence =
  | { state: 'idle' }
  | {
      state: 'armed';
      timer: ReturnType<typeof setTimeout>;
      deadline: number;
      delayMs: number;
    }
  | { state: 'due'; deadline: number; delayMs: number };

type Flight =
  | { state: 'none' }
  | {
      state: 'inFlight';
      call: Promise<SwmPriceOutcome>;
      startedAt: number;
    };

let loading = false;
let entryPending = false;
let deps: PriceInputs | undefined;
let cadence: Cadence = { state: 'idle' };
let attachCount = 0;
let sessionEpoch = 0;
let appStateSub: NativeEventSubscription | undefined;
let appAway = false;
let lastFetchStartAt = 0;
let lastSuccessAt = 0;
let lastReturnFetchAt = 0;
let lastErrorKey: SwmPriceErrorKey | undefined;
let flight: Flight = { state: 'none' };
const listeners = new Set<() => void>();

let snapshotCache: PriceSurfaceSnapshot = {
  loading: false,
  nextFetchAt: 0,
  nextFetchDelayMs: 0,
  surfaceActive: false,
  lastErrorKey: undefined,
};

function emit(): void {
  for (const l of listeners) l();
}

function clearAuto(): void {
  if (cadence.state === 'armed') {
    clearTimeout(cadence.timer);
  }
  cadence = { state: 'idle' };
  emit();
}

function surfaceMayFetch(): boolean {
  return (
    deps !== undefined && deps.priceFetchable && attachCount > 0 && !appAway
  );
}

function scheduleAuto(): void {
  clearAuto();
  if (!surfaceMayFetch()) return;
  const delayMs = Math.round(
    PRICE_REFRESH_MIN_MS +
      Math.random() * (PRICE_REFRESH_MAX_MS - PRICE_REFRESH_MIN_MS),
  );
  const deadline = Date.now() + delayMs;
  cadence = {
    state: 'armed',
    deadline,
    delayMs,
    timer: setTimeout(() => {
      cadence = { state: 'due', deadline, delayMs };
      doFetch().catch(() => {});
    }, delayMs),
  };
  emit();
}

// A wedged request is reused until its TTL, then replaced.
function startFlight(): Promise<SwmPriceOutcome> {
  if (
    flight.state === 'inFlight' &&
    Date.now() - flight.startedAt <= FLIGHT_TTL_MS
  ) {
    return flight.call;
  }
  const launched: Promise<SwmPriceOutcome> = fetchSwmPrice().finally(() => {
    if (flight.state === 'inFlight' && flight.call === launched) {
      flight = { state: 'none' };
    }
  });
  flight = { state: 'inFlight', call: launched, startedAt: Date.now() };
  return launched;
}

async function boundedPrice(): Promise<SwmPriceOutcome> {
  let bound: ReturnType<typeof setTimeout> | undefined;
  const expiry = new Promise<SwmPriceOutcome>(resolve => {
    bound = setTimeout(
      () => resolve(errorKeyed('price.error-timeout')),
      PRICE_FETCH_TIMEOUT_MS,
    );
  });
  try {
    return await Promise.race([startFlight(), expiry]);
  } catch {
    return errorKeyed('price.error-network');
  } finally {
    clearTimeout(bound);
  }
}

/** The display record of one relay reading taken at `date`. */
export function priceFromReading(
  reading: SwmPriceReading,
  date: number,
): ZecPriceType {
  return {
    zecPrice: reading.priceUsd,
    date,
    changePct24h: reading.changePct24h,
    sparklineUsd: reading.sparklineUsd,
    source: reading.source,
    generatedUnix: reading.generatedUnix,
    relayStale: reading.stale,
    pool: reading.pool,
    details: reading.details,
    restored: false,
  };
}

const retriable = (outcome: SwmPriceOutcome): boolean =>
  outcome.kind === 'error' && outcome.errorKey === 'price.error-network';

async function doFetch(): Promise<void> {
  if (loading || !surfaceMayFetch() || !deps) {
    return;
  }
  const d = deps;
  const epoch = sessionEpoch;

  loading = true;
  lastFetchStartAt = Date.now();
  emit();
  try {
    let outcome = await boundedPrice();
    if (retriable(outcome) && epoch === sessionEpoch && surfaceMayFetch()) {
      outcome = await boundedPrice();
    }

    if (epoch !== sessionEpoch) {
      return;
    }
    if (outcome.kind === 'swmPrice') {
      entryPending = false;
      lastSuccessAt = Date.now();
      lastErrorKey = undefined;
      const price = priceFromReading(outcome.reading, lastSuccessAt);
      d.setZecPrice(price);
      saveSwmPrice(price).catch(() => {});
    } else {
      lastErrorKey = outcome.errorKey;
    }
  } finally {
    if (epoch === sessionEpoch) {
      loading = false;
      scheduleAuto();
      emit();
      if (entryPending) {
        entryPending = false;
        if (surfaceMayFetch() && deps) {
          lastReturnFetchAt = Date.now();
          doFetch().catch(() => {});
        }
      }
    }
  }
}

function entryOrSchedule(): void {
  if (!surfaceMayFetch() || loading || cadence.state === 'armed') {
    return;
  }
  if (
    Date.now() - lastFetchStartAt < FETCH_BURST_COOLDOWN_MS ||
    Date.now() - lastSuccessAt < PRICE_REFRESH_MIN_MS
  ) {
    scheduleAuto();
  } else {
    doFetch().catch(() => {});
  }
}

// The kept reading shows, greyed, until the first fresh read replaces it.
function restoreKept(epoch: number): void {
  loadSwmPrice()
    .then(kept => {
      if (kept && epoch === sessionEpoch && lastSuccessAt === 0 && deps) {
        deps.setZecPrice(kept);
      }
    })
    .catch(() => {});
}

// Only foregroundReturned ends the pause, because 'active' can be a locked wallet.
function onAppStateChange(next: string): void {
  if (next === 'background') {
    appAway = true;
    entryPending = false;
    clearAuto();
  }
}

export const priceFetcherStore = {
  setDeps(d: PriceInputs): void {
    deps = d;
    if (!surfaceMayFetch()) {
      clearAuto();
      entryPending = false;
      return;
    }
    entryOrSchedule();
  },
  attach(): () => void {
    attachCount++;
    if (attachCount === 1) {
      appAway = AppState.currentState === 'background';
      appStateSub = AppState.addEventListener('change', onAppStateChange);
      restoreKept(sessionEpoch);
      entryOrSchedule();
    }
    return () => {
      attachCount--;
      if (attachCount === 0) {
        sessionEpoch++;
        appStateSub?.remove();
        appStateSub = undefined;
        entryPending = false;
        loading = false;
        lastFetchStartAt = 0;
        lastSuccessAt = 0;
        lastReturnFetchAt = 0;
        lastErrorKey = undefined;
        flight = { state: 'none' };
        deps = undefined;
        clearAuto();
      }
    };
  },
  foregroundReturned(): void {
    appAway = false;
    emit();
    if (!surfaceMayFetch()) return;
    if (loading) {
      entryPending = true;
    } else if (
      Date.now() - lastSuccessAt < FETCH_BURST_COOLDOWN_MS ||
      Date.now() - lastReturnFetchAt < FETCH_BURST_COOLDOWN_MS
    ) {
      if (cadence.state !== 'armed') {
        scheduleAuto();
      }
    } else {
      lastReturnFetchAt = Date.now();
      doFetch().catch(() => {});
    }
  },
  snapshot(): PriceSurfaceSnapshot {
    const next: PriceSurfaceSnapshot = {
      loading,
      nextFetchAt: cadence.state === 'idle' ? 0 : cadence.deadline,
      nextFetchDelayMs: cadence.state === 'idle' ? 0 : cadence.delayMs,
      surfaceActive: surfaceMayFetch(),
      lastErrorKey,
    };
    if (
      next.loading !== snapshotCache.loading ||
      next.nextFetchAt !== snapshotCache.nextFetchAt ||
      next.nextFetchDelayMs !== snapshotCache.nextFetchDelayMs ||
      next.surfaceActive !== snapshotCache.surfaceActive ||
      next.lastErrorKey !== snapshotCache.lastErrorKey
    ) {
      snapshotCache = next;
    }
    return snapshotCache;
  },
  resetForTests(): void {
    lastFetchStartAt = 0;
    lastSuccessAt = 0;
    lastReturnFetchAt = 0;
    lastErrorKey = undefined;
    entryPending = false;
    flight = { state: 'none' };
    loading = false;
    clearAuto();
  },
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

export function usePriceFetcherStore(): PriceSurfaceSnapshot {
  return useSyncExternalStore(
    priceFetcherStore.subscribe,
    priceFetcherStore.snapshot,
  );
}

export function usePriceStale(priceDate: number): boolean {
  const [, force] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    if (priceDate <= 0) {
      return;
    }
    const untilStale = priceDate + PRICE_STALE_MS - Date.now();
    if (untilStale <= 0) {
      return;
    }
    const timer = setTimeout(force, untilStale + 50);
    return () => clearTimeout(timer);
  }, [priceDate]);
  return priceDate > 0 && Date.now() - priceDate > PRICE_STALE_MS;
}

export type PriceHealth = 'live' | 'stale' | 'absent';

// An omitted date is a historical conversion and reads live.
export function usePriceHealth(priceDate: number | undefined): PriceHealth {
  const stale = usePriceStale(priceDate ?? 0);
  if (priceDate === 0) {
    return 'absent';
  }
  return stale ? 'stale' : 'live';
}

export type PriceFreshness =
  'fresh' | 'ageing' | 'stale' | 'unavailable' | 'absent';

/** Where a reading sits on the fresh, ageing, stale and unavailable scale at `now`. */
export function priceFreshness(
  price: ZecPriceType,
  now: number,
): PriceFreshness {
  if (price.date <= 0 || price.zecPrice <= 0) {
    return 'absent';
  }
  const age = now - price.date;
  if (age > PRICE_UNAVAILABLE_MS) {
    return 'unavailable';
  }
  if (age > PRICE_AGEING_MS || price.relayStale) {
    return 'stale';
  }
  if (age > PRICE_FRESH_MS || price.restored) {
    return 'ageing';
  }
  return 'fresh';
}

const FRESHNESS_EDGES_MS = [
  PRICE_FRESH_MS,
  PRICE_AGEING_MS,
  PRICE_UNAVAILABLE_MS,
];

export function usePriceFreshness(price: ZecPriceType): PriceFreshness {
  const [tick, force] = useReducer((n: number) => n + 1, 0);
  const { date } = price;
  useEffect(() => {
    if (date <= 0) {
      return;
    }
    const untilEdge = FRESHNESS_EDGES_MS.map(
      edge => date + edge - Date.now(),
    ).find(ms => ms > 0);
    if (untilEdge === undefined) {
      return;
    }
    const timer = setTimeout(force, untilEdge + 50);
    return () => clearTimeout(timer);
  }, [date, tick]);
  return priceFreshness(price, Date.now());
}
