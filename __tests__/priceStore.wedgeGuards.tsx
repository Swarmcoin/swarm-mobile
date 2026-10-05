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
import { render, waitFor } from '@testing-library/react-native';
import PriceFetcher, { PriceTrafficDriver } from '@ui/widgets/PriceFetcher';
import {
  PRICE_REFRESH_MAX_MS,
  priceFetcherStore,
} from '@ui/widgets/priceFetcherStore';
import {
  ContextAppLoadedProvider,
  defaultAppContextLoaded,
} from '@app/context';
import { ChainNameEnum, SelectServerEnum } from '@app/AppState';
import { fetchSwmPrice, SwmPriceOutcome } from '@app/walletBackend';
import { mockInfo } from '../__mocks__/dataMocks/mockInfo';

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

const flush = () => new Promise(resolve => setTimeout(resolve, 0));

beforeEach(() => {
  price.mockReset();
  priceFetcherStore.resetForTests();
});

afterEach(() => {
  jest.useRealTimers();
});

test('a tick fired into a closed gate never wedges the cadence', async () => {
  jest.useFakeTimers();
  price.mockResolvedValue(swmOk(42));
  const setZecPrice = jest.fn();
  const freshDate = Date.now();

  const ctx = makeCtx({
    showSwmPrice: true,
    zecPrice: { zecPrice: 42, date: freshDate },
  });
  const view = render(surfaceUi(ctx, setZecPrice));
  await jest.advanceTimersByTimeAsync(0);
  expect(price).toHaveBeenCalledTimes(1);

  view.rerender(
    surfaceUi(
      makeCtx({
        showSwmPrice: false,
        zecPrice: { zecPrice: 42, date: freshDate },
      }),
      setZecPrice,
    ),
  );
  await jest.advanceTimersByTimeAsync(PRICE_REFRESH_MAX_MS + 1_000);
  expect(price).toHaveBeenCalledTimes(1);

  view.rerender(
    surfaceUi(
      makeCtx({
        showSwmPrice: true,
        zecPrice: { zecPrice: 42, date: freshDate },
      }),
      setZecPrice,
    ),
  );
  await jest.advanceTimersByTimeAsync(0);
  expect(price.mock.calls.length).toBeGreaterThan(1);
});

test('a wedged request retires after its TTL and a fresh one runs', async () => {
  jest.useFakeTimers();
  price
    .mockImplementationOnce(() => new Promise(() => {}))
    .mockResolvedValue(swmOk(42));
  const setZecPrice = jest.fn();

  render(surfaceUi(makeCtx(), setZecPrice));
  await jest.advanceTimersByTimeAsync(4 * (30_000 + PRICE_REFRESH_MAX_MS));

  expect(price.mock.calls.length).toBeGreaterThan(1);
  expect(setZecPrice).toHaveBeenCalledWith(
    expect.objectContaining({ zecPrice: 42 }),
  );
});

test('the bare active event arms no cadence behind the gate', async () => {
  jest.useFakeTimers();
  price.mockResolvedValue(swmOk(42));
  const setZecPrice = jest.fn();

  render(surfaceUi(makeCtx(), setZecPrice));
  await jest.advanceTimersByTimeAsync(0);
  expect(price).toHaveBeenCalledTimes(1);

  fireAppState('background');
  fireAppState('active');
  await jest.advanceTimersByTimeAsync(61_000);
  expect(price).toHaveBeenCalledTimes(1);

  priceFetcherStore.foregroundReturned();
  await jest.advanceTimersByTimeAsync(0);
  expect(price).toHaveBeenCalledTimes(2);
});

test('no market, no traffic: offline and non-mainnet fetch nothing', async () => {
  jest.useFakeTimers();
  price.mockResolvedValue(swmOk(42));
  const setZecPrice = jest.fn();

  const offline = render(
    driverOnlyUi(
      makeCtx({ selectServer: SelectServerEnum.offline }),
      setZecPrice,
    ),
  );
  await jest.advanceTimersByTimeAsync(61_000);
  expect(price).not.toHaveBeenCalled();
  offline.unmount();

  render(
    driverOnlyUi(
      makeCtx({
        info: { ...mockInfo, chainName: ChainNameEnum.testChainName },
      }),
      setZecPrice,
    ),
  );
  await jest.advanceTimersByTimeAsync(61_000);
  expect(price).not.toHaveBeenCalled();
});

test('repeated returns during a failure window are rate-bound', async () => {
  price.mockResolvedValue(swmFailed());
  const setZecPrice = jest.fn();

  render(surfaceUi(makeCtx(), setZecPrice));
  await waitFor(() => expect(price).toHaveBeenCalledTimes(2));

  fireAppState('background');
  fireAppState('active');
  priceFetcherStore.foregroundReturned();
  await waitFor(() => expect(price).toHaveBeenCalledTimes(4));

  fireAppState('background');
  fireAppState('active');
  priceFetcherStore.foregroundReturned();
  await flush();
  await flush();
  expect(price).toHaveBeenCalledTimes(4);
});

test('a mid-flight switch-off leaves no wedge for the recovery', async () => {
  jest.useFakeTimers();
  let land: (v: SwmPriceOutcome) => void = () => {};
  price
    .mockImplementationOnce(
      () =>
        new Promise(resolve => {
          land = resolve;
        }),
    )
    .mockResolvedValue(swmOk(42));
  const setZecPrice = jest.fn();

  const view = render(surfaceUi(makeCtx(), setZecPrice));
  await jest.advanceTimersByTimeAsync(0);
  expect(price).toHaveBeenCalledTimes(1);

  view.rerender(surfaceUi(makeCtx({ showSwmPrice: false }), setZecPrice));
  land(swmFailed());
  await jest.advanceTimersByTimeAsync(60_000);

  view.rerender(surfaceUi(makeCtx({ showSwmPrice: true }), setZecPrice));
  await jest.advanceTimersByTimeAsync(61_000);
  expect(setZecPrice).toHaveBeenCalledWith(
    expect.objectContaining({ zecPrice: 42 }),
  );
});
