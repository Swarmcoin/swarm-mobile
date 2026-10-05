/** Moves a wallet made on the abandoned SWARM Mainnet chain onto the chain restarted on 2026-10-02. */
import * as RNFS from 'react-native-fs';
import RPCModule from '@app/RPCModule';
import { ChainNameEnum } from '@app/AppState/enums/ChainNameEnum';
import { ErrorKeyed, errorKeyed } from '@app/AppState/types/Result';
import { RPCUnifiedAddressType } from '@app/walletBackend/types/RPCUnifiedAddressType';
import { RPCTransparentAddressType } from '@app/walletBackend/types/RPCTransparentAddressType';
import { RPCAddressScopeEnum } from '@app/walletBackend/enums/RPCAddressScopeEnum';
import { WALLET_FILE_NAME } from '@app/walletBackend/utils/walletFileRepair';
import {
  createNewTransparentAddress,
  createNewUnifiedAddress,
  doSave,
  fetchWallet,
  restoreWalletFromSeed,
  restoreWalletFromUfvk,
} from '@app/walletBackend/utils/walletUtils';

export type ChainRestartErrorKey =
  | 'chainrestart.error-keys'
  | 'chainrestart.error-backup'
  | 'chainrestart.error-rebuild'
  | 'chainrestart.error-addresses';

export type ChainRestartOutcome =
  { kind: 'moved'; backupName: string } | ErrorKeyed<ChainRestartErrorKey>;

type ReceiveAddresses = {
  unified: RPCUnifiedAddressType[];
  transparent: RPCTransparentAddressType[];
};

const REBUILD_BIRTHDAY = '1';

const byIndex = <T extends { address_index: number }>(list: T[]): T[] =>
  [...list].sort((a, b) => a.address_index - b.address_index);

async function receiveAddresses(): Promise<ReceiveAddresses> {
  const unified: RPCUnifiedAddressType[] = JSON.parse(
    (await RPCModule.getUnifiedAddressesInfo()) || '[]',
  );
  const transparent: RPCTransparentAddressType[] = JSON.parse(
    (await RPCModule.getTransparentAddressesInfo()) || '[]',
  );
  return {
    unified: byIndex(unified),
    transparent: byIndex(
      transparent.filter(t => t.scope === RPCAddressScopeEnum.external),
    ),
  };
}

// Derives the old wallet's further addresses in the rebuilt one, index by index.
async function deriveFurther(before: ReceiveAddresses): Promise<boolean> {
  for (const ua of before.unified.slice(1)) {
    const made = await createNewUnifiedAddress(
      `${ua.has_orchard ? 'o' : ''}${ua.has_sapling ? 'z' : ''}`,
    );
    if (!made.ok) {
      return false;
    }
  }
  for (let i = 1; i < before.transparent.length; i++) {
    const made = await createNewTransparentAddress();
    if (!made.ok) {
      return false;
    }
  }
  return true;
}

/** True when the rebuilt wallet receives at exactly the addresses the old one did. */
export const sameReceiveAddresses = (
  before: ReceiveAddresses,
  after: ReceiveAddresses,
): boolean =>
  before.unified.length > 0 &&
  before.unified.length === after.unified.length &&
  before.transparent.length === after.transparent.length &&
  before.unified.every(
    (ua, i) => ua.encoded_address === after.unified[i].encoded_address,
  ) &&
  before.transparent.every(
    (t, i) => t.encoded_address === after.transparent[i].encoded_address,
  );

const rebuiltCleanly = (reply: string): boolean => {
  try {
    const parsed: { error?: string } = JSON.parse(reply);
    return !parsed.error;
  } catch {
    return false;
  }
};

async function putBack(walletPath: string, backupPath: string): Promise<void> {
  await RNFS.unlink(walletPath);
  await RNFS.copyFile(backupPath, walletPath);
}

/**
 * Rebuilds the open wallet from its own phrase or viewing key with birthday 1,
 * after a byte-for-byte backup, and puts the old file back on any failure.
 */
export async function moveWalletToRestartedChain(params: {
  readOnly: boolean;
  serverUri: string;
  performanceLevel: string;
  minConfirmations: string;
  nowUnix: number;
}): Promise<ChainRestartOutcome> {
  const keys = await fetchWallet(params.readOnly);
  const secret = params.readOnly ? keys?.ufvk : keys?.seed;
  if (!secret) {
    return errorKeyed('chainrestart.error-keys');
  }
  let before: ReceiveAddresses;
  try {
    before = await receiveAddresses();
  } catch {
    return errorKeyed('chainrestart.error-keys');
  }

  const walletPath = `${RNFS.DocumentDirectoryPath}/${WALLET_FILE_NAME}`;
  const backupName = `${WALLET_FILE_NAME}.before-network-restart-${params.nowUnix}.bak`;
  const backupPath = `${RNFS.DocumentDirectoryPath}/${backupName}`;
  try {
    await RNFS.copyFile(walletPath, backupPath);
    const [original, copy] = await Promise.all([
      RNFS.readFile(walletPath, 'base64'),
      RNFS.readFile(backupPath, 'base64'),
    ]);
    if (original !== copy) {
      return errorKeyed('chainrestart.error-backup');
    }
  } catch {
    return errorKeyed('chainrestart.error-backup');
  }

  const rebuild = params.readOnly
    ? restoreWalletFromUfvk
    : restoreWalletFromSeed;
  const rebuilt = await rebuild(
    secret,
    REBUILD_BIRTHDAY,
    params.serverUri,
    ChainNameEnum.swarmMainnetChainName,
    params.performanceLevel,
    params.minConfirmations,
  );
  if (!rebuilt.ok || !rebuiltCleanly(rebuilt.value)) {
    await putBack(walletPath, backupPath);
    return errorKeyed('chainrestart.error-rebuild');
  }

  let after: ReceiveAddresses;
  try {
    if (!(await deriveFurther(before))) {
      await putBack(walletPath, backupPath);
      return errorKeyed('chainrestart.error-addresses');
    }
    after = await receiveAddresses();
  } catch {
    await putBack(walletPath, backupPath);
    return errorKeyed('chainrestart.error-addresses');
  }
  if (!sameReceiveAddresses(before, after)) {
    await putBack(walletPath, backupPath);
    return errorKeyed('chainrestart.error-addresses');
  }
  if (!(await doSave())) {
    await putBack(walletPath, backupPath);
    return errorKeyed('chainrestart.error-rebuild');
  }
  return { kind: 'moved', backupName };
}
