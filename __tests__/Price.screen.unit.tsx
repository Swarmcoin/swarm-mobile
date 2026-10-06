jest.mock('@app/walletBackend/modules/SwmPriceService', () => ({
  __esModule: true,
  parseSwmPrice: jest.fn(),
  fetchSwmPrice: jest.fn(() => new Promise(() => {})),
}));

import 'react-native';
import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import en from '@app/translations/en.json';
import Price, { chartSeries } from '@screens/Price/Price';
import {
  ContextAppLoadedProvider,
  defaultAppContextLoaded,
} from '@app/context';
import { ChainNameEnum, CurrencyNameEnum, RouteEnum } from '@app/AppState';
import type { ZecPriceType } from '@app/AppState';
import mockNavigation from '../__mocks__/dataMocks/mockNavigation';
import { mockTotalBalance } from '../__mocks__/dataMocks/mockTotalBalance';
import {
  mockMainnetInfo,
  mockSwmDetails,
  mockSwmPrice,
} from '../__mocks__/dataMocks/mockSwmPrice';

type Catalog = { [key: string]: unknown };

const isCatalog = (node: unknown): node is Catalog =>
  typeof node === 'object' && !!node;

const translateEn = (key: string): string => {
  const found = key
    .split('.')
    .reduce<unknown>(
      (node, part) => (isCatalog(node) ? node[part] : undefined),
      en,
    );
  return typeof found === 'string' ? found : key;
};

const NOW = Date.UTC(2026, 9, 5, 18, 30, 0);
type Over = Partial<typeof defaultAppContextLoaded>;

const pageUi = (
  over: Over = {},
  setShowSwmPriceOption: (value: boolean) => Promise<void> = jest.fn(),
) => {
  const state = {
    ...defaultAppContextLoaded,
    translate: translateEn,
    info: { ...mockMainnetInfo, currencyName: CurrencyNameEnum.SWM },
    totalBalance: mockTotalBalance,
    zecPrice: mockSwmPrice(NOW - 12_000),
    addLastSnackbar: jest.fn(),
    ...over,
  };
  return (
    <ContextAppLoadedProvider value={state}>
      <Price
        navigation={mockNavigation}
        route={{ key: 'Key-1', name: RouteEnum.Price, params: undefined }}
        setShowSwmPriceOption={setShowSwmPriceOption}
      />
    </ContextAppLoadedProvider>
  );
};

const withoutDaily = (price: ZecPriceType): ZecPriceType => ({
  ...price,
  details: { ...mockSwmDetails, dailyUsd: undefined },
});

beforeAll(() => {
  const RN: typeof import('react-native') = require('react-native');
  jest
    .spyOn(RN.AppState, 'addEventListener')
    .mockImplementation(() => ({ remove: jest.fn() }));
});

beforeEach(() => {
  jest.useFakeTimers({ now: NOW });
});

afterEach(() => {
  jest.useRealTimers();
});

test('Tests that the page shows only the price, the ETH price, the three changes, the 24 h chart, the balance and the switch when the reading is fresh.', () => {
  const view = render(pageUi());

  expect(view.getByTestId('price.page.freshness.fresh')).toBeTruthy();
  expect(view.getByTestId('price.page.age')).toHaveTextContent(
    'updated 12 s ago',
  );
  expect(view.getByTestId('price.page.value')).toHaveTextContent('$0.8411 USD');
  expect(view.getByTestId('price.page.eth')).toHaveTextContent('0.000196 ETH');
  expect(view.getByTestId('price.page.change.1h')).toHaveTextContent('0.0 %1h');
  expect(view.getByTestId('price.page.change.6h')).toHaveTextContent(
    '▲ 28.8 %6h',
  );
  expect(view.getByTestId('price.page.change.24h')).toHaveTextContent(
    '▲ 36.7 %24h',
  );
  expect(view.getByTestId('price.page.chart.24h')).toBeTruthy();
  expect(view.getByTestId('price.chart.high')).toHaveTextContent('$0.8411');
  expect(view.getByTestId('price.chart.low')).toHaveTextContent('$0.5259');
  expect(view.getByTestId('price.chart.latest')).toHaveTextContent('$0.8411');
  // Owner 2026-10-06 (specs/PRICE-DISPLAY.md 2.3): nothing else.
  [
    '$3,761.34',
    'LIQUIDITY',
    '$378.11',
    '$8,411.43',
    '9 / 0',
    '0.9 %',
    'Base',
    'NETWORK',
    'SOURCES',
    '$0.8411  ✓',
    '$0.8602  ✓',
    '0xf1e0…4599',
    '0xf904…043B',
  ].forEach(text => expect(view.queryByText(text)).toBeNull());
  [
    /24 H VOLUME/i,
    /FULLY DILUTED/i,
    /BUYS/i,
    /POOL FEE/i,
    /^Live/,
    /DexScreener/,
    /GeckoTerminal/,
  ].forEach(text => expect(view.queryByText(text)).toBeNull());
  expect(view.queryAllByTestId(/^price\.page\.(source|copy)\./)).toHaveLength(
    0,
  );
  expect(view.queryAllByRole('link')).toHaveLength(0);
  expect(view.queryByTestId('price.page.note')).toBeNull();
  expect(view.queryByText(/Indicative/)).toBeNull();
  expect(view.getByTestId('price.page.switch')).toBeTruthy();
});

