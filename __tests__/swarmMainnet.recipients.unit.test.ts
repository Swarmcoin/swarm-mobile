/**
 * Every place a typed or scanned recipient is judged, on a SWARM Mainnet
 * wallet: the Send field, the address book and swap inputs, and a scanned
 * QR code. Each of them asks the Rust `parse_address` and compares its
 * `chain_name` with the wallet's own chain. The answers below are the ones
 * `rust/lib/src/swarm_prefix_tests.rs` pins for the same strings.
 *
 * @format
 */

jest.mock('@app/RPCModule', () => ({
  __esModule: true,
  default: {
    parseAddressInfo: jest.fn(),
  },
}));

import RPCModule from '@app/RPCModule';
import Utils from '@app/utils';
import { ChainNameEnum, ServerType } from '@app/AppState';
import parseZcashURI from '@app/uris/parseZcashURI';
import { validateAddressForChain } from '@app/swap/validateAddressForChain';

const MAINNET_UNIFIED =
  'swm1q4q6yr3rvnnqw64tqktf7plq86cnmdxezv2g5wjerfpratclfv87guyfqru4vf775ykqd8q9e7uzscmns7w6q2fpxwl5up0ez5xqe5gv';
const MAINNET_P2PKH = 's1UsiRFq4FrtHUbHobXxssCN7EVCcu9GvFk';
const TESTNET_P2PKH = 'tm9iMLAuYMzJ6jtFLcA7rzUmfreGuKvr7Ma';
const ZCASH_P2PKH = 't1Hsc1LR8yKnbbe3twRp88p6vFfC5t7DLbs';

const answers: Record<string, object> = {
  [MAINNET_UNIFIED]: {
    status: 'success',
    chain_name: 'swarm-mainnet',
    address_kind: 'unified',
    receivers_available: ['orchard'],
    shielded_only_ua: MAINNET_UNIFIED,
  },
  [MAINNET_P2PKH]: {
    status: 'success',
    chain_name: 'swarm-mainnet',
    address_kind: 'transparent',
  },
  [TESTNET_P2PKH]: {
    status: 'success',
    chain_name: 'swarm-testnet',
    address_kind: 'transparent',
  },
  [ZCASH_P2PKH]: {
    status: 'Invalid address',
    chain_name: null,
    address_kind: null,
  },
};

const mainnetServer: ServerType = {
  uri: 'https://lwd-main.swarm.green:443',
  chainName: ChainNameEnum.swarmMainnetChainName,
};

const testnetServer: ServerType = {
  uri: 'https://lwd.swarm.green:443',
  chainName: ChainNameEnum.swarmChainName,
};

beforeEach(() => {
  (RPCModule.parseAddressInfo as jest.Mock).mockImplementation(
    async (address: string) => JSON.stringify(answers[address] ?? {}),
  );
});

describe('the Send field on a SWARM Mainnet wallet', () => {
  test('accepts a swm1 unified address when parse_address names swarm-mainnet', async () => {
    expect(
      await Utils.isValidAddress(
        MAINNET_UNIFIED,
        ChainNameEnum.swarmMainnetChainName,
      ),
    ).toEqual({ isValid: true, shieldedOnlyUA: '' });
    expect(RPCModule.parseAddressInfo).toHaveBeenCalledWith(MAINNET_UNIFIED);
  });

  test('accepts an s1 transparent address when parse_address names swarm-mainnet', async () => {
    const verdict = await Utils.isValidAddress(
      MAINNET_P2PKH,
      ChainNameEnum.swarmMainnetChainName,
    );
    expect(verdict.isValid).toBe(true);
  });

  test('refuses a testnet or Zcash address when parse_address names another chain or none', async () => {
    for (const address of [TESTNET_P2PKH, ZCASH_P2PKH]) {
      const verdict = await Utils.isValidAddress(
        address,
        ChainNameEnum.swarmMainnetChainName,
      );
      expect(verdict.isValid).toBe(false);
    }
  });

  test('offers a memo when the recipient is shielded and not when it is transparent', async () => {
    expect(
      await Utils.isValidOrchardOrSaplingAddress(
        MAINNET_UNIFIED,
        ChainNameEnum.swarmMainnetChainName,
      ),
    ).toBe(true);
    expect(
      await Utils.isValidOrchardOrSaplingAddress(
        MAINNET_P2PKH,
        ChainNameEnum.swarmMainnetChainName,
      ),
    ).toBe(false);
  });
});

describe('the same addresses on a SWARM Testnet wallet', () => {
  test('are refused when the wallet chain is swarm-testnet', async () => {
    for (const address of [MAINNET_UNIFIED, MAINNET_P2PKH]) {
      const verdict = await Utils.isValidAddress(
        address,
        ChainNameEnum.swarmChainName,
      );
      expect(verdict.isValid).toBe(false);
    }
  });
});

describe('the address book and swap inputs on a SWARM Mainnet wallet', () => {
  test('accept both mainnet recipients and refuse the testnet one when the chain is SWM', async () => {
    const check = (address: string) =>
      validateAddressForChain(
        'ZEC',
        address,
        ChainNameEnum.swarmMainnetChainName,
      );
    expect(await check(MAINNET_UNIFIED)).toBe(true);
    expect(await check(` ${MAINNET_P2PKH} `)).toBe(true);
    expect(await check(TESTNET_P2PKH)).toBe(false);
  });
});

describe('a scanned QR code on a SWARM Mainnet wallet', () => {
  // ScannerAddress prefixes a bare scanned address with `zcash:` before the
  // Send screen parses it as a payment URI.
  test('fills the recipient when the code holds a bare swm1 address', async () => {
    const parsed = await parseZcashURI(
      `zcash:${MAINNET_UNIFIED}`,
      mainnetServer,
    );
    expect(parsed.kind).toBe('paymentTarget');
    if (parsed.kind === 'paymentTarget') {
      expect(parsed.target.address).toBe(MAINNET_UNIFIED);
    }
  });

  test('fills the recipient and the amount when the code is a payment URI to an s1 address', async () => {
    const parsed = await parseZcashURI(
      `zcash:${MAINNET_P2PKH}?amount=1.5`,
      mainnetServer,
    );
    expect(parsed.kind).toBe('paymentTarget');
    if (parsed.kind === 'paymentTarget') {
      expect(parsed.target.address).toBe(MAINNET_P2PKH);
      expect(parsed.target.amount).toBe(1.5);
    }
  });

  test('is refused when the wallet is on the other SWARM network', async () => {
    const parsed = await parseZcashURI(
      `zcash:${MAINNET_UNIFIED}`,
      testnetServer,
    );
    expect(parsed).toMatchObject({ kind: 'error', errorKey: 'uris.notvalid' });
  });
});
