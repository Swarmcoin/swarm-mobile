import { ChainNameEnum } from '@app/AppState/enums/ChainNameEnum';

/**
 * The SWARM networks this app can be pointed at, as data.
 *
 * Until now "which network am I on" was several separate facts scattered
 * across the tree, a chain label in the settings file, the single entry in
 * `app/uris/serverUris.ts`, and a string the Rust FFI turns into a
 * `ChainType`. Adding a second SWARM network to that arrangement is how a
 * wallet ends up on the wrong chain, so the facts are collected here instead,
 * one record per network, and every screen that needs one of them asks this
 * file.
 *
 * This is a port of the desktop wallet's `src/utils/networkProfiles.ts`
 * (privacy-wallet, branch codex/mainnet-wallet-mainnet-20260925, commits
 * 13dd5606 and 745c2092). The two wallets talk to the same indexers and build
 * transactions with the same SDK, so they must agree on the contract, down to
 * the chain-hint string. Where this copy differs it is because the mobile app
 * carries its chain label in `ChainNameEnum` rather than in electron-settings.
 *
 * Two rules this file exists to enforce, and which its tests hold it to:
 *
 *  1. The generic word "mainnet" never reaches a SWARM profile. Upstream's
 *     `main` chain is Zcash and stays Zcash. In the SDK, in the vendored
 *     address crates, and in the Rust library, where `"main" => ChainType::Mainnet`
 *     still decodes `u1…`/`zs1…`/`t1…`/`t3…`. SWARM production is a separate
 *     profile with its own label, `swarm-mainnet`, and is reachable only by
 *     that label.
 *
 *  2. A profile with no genesis hash is not selectable. A wallet that synced
 *     against the wrong chain would write its state back over the right one,
 *     so a profile the app cannot hold a server to is not offered at all.
 */

/** Which SWARM network a profile describes. */
export enum SwarmProfileIdEnum {
  testnet = 'swarm-testnet',
  mainnet = 'swarm-mainnet',
}

/**
 * The genesis block hash of the SWARM production network, in the display order
 * a node prints.
 *
 * Produced by the launch ceremony and reproduced from the running chain. This
 * is the value the wallet holds its indexer to and the value that goes into
 * the Rust chain hint; the native layer embeds the same constant
 * (`rust/lib/src/lib.rs`, `SWARM_MAINNET_GENESIS`) and a unit test asserts the
 * two are the same string.
 */
export const SWARM_MAINNET_GENESIS =
  '01c34428b9e67cdd8345e0b365aaa37dd8d2d65d3869e0e5d77d567f2c39afdd';

/** The genesis of the engineering testnet, for the same purpose. */
export const SWARM_TESTNET_GENESIS =
  '045993f5c91ea160c7ebda573dd97b0016816bca68d395bfff202779b88e2a28';

/** Where a SWARM production wallet looks for its indexer. */
export const SWARM_MAINNET_SERVER = 'https://lwd-main.swarm.green:8443';

/** Where an engineering-testnet wallet looks for its indexer. */
export const SWARM_TESTNET_SERVER = 'https://lwd.swarm.green:443';

/** The block explorer that indexes the SWARM production chain. */
export const SWARM_MAINNET_EXPLORER = 'https://mainnet.explore.swarm.green/';

/** The block explorer that indexes the engineering testnet. */
export const SWARM_TESTNET_EXPLORER = 'https://explore.swarm.green/';

