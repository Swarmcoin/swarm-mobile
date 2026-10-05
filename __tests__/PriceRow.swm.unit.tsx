jest.mock('@app/walletBackend', () => ({
  __esModule: true,
  fetchSwmPrice: jest.fn(),
}));

import 'react-native';
import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import en from '@app/translations/en.json';
import { PRICE_UP } from '@app/theme/tokens';
import PriceRow from '@ui/widgets/Header/components/PriceRow';
import Sparkline from '@ui/primitives/Sparkline';
import { mockSwmPrice } from '../__mocks__/dataMocks/mockSwmPrice';
import { mockTheme } from '../__mocks__/dataMocks/mockTheme';
import type { ZecPriceType } from '@app/AppState';
import type { TextStyle } from 'react-native';
import type { ReactTestInstance } from 'react-test-renderer';

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

const rowUi = (price: ZecPriceType, shown = true) => (
  <PriceRow translate={translateEn} zecPrice={price} shown={shown} />
);

const colorOf = (node: ReactTestInstance) => {
  const RN: typeof import('react-native') = require('react-native');
  const style: TextStyle = RN.StyleSheet.flatten(node.props.style);
  return style.color;
};

beforeEach(() => {
  jest.useFakeTimers({ now: NOW });
});

afterEach(() => {
  jest.useRealTimers();
});

test('Tests that the card shows the price, the 24 h change, the sparkline and its source when the reading is fresh.', () => {
  const view = render(rowUi(mockSwmPrice(NOW - 12_000)));

  expect(view.getByText('SWM PRICE')).toBeTruthy();
  expect(view.getByTestId('price.value')).toHaveTextContent('$0.8411 USD');
  expect(view.getByTestId('price.change')).toHaveTextContent('▲ 36.7 % 24h');
  expect(colorOf(view.getByTestId('price.change'))).toBe(PRICE_UP);
  expect(view.UNSAFE_getByType(Sparkline).props.points).toEqual(
    mockSwmPrice(NOW).sparklineUsd,
  );
  expect(view.getByTestId('price.freshness.fresh')).toBeTruthy();
  expect(view.getByTestId('price.meta')).toHaveTextContent(
    'GeckoTerminal · updated 12 s ago',
  );
});

test('Tests that the snapshot of the card matches when the reading is the specification example.', () => {
  const view = render(rowUi(mockSwmPrice(NOW - 12_000)));
  expect(view.toJSON()).toMatchSnapshot();
});

test('Tests that a fall reads as a red down arrow and no change as a grey figure.', () => {
  const falling = render(rowUi({ ...mockSwmPrice(NOW), changePct24h: -3.24 }));
  expect(falling.getByTestId('price.change')).toHaveTextContent('▼ 3.2 % 24h');
  expect(colorOf(falling.getByTestId('price.change'))).toBe(
    mockTheme.colors.fgDanger,
  );

  const flat = render(rowUi({ ...mockSwmPrice(NOW), changePct24h: 0 }));
  expect(flat.getByTestId('price.change')).toHaveTextContent('0.0 % 24h');
  expect(colorOf(flat.getByTestId('price.change'))).toBe(
    mockTheme.colors.fgMuted,
  );
});

test('Tests that a price of 1 USD or more shows two decimals with grouping.', () => {
  const view = render(rowUi({ ...mockSwmPrice(NOW), zecPrice: 1234.567 }));
  expect(view.getByTestId('price.value')).toHaveTextContent('$1,234.57 USD');
});

test('Tests that the meta line says "as of" with the time when the reading is between 5 and 30 minutes old.', () => {
  const date = NOW - 12 * 60_000;
  const view = render(rowUi(mockSwmPrice(date)));
  const clock = new Date(date).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
  expect(view.getByTestId('price.freshness.ageing')).toBeTruthy();
  expect(view.getByTestId('price.meta')).toHaveTextContent(
    `GeckoTerminal · as of ${clock}`,
  );
  expect(colorOf(view.getByTestId('price.value'))).toBe(
    mockTheme.colors.fgDefault,
  );
});

test('Tests that the price greys when the relay marks its value stale.', () => {
  const view = render(rowUi({ ...mockSwmPrice(NOW), relayStale: true }));
  expect(view.getByTestId('price.freshness.stale')).toBeTruthy();
  expect(colorOf(view.getByTestId('price.value'))).toBe(
    mockTheme.colors.fgMuted,
  );
});

test('Tests that the card says the price is unavailable when the last reading is more than an hour old.', () => {
  const view = render(rowUi(mockSwmPrice(NOW - 61 * 60_000)));
  expect(view.getByText('Price unavailable')).toBeTruthy();
  expect(view.queryByTestId('price.value')).toBeNull();
  expect(view.UNSAFE_queryByType(Sparkline)).toBeNull();
});

test('Tests that the card renders nothing when the price is switched off or never arrived.', () => {
  expect(render(rowUi(mockSwmPrice(NOW), false)).toJSON()).toBeNull();
  expect(render(rowUi({ zecPrice: 0, date: 0 })).toJSON()).toBeNull();
});

test('Tests that the card has no sparkline or change chip when the relay sends neither.', () => {
  const view = render(
    rowUi({
      ...mockSwmPrice(NOW),
      sparklineUsd: undefined,
      changePct24h: undefined,
    }),
  );
  expect(view.UNSAFE_queryByType(Sparkline)).toBeNull();
  expect(view.queryByTestId('price.change')).toBeNull();
});

test('Tests that a tap on the card opens the price page.', () => {
  const onOpen = jest.fn();
  const view = render(
    <PriceRow
      translate={translateEn}
      zecPrice={mockSwmPrice(NOW)}
      shown={true}
      onOpen={onOpen}
    />,
  );
  fireEvent.press(view.getByTestId('price.card'));
  expect(onOpen).toHaveBeenCalledTimes(1);
});

test('Tests that the info button and a long press show the note that the price is indicative.', () => {
  const view = render(rowUi(mockSwmPrice(NOW)));
  expect(view.queryByTestId('price.note')).toBeNull();

  fireEvent.press(view.getByTestId('price.info'));
  expect(view.getByTestId('price.note')).toHaveTextContent(
    'Indicative price from the SWM/ETH pool on Base. The pool is small; small trades move it. Not a quote.',
  );

  fireEvent(view.getByTestId('price.card'), 'longPress');
  expect(view.queryByTestId('price.note')).toBeNull();
});
