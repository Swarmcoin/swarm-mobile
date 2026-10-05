jest.mock('@app/walletBackend', () => ({
  __esModule: true,
  fetchSwmPrice: jest
    .fn()
    .mockResolvedValue({ kind: 'error', errorKey: 'price.error-network' }),
}));

import 'react-native';
import { mockMainnetInfo } from '../__mocks__/dataMocks/mockSwmPrice';
import React from 'react';
import { ReactTestRendererJSON } from 'react-test-renderer';
import { render, waitFor } from '@testing-library/react-native';
import PriceFetcher, { PriceTrafficDriver } from '@ui/widgets/PriceFetcher';
import QuoteRefreshRing from '@ui/primitives/QuoteRefreshRing';
import {
  PRICE_REFRESH_MAX_MS,
  priceFetcherStore,
} from '@ui/widgets/priceFetcherStore';
import {
  ContextAppLoadedProvider,
  defaultAppContextLoaded,
} from '@app/context';
import { SelectServerEnum } from '@app/AppState';

beforeEach(() => {
  priceFetcherStore.resetForTests();
});

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

const fetcherUi = (ctx: Ctx) => (
  <ContextAppLoadedProvider value={{ ...ctx, setZecPrice: jest.fn() }}>
    {PriceTrafficDriver ? <PriceTrafficDriver /> : <></>}
    <PriceFetcher />
  </ContextAppLoadedProvider>
);

type JsonNode = ReactTestRendererJSON | ReactTestRendererJSON[] | string | null;
const collect = (
  node: JsonNode,
  hits: ReactTestRendererJSON[],
  pick: (n: ReactTestRendererJSON) => boolean,
) => {
  if (!node || typeof node === 'string') return;
  if (Array.isArray(node)) {
    node.forEach(child => collect(child, hits, pick));
    return;
  }
  if (pick(node)) hits.push(node);
  (node.children ?? []).forEach(child => collect(child, hits, pick));
};

test('the stale arc keeps a color of its own, distinct from the track', () => {
  const staleCtx = makeCtx({
    zecPrice: { zecPrice: 33.33, date: Date.now() - 11 * 60_000 },
  });
  const view = render(fetcherUi(staleCtx));

  const ring = view.UNSAFE_getByType(QuoteRefreshRing);
  expect(ring.props.ringColor).not.toBe(ring.props.trackColor);
});

test('the display-only ring exposes no disabled tap stop', () => {
  const freshCtx = makeCtx({
    zecPrice: { zecPrice: 33.33, date: Date.now() },
  });
  const view = render(fetcherUi(freshCtx));

  const disabledStops: ReactTestRendererJSON[] = [];
  collect(
    view.toJSON(),
    disabledStops,
    n => n.props?.accessibilityState?.disabled === true,
  );
  expect(disabledStops).toEqual([]);
});

test('a stale price reaches screen readers as a label', () => {
  const staleCtx = makeCtx({
    zecPrice: { zecPrice: 33.33, date: Date.now() - 11 * 60_000 },
  });
  const view = render(fetcherUi(staleCtx));
  expect(view.getByLabelText('price-ring-stale')).toBeTruthy();
});

test('a current price reaches screen readers as a label too', () => {
  const freshCtx = makeCtx({
    zecPrice: { zecPrice: 33.33, date: Date.now() },
  });
  const view = render(fetcherUi(freshCtx));
  expect(view.getByLabelText('price-ring-live')).toBeTruthy();
});

test('a paused surface reaches screen readers as paused, not current', () => {
  const pausedCtx = makeCtx({
    zecPrice: { zecPrice: 33.33, date: Date.now() },
    showSwmPrice: false,
  });
  const view = render(fetcherUi(pausedCtx));
  expect(view.getByLabelText('price-ring-paused')).toBeTruthy();
});

test('the ring restarts on every refresh cycle, failed ones included', async () => {
  jest.useFakeTimers();
  const view = render(
    fetcherUi(makeCtx({ zecPrice: { zecPrice: 33.33, date: Date.now() } })),
  );
  await jest.advanceTimersByTimeAsync(0);
  const firstCycle = view.UNSAFE_getByType(QuoteRefreshRing).props.resetKey;

  await jest.advanceTimersByTimeAsync(PRICE_REFRESH_MAX_MS + 61_000);
  const secondCycle = view.UNSAFE_getByType(QuoteRefreshRing).props.resetKey;

  expect(secondCycle).not.toBe(firstCycle);
  jest.useRealTimers();
});

test('a price that never arrived renders no ring', async () => {
  const view = render(fetcherUi(makeCtx()));
  await waitFor(() =>
    expect(view.queryByTestId('pricefetcher.ring')).toBeNull(),
  );
});

test('a switched-off price setting shows no ring', () => {
  const view = render(fetcherUi(makeCtx({ showSwmPrice: false })));
  expect(view.queryByTestId('pricefetcher.ring')).toBeNull();
});
