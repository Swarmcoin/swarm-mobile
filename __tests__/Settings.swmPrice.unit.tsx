import 'react-native';
import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
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
  ModeEnum,
  RouteEnum,
} from '@app/AppState';
import { mockTranslate } from '../__mocks__/dataMocks/mockTranslate';
import { mockTotalBalance } from '../__mocks__/dataMocks/mockTotalBalance';
import { mockServer } from '../__mocks__/dataMocks/mockServer';
import { mockMainnetInfo } from '../__mocks__/dataMocks/mockSwmPrice';
import mockNavigation from '../__mocks__/dataMocks/mockNavigation';

const translateToKey = (key: string) => {
  const mocked = mockTranslate(key);
  return mocked === 'text translated' ? key : mocked;
};

const renderSettings = (
  walletChainName: ChainNameEnum,
  mode: ModeEnum,
  setShowSwmPriceOption: (value: boolean) => Promise<void>,
) => {
  const state = {
    ...defaultAppContextLoaded,
    translate: translateToKey,
    info: { ...mockMainnetInfo, chainName: walletChainName },
    totalBalance: mockTotalBalance,
    server: { ...mockServer, chainName: walletChainName },
    walletChainName,
    mode,
    currency: CurrencyEnum.USDCurrency,
    language: LanguageEnum.en,
    blockExplorer: BlockExplorerEnum.Swarmexplorer,
    showSwmPrice: true,
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
        setShowSwmPriceOption={setShowSwmPriceOption}
        toggleMenuDrawer={set}
      />
    </ContextAppLoadedProvider>,
  );
};

describe('the SWM price setting', () => {
  test.each([ModeEnum.basic, ModeEnum.advanced])(
    'Tests that the switch shows, on by default, when a SWARM Mainnet wallet is in %s mode.',
    mode => {
      const view = renderSettings(
        ChainNameEnum.swarmMainnetChainName,
        mode,
        jest.fn(),
      );
      expect(view.getByText('settings.swmprice-title')).toBeTruthy();
      expect(
        view.getByTestId('settings.swmprice').props.accessibilityState,
      ).toEqual({
        checked: true,
      });
    },
  );

  test('Tests that the switch is absent when the wallet is on SWARM Testnet.', () => {
    const view = renderSettings(
      ChainNameEnum.swarmChainName,
      ModeEnum.advanced,
      jest.fn(),
    );
    expect(view.queryByTestId('settings.swmprice')).toBeNull();
  });

  test('Tests that the info button shows what the price request sends when it is pressed.', () => {
    const view = renderSettings(
      ChainNameEnum.swarmMainnetChainName,
      ModeEnum.basic,
      jest.fn(),
    );
    expect(view.queryByText('settings.swmprice-help')).toBeNull();
    fireEvent.press(view.getByTestId('settings.swmprice-info'));
    expect(view.getByText('settings.swmprice-help')).toBeTruthy();
  });

  test('Tests that the switch turns off when it is pressed. Saving goes through the light-settings batch.', () => {
    const save = jest.fn(async () => {});
    const view = renderSettings(
      ChainNameEnum.swarmMainnetChainName,
      ModeEnum.advanced,
      save,
    );
    fireEvent.press(view.getByTestId('settings.swmprice'));
    expect(
      view.getByTestId('settings.swmprice').props.accessibilityState,
    ).toEqual({
      checked: false,
    });
    expect(save).not.toHaveBeenCalled();
  });
});
