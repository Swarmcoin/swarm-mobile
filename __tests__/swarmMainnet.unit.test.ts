/**
 * The SWARM mainnet contract, in the three places it has to hold: which
 * networks exist, which addresses a wallet on each one may pay, and which
 * server it will talk to.
 *
 * @format
 */

import { ChainNameEnum } from '@app/AppState/enums/ChainNameEnum';
import serverUris from '@app/uris/serverUris';
import {
  DEFAULT_SWARM_PROFILE,
  SWARM_MAINNET_GENESIS,
  SWARM_MAINNET_PROFILE,
  SWARM_NETWORK_PROFILES,
  SWARM_TESTNET_PROFILE,
  selectableChainOrFallback,
  selectableSwarmProfiles,
  withoutGenesis,
} from '@app/utils/networkProfiles';
import {
  AddressRefusalEnum,
  checkAddressForChain,
  checkAddressForProfile,
} from '@app/utils/swarmAddress';
import {
  ServerRefusalEnum,
  checkServerIdentity,
  checkServerIdentityForChain,
} from '@app/utils/serverIdentity';

describe('the SWARM networks', () => {
  test('there are two, and a fresh install opens on mainnet', () => {
    expect(SWARM_NETWORK_PROFILES.map(p => p.chainLabel)).toEqual([
      'swarm-mainnet',
      'swarm-testnet',
    ]);
    expect(DEFAULT_SWARM_PROFILE).toBe(SWARM_MAINNET_PROFILE);
    expect(serverUris(() => {})[0]).toMatchObject({
      uri: 'https://lwd-main.swarm.green:443',
      chainName: ChainNameEnum.swarmMainnetChainName,
      default: true,
    });
  });

  test('no upstream Zcash server is offered anywhere', () => {
    const uris = serverUris(() => {}).map(s => s.uri);
    expect(uris).toEqual([
      'https://lwd-main.swarm.green:443',
      'https://lwd.swarm.green:443',
    ]);
    for (const uri of uris) {
      expect(uri).toContain('swarm.green');
    }
    // And no entry claims an upstream chain.
    for (const server of serverUris(() => {})) {
      expect(['swarm-mainnet', 'swarm-testnet']).toContain(server.chainName);
    }
  });

  test('the engineering testnet is named as one, and is still selectable', () => {
    expect(SWARM_TESTNET_PROFILE.displayName).toMatch(/engineering/i);
    expect(SWARM_TESTNET_PROFILE.isProduction).toBe(false);
    expect(selectableSwarmProfiles()).toHaveLength(2);
  });

  test('production carries the launched genesis', () => {
    expect(SWARM_MAINNET_PROFILE.genesis).toBe(SWARM_MAINNET_GENESIS);
    expect(SWARM_MAINNET_GENESIS).toMatch(/^[0-9a-f]{64}$/);
    expect(SWARM_MAINNET_PROFILE.unifiedHrp).toBe('swm');
    expect(SWARM_MAINNET_PROFILE.transparentPrefixes).toEqual(['s1', 's3']);
    expect(SWARM_MAINNET_PROFILE.sdkChainType).toBe('SwarmMainnet');
  });

  test('a stored label for an unlaunched network falls back, not boots', () => {
    // The shipped profiles are both launched, so this exercises the rule
    // against a copy rather than against whatever the build happens to be.
    expect(selectableChainOrFallback('swarm-mainnet')).toBe('swarm-mainnet');
    expect(selectableChainOrFallback('swarm-testnet')).toBe('swarm-testnet');
    // Upstream chains are not this function's business.
    expect(selectableChainOrFallback('main')).toBe('main');
    expect(withoutGenesis(SWARM_MAINNET_PROFILE).genesis).toBeNull();
  });
});