/** Everything one SWARM network is, in the terms the app needs. */
export type SwarmNetworkProfile = {
  /** Which network this is. */
  readonly id: SwarmProfileIdEnum;
  /**
   * The light-wallet chain label. What the indexer reports in `GetLightdInfo`,
   * what the settings file stores as the server's `chainName`, and what the
   * FFI's chain hint is built from. The single string that decides the chain.
   */
  readonly chainLabel: ChainNameEnum;
  /** What the network is called on screen. */
  readonly displayName: string;
  /** A sentence under the name, where a screen has room for one. */
  readonly tagline: string;
  /** The coin balances are counted in. */
  readonly ticker: string;
  /**
   * The bech32m human-readable part of a unified address on this network.
   * `swarm1…` on testnet, `swm1…` on production. Disjoint by construction:
   * a bech32m string cannot satisfy two HRPs at once.
   */
  readonly unifiedHrp: string;
  /**
   * Older unified HRPs this network still accepts as payment destinations.
   * SwarmTestnet accepts `utest1…` because wallets created before the prefix
   * change hold those addresses. Production has no history and accepts none.
   */
  readonly legacyUnifiedHrps: readonly string[];
  /** The bech32m HRP of a ZIP 320 TEX address on this network. */
  readonly texHrp: string;
  /**
   * The leading characters of a Base58Check transparent address, from the
   * version bytes: testnet `tm…` (0x1d25) and `t2…` (0x1cba), production
   * `s1…` (0x1c28) and `s3…` (0x1c2d).
   */
  readonly transparentPrefixes: readonly string[];
  /** The indexer this network's wallets start on. */
  readonly defaultServer: string;
  /** The block explorer that indexes this network. */
  readonly explorer: string;
  /** Whether that indexer exists yet. */
  readonly serverIsLive: boolean;
  /** The light-wallet gRPC port this network's indexer serves. */
  readonly grpcPort: number;
  /**
   * The genesis this profile holds its indexer to, or `null` when the network
   * has not launched. `null` makes the profile unselectable.
   */
  readonly genesis: string | null;
  /**
   * The `zingolib::config::ChainType` variant this profile means, named so a
   * reader can check it against the SDK without leaving this file. Never
   * `Mainnet`: that variant is upstream Zcash.
   */
  readonly sdkChainType: 'CustomTestnet' | 'SwarmMainnet';
  /** The first block, and so the earliest birthday a wallet here can have. */
  readonly activationHeight: number;
  /** Whether this is the network real value lives on. */
  readonly isProduction: boolean;
  /**
   * The leading strings that belong to this network and to no other chain this
   * application knows of.
   *
   * SwarmTestnet's `tm…`, `t2…` and `utest1…` are not here: they are upstream
   * testnet's encodings too, because the vendored protocol crate renamed only
   * the unified HRP. So an address carrying one of those names two chains, and
   * anything that has to pick one from the string alone must not pick from it.
   */
  readonly distinctivePrefixes: readonly string[];
};

const TESTNET: SwarmNetworkProfile = {
  id: SwarmProfileIdEnum.testnet,
  chainLabel: ChainNameEnum.swarmChainName,
  displayName: 'SWARM Testnet (engineering)',
  tagline: 'An engineering network. Coins here have no value.',
  ticker: 'SWM',
  unifiedHrp: 'swarm',
  legacyUnifiedHrps: ['utest'],
  texHrp: 'textest',
  transparentPrefixes: ['tm', 't2'],
  defaultServer: SWARM_TESTNET_SERVER,
  explorer: SWARM_TESTNET_EXPLORER,
  serverIsLive: true,
  grpcPort: 9067,
  genesis: SWARM_TESTNET_GENESIS,
  sdkChainType: 'CustomTestnet',
  activationHeight: 1,
  isProduction: false,
  distinctivePrefixes: ['swarm1'],
};

const MAINNET: SwarmNetworkProfile = {
  id: SwarmProfileIdEnum.mainnet,
  chainLabel: ChainNameEnum.swarmMainnetChainName,
  displayName: 'SWARM Mainnet',
  tagline: 'The live SWARM network.',
  ticker: 'SWM',
  unifiedHrp: 'swm',
  legacyUnifiedHrps: [],
  texHrp: 'texswm',
  transparentPrefixes: ['s1', 's3'],
  defaultServer: SWARM_MAINNET_SERVER,
  explorer: SWARM_MAINNET_EXPLORER,
  serverIsLive: true,
  grpcPort: 9068,
  genesis: SWARM_MAINNET_GENESIS,
  sdkChainType: 'SwarmMainnet',
  activationHeight: 1,
  isProduction: true,
  // Every one of SWARM production's encodings is its own: a new HRP and two
  // transparent version bytes checked against Zcash, Bitcoin, Litecoin, Dash,
  // Komodo and Horizen before they were chosen.
  distinctivePrefixes: ['swm1', 's1', 's3'],
};

