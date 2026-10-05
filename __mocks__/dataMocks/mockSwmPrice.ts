import { ChainNameEnum, InfoType, ZecPriceType } from '@app/AppState';
import { errorKeyed } from '@app/AppState/types/Result';
import type {
  SwmPriceDetails,
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

export const mockSwmDetails: SwmPriceDetails = {
  priceEth: 0.000195976,
  changePct1h: 0,
  changePct6h: 28.75,
  hourlyFromUnix: 1791205200,
  dailyUsd: [0.3112, 0.3305, 0.4021, 0.5259, 0.6151, 0.8411],
  dailyFromUnix: 1790812800,
  transactions24h: { buys: 9, sells: 0 },
  liquidityUsd: 3761.34,
  volume24hUsd: 378.11,
  fdvUsd: 8411.43,
  sources: [
    { id: 'geckoterminal', ok: true, priceUsd: 0.84114343 },
    { id: 'dexscreener', ok: true, priceUsd: 0.8602 },
  ],
};

const mockPool = {
  chain: 'base',
  dex: 'uniswap-v4',
  id: '0xf1e066d77279b388b40fdca7f5cf4a6559f77bdf9e2e8937ce9c2fe2960f4599',
  feePct: 0.9,
  createdUnix: 1790812800,
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
    pool: mockPool,
    details: mockSwmDetails,
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
  pool: mockPool,
  details: mockSwmDetails,
});