describe('addresses a mainnet wallet may pay', () => {
  const onMainnet = (address: string) =>
    checkAddressForProfile(address, SWARM_MAINNET_PROFILE);

  test('its own transparent addresses are accepted', () => {
    // s1/s3 are the Base58Check version bytes 0x1c28 / 0x1c2d.
    expect(onMainnet('s1MfMbqQCTtxYEVsj1SoTSo2VbCGnAdSbtB').accepted).toBe(
      true,
    );
    expect(onMainnet('s3RvY8j2pQeLbYFnW8bTsBhFqR1cLmNpKdA').accepted).toBe(
      true,
    );
  });

  test('a swarm1… testnet address is refused by name', () => {
    // A real bech32m string with the testnet HRP; only the HRP is read here.
    const verdict = onMainnet(
      'swarm1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq',
    );
    expect(verdict.accepted).toBe(false);
    if (!verdict.accepted) {
      expect(verdict.reason).toBe(AddressRefusalEnum.otherSwarmNetwork);
      expect(verdict.message).toMatch(/SWARM Testnet/);
      expect(verdict.message).toMatch(/coins sent across them are lost/);
    }
  });

  test('a Zcash mainnet transparent address is refused', () => {
    const verdict = onMainnet('t1dUDJ3AJ1bqeq2q5oxdggApbFaqjEZ8u2y');
    expect(verdict.accepted).toBe(false);
    if (!verdict.accepted) {
      expect(verdict.reason).toBe(AddressRefusalEnum.upstream);
      expect(verdict.message).toMatch(/Zcash mainnet/);
    }
  });

  test("the testnet's transparent prefixes are refused on mainnet", () => {
    for (const address of [
      'tmEZhbWHTpdKMw5it8YDspUXSMGQyFwovpU',
      't2UNzUUx8mWBCRYPRezvA363EYXyEpHokyi',
    ]) {
      const verdict = onMainnet(address);
      expect(verdict.accepted).toBe(false);
      if (!verdict.accepted) {
        expect(verdict.reason).toBe(AddressRefusalEnum.otherSwarmNetwork);
      }
    }
  });

  test("mainnet's own prefixes are refused on the testnet", () => {
    const verdict = checkAddressForProfile(
      's1MfMbqQCTtxYEVsj1SoTSo2VbCGnAdSbtB',
      SWARM_TESTNET_PROFILE,
    );
    expect(verdict.accepted).toBe(false);
    if (!verdict.accepted) {
      expect(verdict.reason).toBe(AddressRefusalEnum.otherSwarmNetwork);
    }
  });

  test('upstream Zcash chains get no verdict at all', () => {
    expect(
      checkAddressForChain('t1dUDJ3AJ1bqeq2q5oxdggApbFaqjEZ8u2y', 'main'),
    ).toBeUndefined();
    expect(checkAddressForChain('anything', 'regtest')).toBeUndefined();
  });
});

describe('the server this wallet will talk to', () => {
  test('the right chain passes', () => {
    expect(
      checkServerIdentityForChain('swarm-mainnet', {
        chain_name: 'swarm-mainnet',
        server_uri: 'https://lwd-main.swarm.green:443',
      }),
    ).toEqual({ ok: true });
  });

  test('a testnet indexer is refused by a mainnet wallet', () => {
    const verdict = checkServerIdentityForChain('swarm-mainnet', {
      chain_name: 'swarm-testnet',
      server_uri: 'https://lwd.swarm.green:443',
    });
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) {
      expect(verdict.reason).toBe(ServerRefusalEnum.wrongChain);
      expect(verdict.message).toContain('lwd.swarm.green:443');
      expect(verdict.message).toMatch(/SWARM Mainnet/);
    }
  });

  test('right label, wrong first block, is refused', () => {
    const verdict = checkServerIdentityForChain('swarm-mainnet', {
      chain_name: 'swarm-mainnet',
      server_uri: 'https://impostor.example:8443',
      genesis_hash: 'ab'.repeat(32),
    });
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) {
      expect(verdict.reason).toBe(ServerRefusalEnum.wrongGenesis);
    }
  });

  test('a server that names no chain is refused, not trusted', () => {
    const verdict = checkServerIdentityForChain('swarm-mainnet', {
      server_uri: 'https://quiet.example:8443',
    });
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) {
      expect(verdict.reason).toBe(ServerRefusalEnum.silent);
    }
  });

  test('a wallet on an upstream chain is named, not adopted', () => {
    const verdict = checkServerIdentityForChain('main', {
      chain_name: 'main',
    });
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) {
      expect(verdict.message).toMatch(/not a SWARM wallet/i);
      expect(verdict.message).toMatch(/recovery phrase still opens it/);
    }
  });

  test('an unlaunched profile holds no server to anything', () => {
    const verdict = checkServerIdentity(
      withoutGenesis(SWARM_MAINNET_PROFILE),
      { chain_name: 'swarm-mainnet' },
      'swarm-mainnet',
    );
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) {
      expect(verdict.reason).toBe(ServerRefusalEnum.profileNotLaunched);
    }
  });
});
