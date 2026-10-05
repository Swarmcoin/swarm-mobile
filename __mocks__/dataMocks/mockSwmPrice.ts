import { ChainNameEnum, InfoType, ZecPriceType } from '@app/AppState';
import { errorKeyed } from '@app/AppState/types/Result';
import type {
  SwmPriceErrorKey,
  SwmPriceOutcome,
} from '@app/walletBackend/modules/SwmPriceService';
import relay from './swmPriceRelay.json';
import { mockInfo } from './mockInfo';

export const swmRelayFixture = relay;
export const swmRelayBody = JSON.stringify(relay);

export const mockMainnetInfo: InfoType = {
  ...mockInfo,
  chainName: ChainNameEnum.swarmMainnetChainName,
};

export const swmOk = (priceUsd: number): SwmPriceOutcome => ({
  kind: 'swmPrice',
  reading: {
    priceUsd,
    changePct24h: 36.72,
    sparklineUsd: [0.5259, 0.573, 0.6361, 0.6533, 0.7537, 0.8411],
    source: 'geckoterminal',
    generatedUnix: 1791223633,
    stale: false,
    pool: {
      chain: 'base',
      dex: 'uniswap-v4',
      id: '0xf1e066d77279b388b40fdca7f5cf4a6559f77bdf9e2e8937ce9c2fe2960f4599',
    },
  },
});

export const swmFailed = (
  key: SwmPriceErrorKey = 'price.error-network',
): SwmPriceOutcome => errorKeyed(key);

export const mockSwmPrice = (date: number): ZecPriceType => ({
  zecPrice: 0.84114343,
  date,
  changePct24h: 36.72,
  sparklineUsd: [0.5259, 0.573, 0.6361, 0.6533, 0.7537, 0.8411],
  source: 'geckoterminal',
  generatedUnix: 1791223633,
  relayStale: false,
  restored: false,
  pool: {
    chain: 'base',
    dex: 'uniswap-v4',
    id: '0xf1e066d77279b388b40fdca7f5cf4a6559f77bdf9e2e8937ce9c2fe2960f4599',
  },
});