test('Tests that the balance row shows SWM and USD when high privacy is off, and masks both when it is on.', () => {
  const total =
    mockTotalBalance.totalIronwoodBalance +
    mockTotalBalance.totalOrchardBalance +
    mockTotalBalance.totalSaplingBalance +
    mockTotalBalance.totalTransparentBalance;
  const open = render(pageUi());
  expect(open.getByTestId('price.page.balance')).toHaveTextContent(
    new RegExp(`^${String(total).replace('.', '\\.')}.* SWM ≈ \\$.* USD$`),
  );

  const masked = render(pageUi({ privacy: true }));
  expect(masked.getByTestId('price.page.balance')).toHaveTextContent(
    '⬢⬢⬢.⬢⬢ SWM ≈ $⬢⬢⬢.⬢⬢ USD',
  );
});

test('Tests that the range switch draws the hourly and the daily series when the user picks 48h and 30d.', () => {
  const view = render(pageUi());

  fireEvent.press(view.getByTestId('price.page.range.48h'));
  expect(view.getByTestId('price.page.chart.48h')).toBeTruthy();

  fireEvent.press(view.getByTestId('price.page.range.30d'));
  expect(view.getByTestId('price.page.chart.30d')).toBeTruthy();
  expect(view.getByTestId('price.chart.low')).toHaveTextContent('$0.3112');
});

test('Tests that the 30d range is disabled when the relay sends no daily series.', () => {
  const view = render(pageUi({ zecPrice: withoutDaily(mockSwmPrice(NOW)) }));
  const daily = view.getByTestId('price.page.range.30d');
  expect(daily.props.accessibilityState).toEqual(
    expect.objectContaining({ disabled: true }),
  );
  fireEvent.press(daily);
  expect(view.queryByTestId('price.page.chart.30d')).toBeNull();
  expect(view.getByTestId('price.page.chart.24h')).toBeTruthy();
});

test('Tests that a touch on the chart reads out the price and the hour under the finger.', () => {
  const view = render(pageUi());
  const touch = view.getByTestId('price.page.chart.24h.touch');
  fireEvent(touch, 'responderGrant', { nativeEvent: { locationX: 0 } });
  expect(view.getByTestId('price.chart.readout')).toHaveTextContent(
    /^\$0\.5259 · /,
  );
  fireEvent(touch, 'responderRelease', { nativeEvent: { locationX: 0 } });
  expect(view.getByTestId('price.chart.readout')).toHaveTextContent('');
});

test('Tests that the page shows only the switch when the price setting is off. The switch turns it back on.', () => {
  const setOption = jest.fn(async () => {});
  const view = render(pageUi({ showSwmPrice: false }, setOption));

  expect(view.queryByTestId('price.page.value')).toBeNull();
  expect(view.queryByTestId('price.page.balance')).toBeNull();
  expect(view.queryByTestId('price.page.note')).toBeNull();
  fireEvent.press(view.getByTestId('price.page.switch'));
  expect(setOption).toHaveBeenCalledWith(true);
});

test('Tests that the page has no content when the wallet is on SWARM Testnet.', () => {
  const view = render(
    pageUi({
      info: { ...mockMainnetInfo, chainName: ChainNameEnum.swarmChainName },
    }),
  );
  expect(view.queryByTestId('price.page')).toBeNull();
});

