/**
 * @format
 */

import 'react-native';
import React from 'react';

import { render } from '@testing-library/react-native';
import Settings from '@screens/Settings';
import {
  defaultAppContextLoaded,
  ContextAppLoadedProvider,
} from '@app/context';
import {
  BlockExplorerEnum,
  ChainNameEnum,
  CurrencyEnum,
  LanguageEnum,
  RouteEnum,
} from '@app/AppState';
import { mockTranslate } from '../__mocks__/dataMocks/mockTranslate';
import { mockInfo } from '../__mocks__/dataMocks/mockInfo';
import { mockTotalBalance } from '../__mocks__/dataMocks/mockTotalBalance';
import { mockServer } from '../__mocks__/dataMocks/mockServer';
import mockNavigation from '../__mocks__/dataMocks/mockNavigation';

// The catalogue key itself for every plain string, so the test reads which
// entry the panel asked for.
const translateToKey = (key: string) => {
  const mocked = mockTranslate(key);
  return mocked === 'text translated' ? key : mocked;
};

const renderWithServerChain = (chainName: ChainNameEnum) => {
  const state = {
    ...defaultAppContextLoaded,
    translate: translateToKey,
    info: { ...mockInfo, chainName },
    totalBalance: mockTotalBalance,
    server: mockServer,
    currency: CurrencyEnum.USDCurrency,
    language: LanguageEnum.en,
    blockExplorer: BlockExplorerEnum.Swarmexplorer,
  };
  const set = jest.fn();
  return render(
    <ContextAppLoadedProvider value={state}>
      <Settings
        navigation={mockNavigation}
        route={{ key: 'Key-1', name: RouteEnum.Settings, params: undefined }}
        setServerOption={set}
        setCurrencyOption={set}
        setLanguageOption={set}
        setSendAllOption={set}
        setDonationOption={set}
        setSecurityOption={set}
        setSelectServerOption={set}
        setRescanMenuOption={set}
        setRecoveryWalletInfoOnDeviceOption={set}
        setPerformanceLevelOption={set}
        setBlockExplorerOption={set}
        setNymOption={set}
        toggleMenuDrawer={set}
      />
    </ContextAppLoadedProvider>,
  );
};

// The network picker lists both SWARM networks too, so a render whose server
// reports regtest counts the picker's copies of each name.
const pickerCopies = (key: string) =>
  renderWithServerChain(ChainNameEnum.regtestChainName).getAllByText(key)
    .length;

describe('the Settings server panel', () => {
  test('names SWARM Mainnet when the server reports swarm-mainnet', () => {
    const key = 'settings.value-chainname-swarm-mainnet';
    const copies = pickerCopies(key);
    const screen = renderWithServerChain(ChainNameEnum.swarmMainnetChainName);
    expect(screen.queryByText('info.unknown (swarm-mainnet)')).toBeNull();
    expect(screen.getAllByText(key)).toHaveLength(copies + 1);
  });

  test('names the engineering testnet when the server reports swarm-testnet', () => {
    const key = 'settings.value-chainname-swarm-testnet';
    const copies = pickerCopies(key);
    const screen = renderWithServerChain(ChainNameEnum.swarmChainName);
    expect(screen.queryByText('info.unknown (swarm-testnet)')).toBeNull();
    expect(screen.getAllByText(key)).toHaveLength(copies + 1);
  });
});
