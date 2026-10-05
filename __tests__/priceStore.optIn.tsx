jest.mock('@app/walletBackend', () => ({
  __esModule: true,
  fetchSwmPrice: jest.fn(),
}));

import 'react-native';
import type { ZecPriceType } from '@app/AppState';
import {
  mockMainnetInfo,
  swmFailed,
  swmOk,
} from '../__mocks__/dataMocks/mockSwmPrice';
import type { AppStateStatus } from 'react-native';
import React from 'react';
import { render } from '@testing-library/react-native';
import PriceFetcher, { PriceTrafficDriver } from '@ui/widgets/PriceFetcher';
import {
  PRICE_REFRESH_MAX_MS,
  priceFetcherStore,
} from '@ui/widgets/priceFetcherStore';
import {
  ContextAppLoadedProvider,
  defaultAppContextLoaded,
} from '@app/context';
import { ChainNameEnum, CurrencyEnum, SelectServerEnum } from '@app/AppState';
import { fetchSwmPrice, SwmPriceOutcome } from '@app/walletBackend';

const price = fetchSwmPrice as jest.MockedFunction<typeof fetchSwmPrice>;

type Ctx = typeof defaultAppContextLoaded;
const makeCtx = (over?: Partial<Ctx>): Ctx => ({
  ...defaultAppContextLoaded,
  translate: (k: string) => k,
  zecPrice: { zecPrice: 0, date: 0 },
  info: mockMainnetInfo,
  selectServer: SelectServerEnum.auto,
  showSwmPrice: true,
  ...over,
});

const surfaceUi = (ctx: Ctx, setZecPrice: (p: ZecPriceType) => void) => (
  <ContextAppLoadedProvider value={{ ...ctx, setZecPrice }}>
    <PriceTrafficDriver />
    <PriceFetcher />
  </ContextAppLoadedProvider>
);

const driverOnlyUi = (ctx: Ctx, setZecPrice: (p: ZecPriceType) => void) => (
  <ContextAppLoadedProvider value={{ ...ctx, setZecPrice }}>
    <PriceTrafficDriver />
  </ContextAppLoadedProvider>
);

const appStateHandlers: Array<(next: AppStateStatus) => void> = [];

beforeAll(() => {
  const RN: typeof import('react-native') = require('react-native');
  jest
    .spyOn(RN.AppState, 'addEventListener')
    .mockImplementation((event, handler) => {
      if (event === 'change') {
        appStateHandlers.push(handler);
      }
      return { remove: jest.fn() };
    });
});

const fireAppState = (next: AppStateStatus) => {
  [...appStateHandlers].forEach(h => h(next));
};

beforeEach(() => {
  price.mockReset();
  priceFetcherStore.resetForTests();
});

afterEach(() => {
  jest.useRealTimers();
});

test('a ZEC-display wallet still fetches every tick', async () => {
  jest.useFakeTimers();
  price.mockResolvedValue(swmOk(42));
  const setZecPrice = jest.fn();

  render(
    driverOnlyUi(makeCtx({ currency: CurrencyEnum.noCurrency }), setZecPrice),
  );
  await jest.advanceTimersByTimeAsync(0);
  expect(price).toHaveBeenCalledTimes(1);

  await jest.advanceTimersByTimeAsync(PRICE_REFRESH_MAX_MS + 1_000);
  expect(price.mock.calls.length).toBeGreaterThanOrEqual(2);
});

test('a full ring always means a refresh really is due', async () => {
  jest.useFakeTimers();
  price.mockResolvedValue(swmOk(42));
  const setZecPrice = jest.fn();

  render(surfaceUi(makeCtx(), setZecPrice));
  await jest.advanceTimersByTimeAsync(0);
  expect(price).toHaveBeenCalledTimes(1);
  const keyAtSuccess = priceFetcherStore.snapshot().nextFetchAt;
  expect(keyAtSuccess).toBeGreaterThan(0);

  await jest.advanceTimersByTimeAsync(2_000);
  fireAppState('background');
  fireAppState('active');
  await jest.advanceTimersByTimeAsync(1_000);
  priceFetcherStore.foregroundReturned();
  const rearmed = priceFetcherStore.snapshot();
  expect(rearmed.nextFetchAt).not.toBe(keyAtSuccess);
  expect(rearmed.nextFetchAt).toBe(Date.now() + rearmed.nextFetchDelayMs);
});

