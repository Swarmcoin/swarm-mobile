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
    {PriceTrafficDriver ? <PriceTrafficDriver /> : <></>}
    <PriceFetcher />
  </ContextAppLoadedProvider>
);

const driverOnlyUi = (ctx: Ctx, setZecPrice: (p: ZecPriceType) => void) => (
  <ContextAppLoadedProvider value={{ ...ctx, setZecPrice }}>
    {PriceTrafficDriver ? <PriceTrafficDriver /> : <></>}
  </ContextAppLoadedProvider>
);

const seedDeps = (setZecPrice: (p: ZecPriceType) => void) => {
  priceFetcherStore.setDeps({
    setZecPrice,
    priceFetchable: false,
  });
};

const foregroundReturned = () => priceFetcherStore.foregroundReturned();

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

test('remounting display fetchers starts no new fetch', async () => {
  price.mockResolvedValue(swmFailed());
  const setZecPrice = jest.fn();
  seedDeps(setZecPrice);

  const view = render(surfaceUi(makeCtx(), setZecPrice));
  await waitFor(() => expect(price).toHaveBeenCalledTimes(2));

  view.rerender(driverOnlyUi(makeCtx(), setZecPrice));
  view.rerender(surfaceUi(makeCtx(), setZecPrice));
  await flush();
  await flush();
  expect(price).toHaveBeenCalledTimes(2);
});

test('the price setting switched off mid-flight stops the retry', async () => {
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
  seedDeps(setZecPrice);

  const view = render(surfaceUi(makeCtx(), setZecPrice));
  await waitFor(() => expect(price).toHaveBeenCalledTimes(1));

  view.rerender(surfaceUi(makeCtx({ showSwmPrice: false }), setZecPrice));
  land(swmFailed());
  await flush();

  expect(price).toHaveBeenCalledTimes(1);
});

test('a return shortly after a failed fetch still fetches', async () => {
  price.mockResolvedValue(swmFailed());
  const setZecPrice = jest.fn();
  seedDeps(setZecPrice);

  render(surfaceUi(makeCtx(), setZecPrice));
  await waitFor(() => expect(price).toHaveBeenCalledTimes(2));

  fireAppState('background');
  fireAppState('active');
  foregroundReturned();
  await flush();

  expect(price.mock.calls.length).toBeGreaterThan(2);
});

test('a switched-off price setting pauses the cadence until it is on again', async () => {
  jest.useFakeTimers();
  price.mockResolvedValue(swmFailed());
  const setZecPrice = jest.fn();
  seedDeps(setZecPrice);

  const view = render(surfaceUi(makeCtx({ showSwmPrice: false }), setZecPrice));
  await jest.advanceTimersByTimeAsync(61_000);
  expect(price).not.toHaveBeenCalled();

  view.rerender(surfaceUi(makeCtx({ showSwmPrice: true }), setZecPrice));
  await jest.advanceTimersByTimeAsync(0);
  expect(price).toHaveBeenCalled();
});

test('a switched-off price setting starts no fetch, the Nym toggle notwithstanding', async () => {
  price.mockResolvedValue(swmOk(42));
  const setZecPrice = jest.fn();

  for (const nym of [true, false]) {
    const view = render(
      surfaceUi(makeCtx({ nym, showSwmPrice: false }), setZecPrice),
    );
    await flush();
    await flush();
    expect(price).not.toHaveBeenCalled();
    view.unmount();
  }
});

test('a chain with no SWM listing starts no fetch', async () => {
  price.mockResolvedValue(swmOk(42));
  const setZecPrice = jest.fn();

  render(
    surfaceUi(
      makeCtx({
        info: { ...mockMainnetInfo, chainName: ChainNameEnum.swarmChainName },
      }),
      setZecPrice,
    ),
  );
  await flush();
  await flush();
  expect(price).not.toHaveBeenCalled();
});

test('a route that keeps refusing keeps retrying, not dying', async () => {
  jest.useFakeTimers();
  price.mockResolvedValue(swmFailed());
  const setZecPrice = jest.fn();

  render(surfaceUi(makeCtx(), setZecPrice));
  await jest.advanceTimersByTimeAsync(0);
  const entryCalls = price.mock.calls.length;
  expect(entryCalls).toBeGreaterThan(0);

  await jest.advanceTimersByTimeAsync(21 * 60_000);
  expect(price.mock.calls.length).toBeGreaterThan(entryCalls);
  expect(setZecPrice).not.toHaveBeenCalled();
});

test('the wallet fetches regardless of the displayed currency', async () => {
  price.mockResolvedValue(swmOk(42));
  const setZecPrice = jest.fn();
  seedDeps(setZecPrice);

  render(driverOnlyUi(makeCtx(), setZecPrice));
  await waitFor(() => expect(price).toHaveBeenCalled(), { timeout: 1500 });
  await waitFor(() =>
    expect(setZecPrice).toHaveBeenCalledWith(
      expect.objectContaining({ zecPrice: 42 }),
    ),
  );
});

test('a wedged request is reused, never multiplied', async () => {
  jest.useFakeTimers();
  price.mockImplementation(() => new Promise(() => {}));
  const setZecPrice = jest.fn();
  seedDeps(setZecPrice);

  render(surfaceUi(makeCtx(), setZecPrice));
  await jest.advanceTimersByTimeAsync(2 * PRICE_REFRESH_MAX_MS - 1_000);

  expect(price).toHaveBeenCalledTimes(1);
});

test('the raw active event fetches nothing; the opened gate does', async () => {
  jest.useFakeTimers();
  price.mockResolvedValue(swmOk(42));
  const setZecPrice = jest.fn();
  seedDeps(setZecPrice);

  render(surfaceUi(makeCtx(), setZecPrice));
  await jest.advanceTimersByTimeAsync(0);
  expect(price).toHaveBeenCalledTimes(1);

  await jest.advanceTimersByTimeAsync(6_000);
  fireAppState('background');
  fireAppState('active');
  await jest.advanceTimersByTimeAsync(0);
  expect(price).toHaveBeenCalledTimes(1);

  foregroundReturned();
  await jest.advanceTimersByTimeAsync(0);
  expect(price).toHaveBeenCalledTimes(2);
});