test('Tests that the page names no source and opens no listing, whichever reading the price came from.', () => {
  const RN: typeof import('react-native') = require('react-native');
  const open = jest.spyOn(RN.Linking, 'openURL').mockResolvedValue(true);
  (['pool', 'dexscreener', 'geckoterminal'] as const).forEach(source => {
    const view = render(
      pageUi({
        zecPrice: {
          ...mockSwmPrice(NOW),
          source,
          details: {
            ...mockSwmDetails,
            sources: [
              { id: 'pool', ok: true, priceUsd: 1.42 },
              { id: 'dexscreener', ok: true, priceUsd: 1.42 },
              { id: 'geckoterminal', ok: true, priceUsd: 1.28 },
            ],
          },
        },
      }),
    );
    expect(view.queryAllByTestId(/^price\.page\.source\./)).toHaveLength(0);
    expect(view.queryByText(/Live|DexScreener|GeckoTerminal/)).toBeNull();
    expect(view.queryByText(/1\.28/)).toBeNull();
    view.unmount();
  });
  expect(open).not.toHaveBeenCalled();
  open.mockRestore();
});

test('Tests that the chart series place the hourly closes before the relay hour when the relay sends no start hour.', () => {
  const series = chartSeries({
    ...mockSwmPrice(NOW),
    generatedUnix: 7200 * 1000 + 59,
    details: { ...mockSwmDetails, hourlyFromUnix: undefined },
  });
  const hours = series['48h'].map(p => p.unix);
  expect(hours[hours.length - 1]).toBe(7200 * 1000);
  expect(hours[1] - hours[0]).toBe(3600);
});

test('Tests that the snapshot of the page matches when the reading is the specification example.', () => {
  expect(render(pageUi()).toJSON()).toMatchSnapshot();
});

const liveEnded = (): ZecPriceType => {
  const closes = Array.from({ length: 48 }, (_, i) => 0.5 + i / 100);
  const daily = Array.from({ length: 30 }, (_, i) => 0.3 + i / 100);
  return {
    ...mockSwmPrice(NOW),
    zecPrice: 0.8411,
    generatedUnix: 1791226888,
    sparklineUsd: [...closes, 0.8411],
    details: {
      ...mockSwmDetails,
      hourlyFromUnix: 1791054000,
      hourlyEndsLive: true,
      dailyUsd: [...daily, 0.8411],
      dailyFromUnix: 1788652800,
      dailyEndsLive: true,
    },
  };
};

test('Tests that every range ends at the live price when the relay appends it. 24h holds 24 closes and the live point.', () => {
  const series = chartSeries(liveEnded());
  expect(series['24h']).toHaveLength(25);
  expect(series['48h']).toHaveLength(49);
  expect(series['30d']).toHaveLength(31);
  (['24h', '48h', '30d'] as const).forEach(r => {
    const last = series[r][series[r].length - 1];
    expect(last).toEqual({ usd: 0.8411, unix: 1791226888, live: true });
    expect(series[r].slice(0, -1).every(p => !p.live)).toBe(true);
  });
  expect(series['24h'][0].unix).toBe(1791054000 + 24 * 3600);
  expect(series['30d'][29].unix).toBe(1788652800 + 29 * 86400);
});

test('Tests that the closes end an hour before the live point when the relay sends no start hour.', () => {
  const price = liveEnded();
  const series = chartSeries({
    ...price,
    details: {
      ...mockSwmDetails,
      hourlyFromUnix: undefined,
      hourlyEndsLive: true,
    },
  });
  const hourly = series['48h'];
  const generated = 1791226888;
  expect(hourly[47].unix).toBe(generated - (generated % 3600) - 3600);
  expect(hourly[48].live).toBe(true);
});

test('Tests that the touch readout says "now" on the live point and a time on a close.', () => {
  const view = render(pageUi({ zecPrice: liveEnded() }));
  const touch = view.getByTestId('price.page.chart.24h.touch');
  fireEvent(touch, 'responderGrant', { nativeEvent: { locationX: 10_000 } });
  expect(view.getByTestId('price.chart.readout')).toHaveTextContent(
    '$0.8411 · now',
  );
  fireEvent(touch, 'responderMove', { nativeEvent: { locationX: 0 } });
  expect(view.getByTestId('price.chart.readout')).not.toHaveTextContent(/now$/);
});
