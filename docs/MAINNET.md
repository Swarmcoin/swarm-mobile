# SWARM Wallet on mainnet

Updated 27 September 2026 for the iOS 0.2.0 release.

## The contract

| Fact | Value |
| --- | --- |
| Chain label | `swarm-mainnet` |
| Chain **hint** (what the Rust FFI takes) | `swarm-mainnet:01c34428b9e67cdd8345e0b365aaa37dd8d2d65d3869e0e5d77d567f2c39afdd` |
| Genesis (display order) | `01c34428b9e67cdd8345e0b365aaa37dd8d2d65d3869e0e5d77d567f2c39afdd` |
| Default indexer | `https://lwd-main.swarm.green:8443` |
| Unified address HRP | `swm` → `swm1…` |
| TEX HRP | `texswm` |
| Sapling HRP | `zswmsapling` |
| Transparent prefixes | `s1…` (0x1c28), `s3…` (0x1c2d) |
| Ticker | SWM |
| gRPC port | 9068 |
| SDK `ChainType` | `SwarmMainnet(SwarmMainnetGenesis)` |
| Activation height | 1 |
| SDK pin | `swarm-sdk-mainnet-1` at `c7464d2ec40a5d619500a9ebee76ac4c39775baa` |
| Block explorer | `https://mainnet.explore.swarm.green/` |

## Wallet creation and server identity

`nativeChainHint()` supplies the genesis-qualified hint to all four native
wallet creation and restore entry points. The SDK, address validation, and
block explorer use the selected SWARM network profile.

The published SDK exposes `GetLightdInfo.genesisHash` through
`info_server().genesis_hash`. The protocol dependency resolves to
`Swarm-Official/privacy-lightwallet-protocol-rust` at
`c9c13e46bbea726f904f12cb18cd85e57ff46d35`.
The sync and send paths check the server chain label and compare a reported
genesis with the selected profile. An empty genesis field denotes an older
server that omitted the field. The production server returned the pinned
genesis in the live native test on 27 September.

Four crates resolve through `rust/vendor`: `zcash_address`,
`zcash_protocol`, `zcash_primitives`, and `zcash_transparent`.
Their network changes supply the SWARM address prefixes and consensus branch
`0x53574d31`. See `rust/vendor/README.md` for provenance.

## Upgrading an iPhone

The bundle identifier remains `green.swarm.swarmwallet`.
Existing wallets retain their keys, files, and networks. The wallet picker
opens new wallet onboarding on SWARM Mainnet. The previous testnet wallets
remain available in the same picker.

The native reader validates saved wallets against both supported SWARM
profiles. The wallet file determines its network before an indexer opens.
When the selected network differs, the reader selects that wallet network's
default server. The UI persists the matching selection. A matching custom
server remains selected, and offline mode remains offline.

Each network has its own risk acknowledgement. Creating a mainnet wallet
requires the mainnet notice even after accepting the testnet notice.

The engineering network uses `swarm-testnet`, `https://lwd.swarm.green:443`,
and `swarm1…` addresses. Its genesis is
`045993f5c91ea160c7ebda573dd97b0016816bca68d395bfff202779b88e2a28`.
Its balances belong to that network.

## Verification

The release source is `ba055bba39d1b28472425223053004ff249f5437`.

- The JavaScript suite passed 684 tests and 95 snapshots.
- TypeScript checking and lint passed for the changed UI modules.
- Native address compatibility, network identity, saved-wallet validation,
  and idle sync pause tests passed.
- The live native test reopened a mainnet wallet with previous testnet
  settings and verified the production server's chain label and genesis.
- The iOS 18.3 upgrade test installed the 0.2.0 candidate over build 1028,
  retained both existing wallets, created a third wallet on mainnet, switched
  between networks, and reopened the mainnet wallet after restarting.
- Apple Vision decoded the mainnet receive QR as a 108-character `swm1…`
  address.

See `docs/ios/TESTFLIGHT-MAINNET-2026-09-27.md` for the signed release status.

## Distribution

[Build 1044](https://github.com/Swarm-Official/swarm-mobile/actions/runs/36320428820)
is available to the SWARM Internal TestFlight group as version 0.2.0.
Apple processing and all five release jobs passed. The release uses the
existing S4FE AG signing setup. The App Store and
TestFlight descriptions describe the mainnet iPhone wallet. The test notes
explain how an existing tester opens mainnet onboarding.

Nym transport remains disabled on both SWARM networks pending a confirmed
payment through that transport. Funded mainnet payment testing requires a
physical-device test after installation.