test('a return parked on a flight still arms the hop rate bound', async () => {
  jest.useFakeTimers();
  let land: (v: SwmPriceOutcome) => void = () => {};
  price
    .mockImplementationOnce(
      () =>
        new Promise(resolve => {
          land = resolve;
        }),
    )
    .mockResolvedValue(swmFailed());
  const setZecPrice = jest.fn();

  render(surfaceUi(makeCtx(), setZecPrice));
  await jest.advanceTimersByTimeAsync(0);
  expect(price).toHaveBeenCalledTimes(1);

  fireAppState('background');
  fireAppState('active');
  priceFetcherStore.foregroundReturned();

  land(swmFailed());
  await jest.advanceTimersByTimeAsync(0);
  expect(price).toHaveBeenCalledTimes(4);

  fireAppState('background');
  fireAppState('active');
  priceFetcherStore.foregroundReturned();
  await jest.advanceTimersByTimeAsync(0);
  expect(price).toHaveBeenCalledTimes(4);
});

const GATES: readonly {
  chainName: ChainNameEnum;
  selectServer: SelectServerEnum;
  showSwmPrice: boolean;
  fetches: boolean;
}[] = [
  {
    chainName: ChainNameEnum.swarmMainnetChainName,
    selectServer: SelectServerEnum.auto,
    showSwmPrice: true,
    fetches: true,
  },
  {
    chainName: ChainNameEnum.swarmMainnetChainName,
    selectServer: SelectServerEnum.auto,
    showSwmPrice: false,
    fetches: false,
  },
  {
    chainName: ChainNameEnum.swarmMainnetChainName,
    selectServer: SelectServerEnum.offline,
    showSwmPrice: true,
    fetches: false,
  },
  {
    chainName: ChainNameEnum.swarmChainName,
    selectServer: SelectServerEnum.auto,
    showSwmPrice: true,
    fetches: false,
  },
  {
    chainName: ChainNameEnum.mainChainName,
    selectServer: SelectServerEnum.auto,
    showSwmPrice: true,
    fetches: false,
  },
];

test('only SWARM Mainnet with the setting on and a server fetches, the Nym toggle notwithstanding', async () => {
  for (const nym of [true, false]) {
    for (const gate of GATES) {
      jest.useFakeTimers();
      price.mockReset();
      price.mockResolvedValue(swmOk(42));
      priceFetcherStore.resetForTests();
      const setZecPrice = jest.fn();

      const view = render(
        surfaceUi(
          makeCtx({
            nym,
            info: { ...mockMainnetInfo, chainName: gate.chainName },
            selectServer: gate.selectServer,
            showSwmPrice: gate.showSwmPrice,
          }),
          setZecPrice,
        ),
      );
      await jest.advanceTimersByTimeAsync(0);

      expect(price.mock.calls.length > 0).toBe(gate.fetches);
      view.unmount();
      jest.useRealTimers();
    }
  }
});

test('a re-render behind the closed gate emits no traffic', async () => {
  jest.useFakeTimers();
  price.mockResolvedValue(swmOk(42));
  const setZecPrice = jest.fn();

  const view = render(surfaceUi(makeCtx(), setZecPrice));
  await jest.advanceTimersByTimeAsync(0);
  expect(price).toHaveBeenCalledTimes(1);
  const priceDate = Date.now();

  await jest.advanceTimersByTimeAsync(2_000);
  fireAppState('background');
  await jest.advanceTimersByTimeAsync(120_000);
  fireAppState('active');

  view.rerender(
    surfaceUi(
      makeCtx({ zecPrice: { zecPrice: 42, date: priceDate } }),
      setZecPrice,
    ),
  );
  await jest.advanceTimersByTimeAsync(0);
  expect(price).toHaveBeenCalledTimes(1);

  priceFetcherStore.foregroundReturned();
  await jest.advanceTimersByTimeAsync(0);
  expect(price).toHaveBeenCalledTimes(2);
});
