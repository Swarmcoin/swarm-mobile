import AsyncStorage from '@react-native-async-storage/async-storage';
import ZecPriceType from '@app/AppState/types/ZecPriceType';
import type { SwmPool } from '@app/walletBackend/modules/SwmPriceService';

const SWM_PRICE_KEY = 'swm-price/last';

type Kept = { [field: string]: unknown };

const isKept = (node: unknown): node is Kept =>
  typeof node === 'object' && !!node && !Array.isArray(node);

const isNumbers = (node: unknown): node is number[] =>
  Array.isArray(node) && node.every(n => typeof n === 'number');

const poolOf = (node: unknown): SwmPool | undefined =>
  isKept(node) &&
  typeof node.chain === 'string' &&
  typeof node.dex === 'string' &&
  typeof node.id === 'string'
    ? {
        chain: node.chain,
        dex: node.dex,
        id: node.id,
        feePct: typeof node.feePct === 'number' ? node.feePct : undefined,
        createdUnix:
          typeof node.createdUnix === 'number' ? node.createdUnix : undefined,
      }
    : undefined;

/** Keeps the last good reading on the device, without the price page's details. */
export async function saveSwmPrice(price: ZecPriceType): Promise<void> {
  await AsyncStorage.setItem(
    SWM_PRICE_KEY,
    JSON.stringify({ ...price, details: undefined, restored: false }),
  );
}

/** The last good reading, marked restored, or undefined when none was kept. */
export async function loadSwmPrice(): Promise<ZecPriceType | undefined> {
  const raw: unknown = await AsyncStorage.getItem(SWM_PRICE_KEY);
  if (typeof raw !== 'string') {
    return undefined;
  }
  let kept: unknown;
  try {
    kept = JSON.parse(raw);
  } catch {
    return undefined;
  }
  if (
    !isKept(kept) ||
    typeof kept.zecPrice !== 'number' ||
    typeof kept.date !== 'number' ||
    !(kept.zecPrice > 0) ||
    !(kept.date > 0)
  ) {
    return undefined;
  }
  return {
    zecPrice: kept.zecPrice,
    date: kept.date,
    changePct24h:
      typeof kept.changePct24h === 'number' ? kept.changePct24h : undefined,
    sparklineUsd: isNumbers(kept.sparklineUsd) ? kept.sparklineUsd : undefined,
    source:
      kept.source === 'pool' ||
      kept.source === 'dexscreener' ||
      kept.source === 'geckoterminal'
        ? kept.source
        : undefined,
    generatedUnix:
      typeof kept.generatedUnix === 'number' ? kept.generatedUnix : undefined,
    relayStale: kept.relayStale === true,
    pool: poolOf(kept.pool),
    restored: true,
  };
}
