jest.mock('@app/walletBackend/modules/SwmPriceService', () => ({
  __esModule: true,
  parseSwmPrice: jest.fn(),
  fetchSwmPrice: jest
    .fn()
    .mockResolvedValue({ kind: 'error', errorKey: 'price.error-network' }),
}));

import 'react-native';
import React from 'react';
import { render } from '@testing-library/react-native';
import Header from '@ui/widgets/Header';
import {
  ContextAppLoadedProvider,
  defaultAppContextLoaded,
} from '@app/context';
import { ChainNameEnum, ScreenEnum, SelectServerEnum } from '@app/AppState';
import { mockTranslate } from '../__mocks__/dataMocks/mockTranslate';
import { mockTotalBalance } from '../__mocks__/dataMocks/mockTotalBalance';
import {
  mockMainnetInfo,
  mockSwmPrice,
} from '../__mocks__/dataMocks/mockSwmPrice';

type Over = Partial<typeof defaultAppContextLoaded>;

const NOW = Date.UTC(2026, 9, 5, 18, 30, 0);

const headerUi = (over: Over = {}) => {
  const state = {
    ...defaultAppContextLoaded,
    translate: mockTranslate,
    info: mockMainnetInfo,
    totalBalance: mockTotalBalance,
    selectServer: SelectServerEnum.auto,
    zecPrice: mockSwmPrice(NOW - 12_000),
    ...over,
  };
  const onFunction = jest.fn();
  return (
    <ContextAppLoadedProvider value={state}>
      <Header
        title="title"
        screenName={ScreenEnum.History}
        toggleMenuDrawer={onFunction}
        setBackgroundError={onFunction}
        addLastSnackbar={onFunction}
        setShieldingAmount={onFunction}
      />
    </ContextAppLoadedProvider>
  );
};

const total =
  mockTotalBalance.totalIronwoodBalance +
  mockTotalBalance.totalOrchardBalance +
  mockTotalBalance.totalSaplingBalance +
  mockTotalBalance.totalTransparentBalance;

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

test('Tests that the header shows the balance in USD and the price card when the wallet is on SWARM Mainnet.', () => {
  const view = render(headerUi());
  const usd = (Math.round(total * 0.84114343 * 100) / 100)
    .toFixed(2)
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  expect(view.getByTestId('header.fiat')).toHaveTextContent(`≈ $${usd} USD`);
  expect(view.getByTestId('price.card')).toBeTruthy();
});

test('Tests that the header shows no USD figure and no price card when the wallet is on SWARM Testnet.', () => {
  const view = render(
    headerUi({
      info: { ...mockMainnetInfo, chainName: ChainNameEnum.swarmChainName },
    }),
  );
  expect(view.queryByTestId('header.fiat')).toBeNull();
  expect(view.queryByTestId('price.card')).toBeNull();
});

test('Tests that the header shows no USD figure and no price card when the price setting is off.', () => {
  const view = render(headerUi({ showSwmPrice: false }));
  expect(view.queryByTestId('header.fiat')).toBeNull();
  expect(view.queryByTestId('price.card')).toBeNull();
});

test('Tests that the header shows no USD figure and no price card when the wallet runs offline.', () => {
  const view = render(headerUi({ selectServer: SelectServerEnum.offline }));
  expect(view.queryByTestId('header.fiat')).toBeNull();
  expect(view.queryByTestId('price.card')).toBeNull();
});

test('Tests that high privacy masks the USD balance when it is on. The price card keeps the price.', () => {
  const view = render(headerUi({ privacy: true }));
  expect(view.getByTestId('header.fiat')).toHaveTextContent('≈ $⬢⬢⬢.⬢⬢ USD');
  expect(view.getByTestId('price.value')).toHaveTextContent('$0.8411 USD');
});
