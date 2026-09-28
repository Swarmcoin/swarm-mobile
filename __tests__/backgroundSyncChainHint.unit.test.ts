/**
 * The nightly background sync opens the wallet outside the app, from
 * settings.json, whose `server.chainName` is the chain LABEL. For SWARM
 * Mainnet the label is not what the native library opens a wallet with: it
 * refuses a bare `swarm-mainnet` and wants `swarm-mainnet:<genesis>`. The
 * app's own loaders go through `nativeChainHint`
 * (`__tests__/nativeChainHint.unit.test.ts`); the two native background
 * loaders have no JS layer, and this file holds them to the library's network
 * identity by reading their source.
 *
 * @format
 */

import { readFileSync } from 'fs';
import { join } from 'path';

const source = (path: string): string =>
  readFileSync(join(__dirname, '..', path), 'utf8');

// The name a loader call passes as its chain argument.
const chainArgument = (text: string, call: RegExp): string => {
  const match = text.match(call);
  if (!match) {
    throw new Error(`no wallet load matching ${call}`);
  }
  return match[1];
};

// What the loader assigned to that name, up to the end of the line.
const assignment = (text: string, keyword: string, name: string): string => {
  const match = text.match(
    new RegExp(`\\b${keyword}\\s+${name}\\s*=\\s*([^\\n]+)`),
  );
  if (!match) {
    throw new Error(`no ${keyword} ${name} = ... in the loader`);
  }
  return match[1];
};

describe('the background sync', () => {
  test('opens the wallet with the hint from the network identity when Android reads the settings file', () => {
    const worker = source(
      'android/app/src/main/java/org/ZingoLabs/Zingo/BackgroundSyncWorker.kt',
    );
    const name = chainArgument(
      worker,
      /loadExistingWalletNative\(\s*\w+\s*,\s*(\w+)\s*,/,
    );
    const value = assignment(worker, 'val', name);
    expect(value).not.toMatch(/"chainName"/);
    expect(value).toMatch(
      /chainHintFor\(\s*\w+\s*,\s*uniffi\.zingo\.swarmNetworkIdentity\(\)\s*\)/,
    );
  });

  test('opens the wallet with the hint from the network identity when iOS reads the settings file', () => {
    const delegate = source('ios/AppDelegate.swift');
    const name = chainArgument(
      delegate,
      /fnLoadExistingWallet\(\s*serveruri:\s*\w+\s*,\s*chainhint:\s*(\w+)\s*,/,
    );
    const value = assignment(delegate, 'let', name);
    expect(value).not.toMatch(/"chainName"/);
    expect(value).toMatch(/swarmChainHint\(\s*for:\s*\w+\s*\)/);
    expect(delegate).toMatch(
      /func swarmChainHint\(for [^)]*\)[^{]*\{[^}]*swarmNetworkIdentity\(\)/,
    );
  });

  test('reads the identity the library reports when the Kotlin test feeds the mapping', () => {
    // The identity the Kotlin test parses has to be the one lib.rs reports:
    // the same keys, and the production hint carrying the genesis.
    const lib = source('rust/lib/src/lib.rs');
    const kotlinTest = source(
      'android/app/src/test/java/org/ZingoLabs/Zingo/SwarmChainHintTest.kt',
    );
    for (const key of ['"networks"', '"chain_label"', '"chain_hint"']) {
      expect(lib).toContain(key);
      expect(kotlinTest).toContain(key);
    }
    const genesis = lib.match(
      /pub const SWARM_MAINNET_GENESIS: &str =\s*"([0-9a-f]{64})"/,
    );
    expect(genesis).not.toBeNull();
    expect(kotlinTest).toContain(`swarm-mainnet:${genesis?.[1]}`);
  });
});
