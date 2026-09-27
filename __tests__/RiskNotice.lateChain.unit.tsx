/**
 * @format
 *
 * The gate can be opened by a button pressed before the settings read that
 * fills the chain in has landed, so `chain` arrives late or not at all. What
 * must never happen is the case this test exists for: the notice is asked for
 * and nothing appears, leaving the person on the previous screen with a
 * button that does nothing and no wallet.
 */

import 'react-native';
import React from 'react';

import { render } from '@testing-library/react-native';

import RiskNotice from '@ui/widgets/RiskNotice';
import { riskNoticeParagraphs, RISK_NOTICE_TITLE } from '@app/legal/riskNotice';
import {
  DEFAULT_SWARM_PROFILE,
  SWARM_MAINNET_PROFILE,
  SWARM_TESTNET_PROFILE,
} from '@app/utils/networkProfiles';
import { ChainNameEnum } from '@app/AppState/enums/ChainNameEnum';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

const noop = () => {};

describe('riskNoticeParagraphs with no chain yet', () => {
  const defaultText = riskNoticeParagraphs(
    DEFAULT_SWARM_PROFILE.chainLabel,
  ).join('\n');

  // Written against DEFAULT_SWARM_PROFILE rather than against the mainnet
  // wording, so the rule survives a build that ships a different default.
  test.each([
    ['undefined', undefined],
    ['null', null],
    ['the empty Offline chain', ''],
  ])('%s falls back to the profile this build is for', (_name, chain) => {
    expect(riskNoticeParagraphs(chain).join('\n')).toBe(defaultText);
  });

  test('no argument at all is the same fallback', () => {
    expect(riskNoticeParagraphs().join('\n')).toBe(defaultText);
  });

  // The other direction, and it is a different case: a chain that IS named and
  // has no SWARM profile keeps the cautious text.
  test('a named non-SWARM chain still gets the testnet caution', () => {
    expect(riskNoticeParagraphs(ChainNameEnum.mainChainName)).toBe(
      riskNoticeParagraphs(SWARM_TESTNET_PROFILE.chainLabel),
    );
  });
});

describe('RiskNotice renders whatever the chain is', () => {
  test('with no chain prop it still shows the notice, and the default text', () => {
    const { getByTestId, getByText } = render(
      <RiskNotice mode="gate" onDismiss={noop} />,
    );
    expect(getByTestId('risknotice.title')).toBeTruthy();
    expect(getByText(RISK_NOTICE_TITLE)).toBeTruthy();
    expect(getByTestId('risknotice.acknowledge')).toBeTruthy();
    // The bold lead-in of the first paragraph is its own <Text>, so it is the
    // one whole string on screen that identifies which notice this is.
    const leadIn = /\*\*([^*]+)\*\*/.exec(
      riskNoticeParagraphs(DEFAULT_SWARM_PROFILE.chainLabel)[0],
    )?.[1];
    expect(leadIn).toBeTruthy();
    expect(getByText(String(leadIn))).toBeTruthy();
  });

  test('on a mainnet chain it says the network is live', () => {
    const { getByText } = render(
      <RiskNotice
        mode="gate"
        chain={SWARM_MAINNET_PROFILE.chainLabel}
        onDismiss={noop}
      />,
    );
    expect(getByText(RISK_NOTICE_TITLE)).toBeTruthy();
    expect(getByText(/SWARM Mainnet is the live network/)).toBeTruthy();
  });

  test('on the engineering testnet it says the coins have no value', () => {
    const { getByText } = render(
      <RiskNotice
        mode="gate"
        chain={SWARM_TESTNET_PROFILE.chainLabel}
        onDismiss={noop}
      />,
    );
    expect(getByText(RISK_NOTICE_TITLE)).toBeTruthy();
    expect(getByText(/SWM test coins have no value/)).toBeTruthy();
  });
});
