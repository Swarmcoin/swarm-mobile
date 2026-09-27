import { serverForWallet } from '@app/utils/walletServer';
import {
  SWARM_MAINNET_PROFILE,
  SWARM_TESTNET_PROFILE,
} from '@app/utils/networkProfiles';

const mainnet = {
  uri: SWARM_MAINNET_PROFILE.defaultServer,
  chainName: SWARM_MAINNET_PROFILE.chainLabel,
};
const testnet = {
  uri: SWARM_TESTNET_PROFILE.defaultServer,
  chainName: SWARM_TESTNET_PROFILE.chainLabel,
};

test('Tests that the testnet server returns when a saved testnet wallet opens after mainnet.', () => {
  expect(serverForWallet(testnet.chainName, mainnet)).toEqual(testnet);
});

test('Tests that the mainnet server returns when a saved mainnet wallet opens after testnet.', () => {
  expect(serverForWallet(mainnet.chainName, testnet)).toEqual(mainnet);
});

test('Tests that a custom server remains selected when its chain matches the wallet.', () => {
  const custom = { ...mainnet, uri: 'https://wallet.example:8443' };
  expect(serverForWallet(mainnet.chainName, custom)).toBe(custom);
});

test('Tests that offline mode remains selected when a wallet on another chain opens.', () => {
  expect(serverForWallet(testnet.chainName, { ...mainnet, uri: '' })).toEqual({
    ...testnet,
    uri: '',
  });
});