/**
 * Every SWARM profile, in the order a selector lists them.
 *
 * Mainnet first: it is the network this build is for, and the first entry is
 * the one a fresh install starts on.
 */
export const SWARM_NETWORK_PROFILES: readonly SwarmNetworkProfile[] = [
  MAINNET,
  TESTNET,
];

export const SWARM_TESTNET_PROFILE = TESTNET;
export const SWARM_MAINNET_PROFILE = MAINNET;

/** The network a fresh install opens on. */
export const DEFAULT_SWARM_PROFILE = MAINNET;

/**
 * The profile a chain label names, or `undefined`.
 *
 * `undefined` for `main`, `test` and `regtest`. Those are upstream Zcash
 * chains and have no SWARM profile, and for anything unrecognised. It never
 * falls back: a caller that cannot identify the chain must not be handed one.
 */
export const swarmProfileFor = (
  chain: string | undefined | null,
): SwarmNetworkProfile | undefined =>
  SWARM_NETWORK_PROFILES.find(profile => profile.chainLabel === chain);

/**
 * Whether this profile can be put in front of a user.
 *
 * A profile with no genesis cannot: the wallet would have nothing to hold the
 * server to, so "is this the right chain?" would be unanswerable.
 */
export const isProfileSelectable = (
  profile: SwarmNetworkProfile | undefined,
): boolean =>
  !!profile && typeof profile.genesis === 'string' && profile.genesis.length > 0;

/** The profiles a selector may actually offer today. */
export const selectableSwarmProfiles = (): readonly SwarmNetworkProfile[] =>
  SWARM_NETWORK_PROFILES.filter(isProfileSelectable);

/** Why a profile is not on offer, in one sentence, or "" when it is. */
export const unselectableReason = (profile: SwarmNetworkProfile): string => {
  if (isProfileSelectable(profile)) {
    return '';
  }
  return (
    `${profile.displayName} has not launched yet: until this app ships its genesis block ` +
    `hash it cannot tell a real ${profile.displayName} server from any other. This release ` +
    `cannot connect to it.`
  );
};

/**
 * What a SWARM profile is called in the FFI's chain hint, the third argument
 * of `createNewWallet`, `restoreWalletFromSeed`, `restoreWalletFromUfvk` and
 * `loadExistingWallet`.
 *
 * SwarmTestnet's hint is the bare label, which is what the library has always
 * been sent and what it maps to `ChainType::CustomTestnet`. Production's
 * carries the genesis after a colon, because `ChainType::SwarmMainnet` holds
 * the hash and the SDK gives it no default: `ChainType::try_from("swarm-mainnet")`
 * is an error there, deliberately, so a hint without a hash cannot build one.
 *
 * Throws rather than returning a hint a caller might send anyway.
 */
export const chainHintFor = (profile: SwarmNetworkProfile): string => {
  if (profile.id === SwarmProfileIdEnum.testnet) {
    return profile.chainLabel;
  }
  if (!isProfileSelectable(profile)) {
    throw new Error(unselectableReason(profile));
  }
  return `${profile.chainLabel}:${profile.genesis}`;
};

/**
 * The chain hint for any chain label the application can hold, SWARM or not.
 *
 * THE ONE PLACE a chain label becomes a chain hint. Every FFI call that takes
 * one goes through this, and `__tests__/nativeChainHint.unit.test.ts` reads
 * the source of every call site and fails the build if one stops doing so.
 *
 * It exists because of what happened to the desktop wallet on 2026-09-26: the
 * owner pressed Create on the first mainnet build and got
 *
 *   initializing wallet: 'swarm-mainnet' does not name a network. The SWARM
 *   production network is opened as 'swarm-mainnet:<genesis>'
 *
 * `chainHintFor` had been written, documented and tested there, and nothing
 * called it: every call site passed the wallet's chain label straight through,
 * which is right for every chain the library knew when those lines were
 * written and wrong for the only one added since. A correct function nobody
 * calls is not a fix.
 *
 * Upstream Zcash's `main`, `test` and `regtest` pass through unchanged: their
 * hint IS the bare label, and a legacy wallet on one of them still has to be
 * loadable so it can be named and its seed exported. Anything unrecognised
 * passes through too, for the same reason, the library's own error is a
 * better answer than a guess made here.
 */
