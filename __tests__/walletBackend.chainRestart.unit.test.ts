jest.mock('react-native-fs', () => ({
  DocumentDirectoryPath: '/docs',
  copyFile: jest.fn(async () => {}),
  readFile: jest.fn(async () => 'd2FsbGV0'),
  unlink: jest.fn(async () => {}),
}));

jest.mock('@app/RPCModule', () => ({
  __esModule: true,
  default: {
    getUnifiedAddressesInfo: jest.fn(),
    getTransparentAddressesInfo: jest.fn(),
  },
}));

jest.mock('@app/walletBackend/utils/walletUtils', () => ({
  __esModule: true,
  fetchWallet: jest.fn(),
  restoreWalletFromSeed: jest.fn(),
  restoreWalletFromUfvk: jest.fn(),
  createNewUnifiedAddress: jest.fn(async () => ({ ok: true, value: '{}' })),
  createNewTransparentAddress: jest.fn(async () => ({ ok: true, value: '{}' })),
  doSave: jest.fn(async () => true),
}));

jest.mock('@app/walletBackend/utils/walletFileRepair', () => ({
  WALLET_FILE_NAME: 'wallet.dat',
}));

import * as RNFS from 'react-native-fs';
import RPCModule from '@app/RPCModule';
import {
  createNewUnifiedAddress,
  doSave,
  fetchWallet,
  restoreWalletFromSeed,
  restoreWalletFromUfvk,
} from '@app/walletBackend/utils/walletUtils';
import { moveWalletToRestartedChain } from '@app/walletBackend/modules/ChainRestartService';

const unified = RPCModule.getUnifiedAddressesInfo as jest.Mock;
const transparent = RPCModule.getTransparentAddressesInfo as jest.Mock;
const keys = fetchWallet as jest.Mock;
const fromSeed = restoreWalletFromSeed as jest.Mock;
const fromUfvk = restoreWalletFromUfvk as jest.Mock;
const readFile = RNFS.readFile as jest.Mock;
const copyFile = RNFS.copyFile as jest.Mock;
const unlink = RNFS.unlink as jest.Mock;

const ua = (index: number, address: string) => ({
  account: 0,
  address_index: index,
  has_orchard: true,
  has_sapling: true,
  has_transparent: false,
  encoded_address: address,
});
const taddr = (index: number, address: string, scope = 'external') => ({
  account: 0,
  address_index: index,
  scope,
  encoded_address: address,
});

const OLD_UNIFIED = JSON.stringify([ua(1, 'swm1b'), ua(0, 'swm1a')]);
const OLD_TRANSPARENT = JSON.stringify([
  taddr(0, 's1a'),
  taddr(0, 's1change', 'internal'),
]);
const NOW = 1791230000;
const run = (readOnly = false) =>
  moveWalletToRestartedChain({
    readOnly,
    serverUri: 'https://lwd-main.swarm.green:443',
    performanceLevel: 'Medium',
    minConfirmations: '3',
    nowUnix: NOW,
  });

beforeEach(() => {
  jest.clearAllMocks();
  keys.mockResolvedValue({ seed: 'abandon words', birthday: 1200 });
  unified.mockResolvedValue(OLD_UNIFIED);
  transparent.mockResolvedValue(OLD_TRANSPARENT);
  fromSeed.mockResolvedValue({ ok: true, value: '{"seed":"x"}' });
  fromUfvk.mockResolvedValue({ ok: true, value: '{"ufvk":"x"}' });
  readFile.mockResolvedValue('d2FsbGV0');
});

test('Tests that a wallet is rebuilt from its phrase with birthday 1 on swarm-mainnet when its addresses come back the same. The old file stays as a backup.', async () => {
  await expect(run()).resolves.toEqual({
    kind: 'moved',
    backupName: `wallet.dat.before-network-restart-${NOW}.bak`,
  });
  expect(copyFile).toHaveBeenCalledWith(
    '/docs/wallet.dat',
    `/docs/wallet.dat.before-network-restart-${NOW}.bak`,
  );
  expect(fromSeed).toHaveBeenCalledWith(
    'abandon words',
    '1',
    'https://lwd-main.swarm.green:443',
    'swarm-mainnet',
    'Medium',
    '3',
  );
  expect(createNewUnifiedAddress).toHaveBeenCalledTimes(1);
  expect(createNewUnifiedAddress).toHaveBeenCalledWith('oz');
  expect(doSave).toHaveBeenCalled();
  expect(unlink).not.toHaveBeenCalled();
});

test('Tests that a viewing-key wallet is rebuilt from its viewing key when it has no phrase.', async () => {
  keys.mockResolvedValue({ ufvk: 'uview1abc', birthday: 1200 });
  await expect(run(true)).resolves.toMatchObject({ kind: 'moved' });
  expect(fromUfvk).toHaveBeenCalledWith(
    'uview1abc',
    '1',
    'https://lwd-main.swarm.green:443',
    'swarm-mainnet',
    'Medium',
    '3',
  );
  expect(fromSeed).not.toHaveBeenCalled();
});

test('Tests that nothing is touched when the wallet cannot read its keys.', async () => {
  keys.mockResolvedValue(null);
  await expect(run()).resolves.toEqual({
    kind: 'error',
    errorKey: 'chainrestart.error-keys',
  });
  expect(copyFile).not.toHaveBeenCalled();
  expect(fromSeed).not.toHaveBeenCalled();
});

test('Tests that no rebuild starts when the backup does not read back byte for byte.', async () => {
  readFile.mockResolvedValueOnce('d2FsbGV0').mockResolvedValueOnce('YnJva2Vu');
  await expect(run()).resolves.toEqual({
    kind: 'error',
    errorKey: 'chainrestart.error-backup',
  });
  expect(fromSeed).not.toHaveBeenCalled();
});

test('Tests that the old file goes back when the rebuild fails.', async () => {
  fromSeed.mockResolvedValue({ ok: true, value: '{"error":"no server"}' });
  await expect(run()).resolves.toEqual({
    kind: 'error',
    errorKey: 'chainrestart.error-rebuild',
  });
  expect(unlink).toHaveBeenCalledWith('/docs/wallet.dat');
  expect(copyFile).toHaveBeenLastCalledWith(
    `/docs/wallet.dat.before-network-restart-${NOW}.bak`,
    '/docs/wallet.dat',
  );
});

test('Tests that the old file goes back when the rebuilt wallet shows another address.', async () => {
  unified
    .mockResolvedValueOnce(OLD_UNIFIED)
    .mockResolvedValue(JSON.stringify([ua(0, 'swm1a'), ua(1, 'swm1OTHER')]));
  await expect(run()).resolves.toEqual({
    kind: 'error',
    errorKey: 'chainrestart.error-addresses',
  });
  expect(unlink).toHaveBeenCalledWith('/docs/wallet.dat');
  expect(doSave).not.toHaveBeenCalled();
});
