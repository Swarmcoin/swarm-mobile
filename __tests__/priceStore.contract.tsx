jest.mock('@app/walletBackend', () => ({
  __esModule: true,
  fetchSwmPrice: jest.fn(),
}));

import * as fs from 'fs';
import * as path from 'path';
import 'react-native';
import type { ZecPriceType } from '@app/AppState';
import { mockMainnetInfo, swmOk } from '../__mocks__/dataMocks/mockSwmPrice';
import type { AppStateStatus } from 'react-native';
import React from 'react';
import { render } from '@testing-library/react-native';
import PriceFetcher, { PriceTrafficDriver } from '@ui/widgets/PriceFetcher';
import QuoteRefreshRing from '@ui/primitives/QuoteRefreshRing';
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

beforeEach(() => {
  price.mockReset();
  priceFetcherStore.resetForTests();
});

afterEach(() => {
  jest.useRealTimers();
});

test('a switched-off price setting mutes the ring and stops its fill', async () => {
  jest.useFakeTimers();
  price.mockResolvedValue(swmOk(42));
  const setZecPrice = jest.fn();
  const priceDate = Date.now();

  const view = render(
    surfaceUi(
      makeCtx({
        showSwmPrice: true,
        zecPrice: { zecPrice: 42, date: priceDate },
      }),
      setZecPrice,
    ),
  );
  await jest.advanceTimersByTimeAsync(0);
  const live = view.UNSAFE_getByType(QuoteRefreshRing).props;
  expect(live.durationMs).toBeGreaterThanOrEqual(PRICE_REFRESH_MIN_MS);
  expect(live.durationMs).toBeLessThanOrEqual(PRICE_REFRESH_MAX_MS);

  view.rerender(
    surfaceUi(
      makeCtx({
        showSwmPrice: false,
        zecPrice: { zecPrice: 42, date: priceDate },
      }),
      setZecPrice,
    ),
  );
  await jest.advanceTimersByTimeAsync(0);
  const off = view.UNSAFE_getByType(QuoteRefreshRing).props;
  expect(off.durationMs).toBe(0);
  expect(off.color).not.toBe(live.color);
});

test('an entry flight with no armed deadline never reads full', async () => {
  jest.useFakeTimers();
  price.mockImplementation(() => new Promise(() => {}));
  const setZecPrice = jest.fn();

  const view = render(
    surfaceUi(
      makeCtx({ zecPrice: { zecPrice: 42, date: Date.now() - 60_000 } }),
      setZecPrice,
    ),
  );
  await jest.advanceTimersByTimeAsync(0);

  const ring = view.UNSAFE_getByType(QuoteRefreshRing);
  expect(ring.props.startProgress).toBeLessThan(1);
});

test('the driver writes deps when an input moves, not per render', async () => {
  jest.useFakeTimers();
  price.mockResolvedValue(swmOk(42));
  const setDepsSpy = jest.spyOn(priceFetcherStore, 'setDeps');
  const setZecPrice = jest.fn();
  const ctx = makeCtx({ showSwmPrice: true });

  const view = render(driverOnlyUi(ctx, setZecPrice));
  await jest.advanceTimersByTimeAsync(0);
  const writes = setDepsSpy.mock.calls.length;
  expect(writes).toBeGreaterThan(0);

  view.rerender(driverOnlyUi({ ...ctx }, setZecPrice));
  await jest.advanceTimersByTimeAsync(0);
  expect(setDepsSpy.mock.calls.length).toBe(writes);
  setDepsSpy.mockRestore();
});

test('the snapshot carries exactly its five read fields', () => {
  expect(Object.keys(priceFetcherStore.snapshot()).sort()).toEqual([
    'lastErrorKey',
    'loading',
    'nextFetchAt',
    'nextFetchDelayMs',
    'surfaceActive',
  ]);
});

test('the snapshot keeps its identity between emits', () => {
  const first = priceFetcherStore.snapshot();
  expect(priceFetcherStore.snapshot()).toBe(first);
});

test('no any-casts in the price suites and no null in the store', () => {
  const suites = [
    'priceStore.cadence.tsx',
    'priceDisplay.ring.tsx',
    'priceStore.lifecycle.tsx',
    'priceStore.trafficGuards.tsx',
    'priceStore.wedgeGuards.tsx',
    'priceStore.optIn.tsx',
    'priceStore.nativeCall.tsx',
    'priceStore.contract.tsx',
    'priceStore.recovery.tsx',
    'priceStore.freshness.tsx',
    'Send.priceCta.unit.tsx',
    'PriceFetcher.snapshot.tsx',
  ];
  const anyCast = new RegExp('as' + ' any');
  suites.forEach(suite => {
    const source = fs.readFileSync(path.join(__dirname, suite), 'utf8');
    expect(anyCast.test(source)).toBe(false);
  });
  const store = fs.readFileSync(
    path.join(__dirname, '../ui/widgets/priceFetcherStore.ts'),
    'utf8',
  );
  expect(new RegExp('\\bnul' + 'l\\b').test(store)).toBe(false);
});

test('the ring is display-only', () => {
  const ringSource = fs.readFileSync(
    path.join(__dirname, '../ui/primitives/QuoteRefreshRing.tsx'),
    'utf8',
  );
  expect(new RegExp('Pres' + 'sable').test(ringSource)).toBe(false);
  expect(new RegExp('on' + 'Press').test(ringSource)).toBe(false);

  const view = render(
    <QuoteRefreshRing
      size={22}
      color="#ffffff"
      trackColor="#333333"
      durationMs={60_000}
      resetKey={1}
      accessibilityLabel="ring"
      testID="h10.ring"
    />,
  );
  expect(view.getByTestId('h10.ring').props.accessibilityRole).toBe('image');
});
