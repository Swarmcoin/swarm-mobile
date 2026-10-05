import type {
  SwmPool,
  SwmPriceSource,
} from '@app/walletBackend/modules/SwmPriceService';

/** The coin's USD price as the header and the screens read it, `date` 0 meaning none. */
export default interface ZecPriceType {
  zecPrice: number;
  date: number;
  changePct24h?: number;
  sparklineUsd?: number[];
  source?: SwmPriceSource;
  generatedUnix?: number;
  relayStale?: boolean;
  restored?: boolean;
  pool?: SwmPool;
}
