jest.mock('@ui/widgets/priceFetcherStore', () => ({
  __esModule: true,
  PRICE_REFRESH_MAX_MS: 65_000,
  PRICE_STALE_MS: 5 * 60_000,
  priceFetcherStore: {
    setDeps: jest.fn(),
    attach: jest.fn(() => () => {}),
    subscribe: jest.fn(() => () => {}),
    snapshot: jest.fn(() => ({
      loading: false,
      nextFetchAt: 0,
      nextFetchDelayMs: 0,
      surfaceActive: false,
      lastErrorKey: undefined,
    })),
    foregroundReturned: jest.fn(),
  },
  usePriceFetcherStore: jest.fn(() => ({
    loading: false,
    nextFetchAt: 0,
    nextFetchDelayMs: 0,
    surfaceActive: false,
    lastErrorKey: undefined,
  })),
  usePriceHealth: jest.fn(() => 'live'),
  usePriceFreshness: jest.fn(() => 'fresh'),
}));

import 'react-native';
import React from 'react';
import { render } from '@testing-library/react-native';
import Send from '@screens/Send';
import Confirm from '@screens/Confirm';
import {
  ContextAppLoadedProvider,
  defaultAppContextLoaded,
} from '@app/context';
import {
  ChainNameEnum,
  CurrencyEnum,
  ModeEnum,
  RouteEnum,
  ZecPriceType,
} from '@app/AppState';
import {
  priceFreshness,
  usePriceFreshness,
  usePriceHealth,
} from '@ui/widgets/priceFetcherStore';
import { mockValueTransfers } from '../__mocks__/dataMocks/mockValueTransfers';
import { mockAddresses } from '../__mocks__/dataMocks/mockAddresses';
import { mockTranslate } from '../__mocks__/dataMocks/mockTranslate';
import { mockTotalBalance } from '../__mocks__/dataMocks/mockTotalBalance';
import { mockServer } from '../__mocks__/dataMocks/mockServer';
import mockSendPageState from '../__mocks__/dataMocks/mockSendPageState';
import {
  mockMainnetInfo,
  mockSwmPrice,
} from '../__mocks__/dataMocks/mockSwmPrice';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppDrawerParamList } from '@app/types';
import mockNavigation from '../__mocks__/dataMocks/mockNavigation';

const realStore: { priceFreshness: typeof priceFreshness } = jest.requireActual(
  '@ui/widgets/priceFetcherStore',
);
const freshnessHook = usePriceFreshness as jest.MockedFunction<
  typeof usePriceFreshness
>;
const healthHook = usePriceHealth as jest.MockedFunction<typeof usePriceHealth>;

function makeDrawerProps(): NativeStackScreenProps<
  AppDrawerParamList,
  RouteEnum.Send
> {
  return {
    navigation: mockNavigation,
    route: {
      key: 'Key-1',
      name: RouteEnum.Send,
      params: undefined,
    },
  };
}

type Over = Partial<typeof defaultAppContextLoaded>;

const onFunction = jest.fn();
const sendUi = (zecPrice: ZecPriceType, over: Over = {}) => {
  const state = {
    ...defaultAppContextLoaded,
    valueTransfers: mockValueTransfers,
    addresses: mockAddresses,
    translate: mockTranslate,
    info: mockMainnetInfo,
    server: { ...mockServer, chainName: ChainNameEnum.swarmMainnetChainName },
    totalBalance: mockTotalBalance,
    sendPageState: mockSendPageState,
    mode: ModeEnum.advanced,
    zecPrice,
    ...over,
  };
  return (
    <ContextAppLoadedProvider value={state}>
      <Send
        {...makeDrawerProps()}
        sendTransaction={onFunction}
        clearToAddr={onFunction}
        toggleMenuDrawer={onFunction}
        setShieldingAmount={onFunction}
        setScrollToTop={onFunction}
        setScrollToBottom={onFunction}
        setServerOption={onFunction}
        setSecurityOption={onFunction}
      />
    </ContextAppLoadedProvider>
  );
};

beforeEach(() => {
  freshnessHook.mockImplementation(price =>
    realStore.priceFreshness(price, Date.now()),
  );
  healthHook.mockImplementation(priceDate =>
    priceDate === 0
      ? 'absent'
      : priceDate !== undefined && Date.now() - priceDate > 5 * 60_000
        ? 'stale'
        : 'live',
  );
  const { NativeModules } = require('react-native');
  NativeModules.RPCModule.getDonationAddress = jest.fn(async () => '{}');
});