export const nativeChainHint = (chain: string | undefined | null): string => {
  const profile = swarmProfileFor(chain);
  if (profile) {
    return chainHintFor(profile);
  }
  return chain ?? '';
};

/**
 * The chain label a build may actually store and boot on.
 *
 * A settings file can hold anything. It is JSON on the user's device, it
 * survives downgrades, and a release that ships `swarm-mainnet` and is then
 * rolled back leaves that label behind in it. So the label is read through
 * this on the way in: an unlaunched SWARM network falls back to the one this
 * build can serve rather than booting a wallet onto a chain it cannot
 * identify.
 *
 * Anything that is not a SWARM chain passes through untouched. Upstream's
 * `main`, `test` and `regtest` are not this function's business.
 */
export const selectableChainOrFallback = (
  chain: string | undefined | null,
): string => {
  const profile = swarmProfileFor(chain);
  if (!profile) {
    return chain ?? '';
  }
  return isProfileSelectable(profile)
    ? profile.chainLabel
    : SWARM_TESTNET_PROFILE.chainLabel;
};

/**
 * A copy of `profile` carrying `genesis`, for tests that have to exercise a
 * launched network other than the one this build ships.
 */
export const withGenesis = (
  profile: SwarmNetworkProfile,
  genesis: string,
): SwarmNetworkProfile => {
  if (!/^[0-9a-f]{64}$/.test(genesis)) {
    throw new Error(
      `'${genesis}' is not a block hash: a genesis is 64 lowercase hexadecimal characters in display order.`,
    );
  }
  return { ...profile, genesis };
};

/**
 * A copy of `profile` with no genesis, for tests that have to exercise the
 * unlaunched state.
 *
 * The mirror of `withGenesis`, and it exists for the same reason: the state a
 * test asserts must not be the state the build happens to be in.
 */
export const withoutGenesis = (
  profile: SwarmNetworkProfile,
): SwarmNetworkProfile => ({
  ...profile,
  genesis: null,
});

/** The host and port of a server URI, for a sentence. "" when unreadable. */
export const serverHost = (uri: string | undefined | null): string => {
  const value = (uri ?? '').trim();
  if (!value) {
    return '';
  }
  const withoutScheme = value.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '');
  const host = withoutScheme.split('/')[0];
  return host ?? '';
};

/**
 * The block explorer for a chain label, or "" when the chain has none.
 *
 * Upstream Zcash's `main`, `test` and `regtest` reach no SWARM explorer, and a
 * caller that gets "" hides the affordance rather than opening a dead page.
 */
export const explorerUrlFor = (chain: string | undefined | null): string =>
  swarmProfileFor(chain)?.explorer ?? '';

/** The explorer host a settings row shows for a chain, or "" when none. */
export const explorerHostFor = (chain: string | undefined | null): string =>
  serverHost(explorerUrlFor(chain));

/**
 * The translation key for the one-line network notice under the app name.
 *
 * Which network a wallet is on decides whether its coins are worth anything,
 * so the sentence differs and the key is chosen from the chain rather than
 * from a build flag. An unrecognised chain gets the testnet caution: telling
 * someone their coins might be worthless when they are not is an annoyance,
 * the other way round is a loss.
 */
export const networkNoticeKey = (chain: string | undefined | null): string => {
  const profile = swarmProfileFor(chain);
  const id = profile?.id ?? SwarmProfileIdEnum.testnet;
  return `welcome.network-${id}`;
};
