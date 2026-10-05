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
import { render, renderHook } from '@testing-library/react-native';
import PriceFetcher, { PriceTrafficDriver } from '@ui/widgets/PriceFetcher';
import QuoteRefreshRing from '@ui/primitives/QuoteRefreshRing';
import {
  priceFetcherStore,
  usePriceStale,
} from '@ui/widgets/priceFetcherStore';
import {
  ContextAppLoadedProvider,
  defaultAppContextLoaded,
} from '@app/context';
import { SelectServerEnum } from '@app/AppState';
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

test('a market-less surface renders no ring at all', async () => {
  jest.useFakeTimers();
  price.mockResolvedValue(swmOk(42));
  const setZecPrice = jest.fn();

  const view = render(
    surfaceUi(
      makeCtx({
        showSwmPrice: true,
        selectServer: SelectServerEnum.offline,
      }),
      setZecPrice,
    ),
  );
  await jest.advanceTimersByTimeAsync(1_000);

  expect(price).not.toHaveBeenCalled();
  expect(view.queryByTestId('pricefetcher.ring')).toBeNull();
});

test('a bound expiry never retries against the same wedged call', async () => {
  jest.useFakeTimers();
  price.mockImplementation(() => new Promise(() => {}));
  const setZecPrice = jest.fn();

  render(surfaceUi(makeCtx(), setZecPrice));
  await jest.advanceTimersByTimeAsync(0);
  expect(price).toHaveBeenCalledTimes(1);

  await jest.advanceTimersByTimeAsync(31_000);
  expect(priceFetcherStore.snapshot().loading).toBe(false);
  expect(price).toHaveBeenCalledTimes(1);
});

test('a session detached mid-flight leaves no loading behind', async () => {
  jest.useFakeTimers();
  price
    .mockImplementationOnce(() => new Promise(() => {}))
    .mockResolvedValue(swmOk(42));
  const setZecPrice = jest.fn();

  const view = render(surfaceUi(makeCtx(), setZecPrice));
  await jest.advanceTimersByTimeAsync(0);
  expect(price).toHaveBeenCalledTimes(1);

  view.unmount();

  render(surfaceUi(makeCtx(), setZecPrice));
  await jest.advanceTimersByTimeAsync(0);
  expect(price).toHaveBeenCalledTimes(2);
  expect(setZecPrice).toHaveBeenCalledWith(
    expect.objectContaining({ zecPrice: 42 }),
  );
});

test('a price landing while the app is away is recorded', async () => {
  jest.useFakeTimers();
  let land: (v: SwmPriceOutcome) => void = () => {};
  price.mockImplementationOnce(
    () =>
      new Promise(resolve => {
        land = resolve;
      }),
  );
  const setZecPrice = jest.fn();

  render(surfaceUi(makeCtx(), setZecPrice));
  await jest.advanceTimersByTimeAsync(0);
  expect(price).toHaveBeenCalledTimes(1);

  fireAppState('background');
  land(swmOk(42));
  await jest.advanceTimersByTimeAsync(0);

  expect(setZecPrice).toHaveBeenCalledWith(
    expect.objectContaining({ zecPrice: 42 }),
  );
});

test('a parked return the landing declines is consumed, not doubled', async () => {
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

  const view = render(surfaceUi(makeCtx({ showSwmPrice: true }), setZecPrice));
  await jest.advanceTimersByTimeAsync(0);
  expect(price).toHaveBeenCalledTimes(1);

  priceFetcherStore.foregroundReturned();
  view.rerender(surfaceUi(makeCtx({ showSwmPrice: false }), setZecPrice));
  land(swmFailed());
  await jest.advanceTimersByTimeAsync(0);

  await jest.advanceTimersByTimeAsync(6_000);
  view.rerender(surfaceUi(makeCtx({ showSwmPrice: true }), setZecPrice));
  await jest.advanceTimersByTimeAsync(0);

  expect(price).toHaveBeenCalledTimes(3);
});

test('the boot fetch renders nothing before the first price', async () => {
  jest.useFakeTimers();
  price.mockImplementation(() => new Promise(() => {}));
  const setZecPrice = jest.fn();

  const view = render(surfaceUi(makeCtx(), setZecPrice));
  await jest.advanceTimersByTimeAsync(0);

  expect(price).toHaveBeenCalledTimes(1);
  expect(view.queryByTestId('pricefetcher.ring')).toBeNull();
});

test('a price dims only after five minutes without a fresh read', () => {
  const inside = Date.now() - (5 * 60_000 - 1_000);
  const { result: healthy } = renderHook(() => usePriceStale(inside));
  expect(healthy.current).toBe(false);

  const past = Date.now() - (5 * 60_000 + 1_000);
  const { result: slipped } = renderHook(() => usePriceStale(past));
  expect(slipped.current).toBe(true);
});

test('the ring fills from coarse ticks, not a per-frame animation', async () => {
  jest.useFakeTimers();
  const { Animated } = require('react-native');
  const timingSpy = jest.spyOn(Animated, 'timing');

  render(
    <QuoteRefreshRing
      size={22}
      color="#ffffff"
      trackColor="rgba(255,255,255,0.12)"
      durationMs={60_000}
      resetKey={1}
      accessibilityLabel="ring"
      testID="ring"
    />,
  );
  await jest.advanceTimersByTimeAsync(30_000);

  expect(timingSpy).not.toHaveBeenCalled();
  const midFill = jest.getTimerCount();
  expect(midFill).toBeGreaterThan(0);

  await jest.advanceTimersByTimeAsync(31_000);
  expect(timingSpy).not.toHaveBeenCalled();
  expect(jest.getTimerCount()).toBeLessThan(midFill);
  timingSpy.mockRestore();
});