test('Tests that Send shows the amount in USD under the amount field when the wallet is on SWARM Mainnet. The line is read-only.', () => {
  const view = render(sendUi(mockSwmPrice(Date.now())));

  expect(view.getByTestId('send.fiat')).toHaveTextContent(/^≈ \$.* USD$/);
  expect(view.queryByTestId('send.swap-entry')).toBeNull();
});

test('Tests that Send shows no USD line when the wallet is on SWARM Testnet.', () => {
  const view = render(
    sendUi(mockSwmPrice(Date.now()), {
      info: { ...mockMainnetInfo, chainName: ChainNameEnum.swarmChainName },
    }),
  );
  expect(view.queryByTestId('send.fiat')).toBeNull();
});

test('Tests that Send shows no USD line when the price setting is off.', () => {
  const view = render(
    sendUi(mockSwmPrice(Date.now()), { showSwmPrice: false }),
  );
  expect(view.queryByTestId('send.fiat')).toBeNull();
});

test('Tests that Send shows no USD line and no ring when no price ever arrived.', () => {
  const view = render(sendUi({ zecPrice: 0, date: 0 }));
  expect(view.queryByTestId('send.fiat')).toBeNull();
  expect(view.queryByTestId('pricefetcher.ring')).toBeNull();
});

test('Tests that Send hides the USD line when the last price is more than an hour old.', () => {
  const view = render(sendUi(mockSwmPrice(Date.now() - 61 * 60_000)));
  expect(view.queryByTestId('send.fiat')).toBeNull();
});

test('Tests that Send masks the USD value when high privacy is on. The price itself stays out of the mask.', () => {
  const view = render(sendUi(mockSwmPrice(Date.now()), { privacy: true }));
  expect(view.getByTestId('send.fiat')).toHaveTextContent('≈ $⬢⬢⬢.⬢⬢ USD');
});

test('Tests that the send-confirmation conversions dim when the price is stale.', () => {
  const state = {
    ...defaultAppContextLoaded,
    translate: mockTranslate,
    info: mockMainnetInfo,
    totalBalance: mockTotalBalance,
    server: mockServer,
    sendPageState: mockSendPageState,
    currency: CurrencyEnum.noCurrency,
    mode: ModeEnum.advanced,
    zecPrice: mockSwmPrice(Date.now() - 40 * 60_000),
    security: { ...defaultAppContextLoaded.security, sendConfirm: false },
  };
  const confirmProps: React.ComponentProps<typeof Confirm> = {
    navigation: mockNavigation,
    route: {
      key: 'Key-1',
      name: RouteEnum.Confirm,
      params: {
        calculatedFee: 0.00001,
        proposalPools: { source: ['ironwood'], destination: ['ironwood'] },
        donationAmount: 0,
        confirmSend: jest.fn(async () => {}),
        sendAllAmount: false,
        calculateFeeWithPropose: jest.fn(async () => {}),
        sendPageState: mockSendPageState,
        nym: true,
      },
    },
  };
  const view = render(
    <ContextAppLoadedProvider value={state}>
      <Confirm {...confirmProps} />
    </ContextAppLoadedProvider>,
  );

  const { StyleSheet } = require('react-native');
  const conversions = view
    .getAllByText(/^\$ /)
    .map(t => StyleSheet.flatten(t.props.style));
  expect(conversions.length).toBeGreaterThan(0);
  conversions.forEach(s => expect(s.color).toBe('#888888'));
});

test('Tests that Confirm shows no USD conversion when the wallet is on SWARM Testnet.', () => {
  const state = {
    ...defaultAppContextLoaded,
    translate: mockTranslate,
    info: { ...mockMainnetInfo, chainName: ChainNameEnum.swarmChainName },
    totalBalance: mockTotalBalance,
    server: mockServer,
    sendPageState: mockSendPageState,
    mode: ModeEnum.advanced,
    zecPrice: mockSwmPrice(Date.now()),
    security: { ...defaultAppContextLoaded.security, sendConfirm: false },
  };
  const view = render(
    <ContextAppLoadedProvider value={state}>
      <Confirm
        navigation={mockNavigation}
        route={{
          key: 'Key-1',
          name: RouteEnum.Confirm,
          params: {
            calculatedFee: 0.00001,
            proposalPools: { source: ['ironwood'], destination: ['ironwood'] },
            donationAmount: 0,
            confirmSend: jest.fn(async () => {}),
            sendAllAmount: false,
            calculateFeeWithPropose: jest.fn(async () => {}),
            sendPageState: mockSendPageState,
            nym: true,
          },
        }}
      />
    </ContextAppLoadedProvider>,
  );
  expect(view.queryAllByText(/^\$ /)).toHaveLength(0);
});
