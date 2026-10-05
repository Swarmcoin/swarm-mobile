jest.mock('@app/walletBackend', () => ({
  __esModule: true,
  fetchSwmPrice: jest.fn(),
}));

import 'react-native';
import type { ZecPriceType } from '@app/AppState';
import { mockMainnetInfo, swmOk } from '../__mocks__/dataMocks/mockSwmPrice';
import type { AppStateStatus } from 'react-native';
import React from 'react';
import { render } from '@testing-library/react-native';
import { PriceTrafficDriver } from '@ui/widgets/PriceFetcher';
import {
  PRICE_REFRESH_MAX_MS,
  PRICE_REFRESH_MIN_MS,
  priceFetcherStore,
} from '@ui/widgets/priceFetcherStore';
import {
  ContextAppLoadedProvider,
  defaultAppContextLoaded,
} from '@app/context';
import { SelectServerEnum } from '@app/AppState';
import { fetchSwmPrice } from '@app/walletBackend';

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

const driverUi = (ctx: Ctx, setZecPrice: (p: ZecPriceType) => void) => (
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
  jest.restoreAllMocks();
});

test('a boot fetches at once, price age notwithstanding', async () => {
  jest.useFakeTimers();
  price.mockResolvedValue(swmOk(42));
  const setZecPrice = jest.fn();

  render(
    driverUi(
      makeCtx({ zecPrice: { zecPrice: 42, date: Date.now() - 10_000 } }),
      setZecPrice,
    ),
  );
  await jest.advanceTimersByTimeAsync(0);
  expect(price).toHaveBeenCalledTimes(1);
});

test('the price setting turning on mid-session fetches at once', async () => {
  jest.useFakeTimers();
  price.mockResolvedValue(swmOk(42));
  const setZecPrice = jest.fn();

  const view = render(driverUi(makeCtx({ showSwmPrice: false }), setZecPrice));
  await jest.advanceTimersByTimeAsync(10_000);
  expect(price).not.toHaveBeenCalled();

  view.rerender(driverUi(makeCtx({ showSwmPrice: true }), setZecPrice));
  await jest.advanceTimersByTimeAsync(0);
  expect(price).toHaveBeenCalledTimes(1);
});

test('every gate-open return from the background fetches', async () => {
  jest.useFakeTimers();
  price.mockResolvedValue(swmOk(42));
  const setZecPrice = jest.fn();

  render(driverUi(makeCtx(), setZecPrice));
  await jest.advanceTimersByTimeAsync(0);
  expect(price).toHaveBeenCalledTimes(1);

  await jest.advanceTimersByTimeAsync(30_000);
  fireAppState('background');
  fireAppState('active');
  priceFetcherStore.foregroundReturned();
  await jest.advanceTimersByTimeAsync(0);
  expect(price).toHaveBeenCalledTimes(2);
});

test('the next fetch follows the last inside the jitter window', async () => {
  jest.useFakeTimers();
  price.mockResolvedValue(swmOk(42));
  const setZecPrice = jest.fn();

  render(driverUi(makeCtx(), setZecPrice));
  await jest.advanceTimersByTimeAsync(0);
  expect(price).toHaveBeenCalledTimes(1);

  await jest.advanceTimersByTimeAsync(PRICE_REFRESH_MIN_MS - 1_000);
  expect(price).toHaveBeenCalledTimes(1);

  await jest.advanceTimersByTimeAsync(
    PRICE_REFRESH_MAX_MS - PRICE_REFRESH_MIN_MS + 2_000,
  );
  expect(price).toHaveBeenCalledTimes(2);
});

test('every tick draws its own delay from the jitter window', async () => {
  jest.useFakeTimers();
  price.mockResolvedValue(swmOk(42));
  const setZecPrice = jest.fn();

  render(driverUi(makeCtx(), setZecPrice));
  for (let tick = 0; tick < 5; tick++) {
    await jest.advanceTimersByTimeAsync(0);
    const { nextFetchAt, nextFetchDelayMs } = priceFetcherStore.snapshot();
    expect(nextFetchDelayMs).toBeGreaterThanOrEqual(PRICE_REFRESH_MIN_MS);
    expect(nextFetchDelayMs).toBeLessThanOrEqual(PRICE_REFRESH_MAX_MS);
    const before = price.mock.calls.length;
    await jest.advanceTimersByTimeAsync(nextFetchAt - Date.now() - 1_000);
    expect(price.mock.calls.length).toBe(before);
    await jest.advanceTimersByTimeAsync(2_000);
    expect(price.mock.calls.length).toBe(before + 1);
  }
});
