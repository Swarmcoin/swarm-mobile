import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  acknowledgeRiskNotice,
  hasAcknowledgedRiskNotice,
} from '@app/legal/riskNotice';
import {
  SWARM_MAINNET_PROFILE,
  SWARM_TESTNET_PROFILE,
} from '@app/utils/networkProfiles';

jest.mock('@react-native-async-storage/async-storage', () => {
  const entries = new Map<string, string>();
  return {
    getItem: jest.fn(async (key: string) => entries.get(key)),
    setItem: jest.fn(async (key: string, entry: string) => {
      entries.set(key, entry);
    }),
  };
});

test('Tests that mainnet requires its own acknowledgement when the testnet notice was accepted.', async () => {
  await acknowledgeRiskNotice(SWARM_TESTNET_PROFILE.chainLabel);
  expect(
    await hasAcknowledgedRiskNotice(SWARM_TESTNET_PROFILE.chainLabel),
  ).toBe(true);
  expect(
    await hasAcknowledgedRiskNotice(SWARM_MAINNET_PROFILE.chainLabel),
  ).toBe(false);
  await acknowledgeRiskNotice(SWARM_MAINNET_PROFILE.chainLabel);
  expect(
    await hasAcknowledgedRiskNotice(SWARM_MAINNET_PROFILE.chainLabel),
  ).toBe(true);
  expect(AsyncStorage.setItem).toHaveBeenCalledTimes(2);
});
