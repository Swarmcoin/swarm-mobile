# SWARM Wallet on mainnet (Android and iOS)

What the mobile wallet does on the live SWARM network, what enforces it, and
what was actually verified. Written on 2026-09-26 on branch
`codex/mobile-mainnet-20260926`.

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
| SDK pin | `Swarm-Official/privacy-zingolib` @ `d9f1a5b888067724b61b2fae46307ed56b4b1e0a` |
| Block explorer | `https://mainnet.explore.swarm.green/` |

The engineering testnet is unchanged and still selectable, under the name
**SWARM Testnet (engineering)**: chain `swarm-testnet`, indexer
`https://lwd.swarm.green:443`, genesis
`045993f5c91ea160c7ebda573dd97b0016816bca68d395bfff202779b88e2a28`, `swarm1…`
and `tm…`/`t2…`, coins with no value.

This is the same contract the desktop wallet implements
(`Swarm-Official/privacy-wallet`, branch
`codex/mainnet-wallet-mainnet-20260925`, commits `13dd5606`, `d08e17e2`,
`3661ffa2`, `745c2092`), to the character. Two wallets that talk to the same
indexers and sign with the same SDK must agree on what a SWARM address is and
on what string opens a chain.

## The hint is not the label

The Rust library's first chain argument is a chain **hint**. For `main`,
`test`, `regtest` and `swarm-testnet` the hint and the label are the same
string. For SWARM production they are not: `ChainType::SwarmMainnet` carries
the genesis, and the SDK gives it no default, so
`ChainType::try_from("swarm-mainnet")` is an error on purpose. A hint without
a hash cannot build a chain the wallet would then be unable to identify.

The desktop wallet shipped `0.1.0-mainnet.1` with a correct hint builder that
**nothing called**, and the owner could not create a wallet. So in this
repository:

- `nativeChainHint()` in `app/utils/networkProfiles.ts` is the one place a
  label becomes a hint.
- The four wallet-opening wrappers in
  `app/walletBackend/utils/walletUtils.ts` (`createNewWallet`,
  `restoreWalletFromSeed`, `restoreWalletFromUfvk` and `loadExistingWallet`)
  take a **label** and build the hint themselves. They are the only callers of
  the corresponding `RPCModule` methods.
- `__tests__/nativeChainHint.unit.test.ts` **reads the source** of `app/`,
  `screens/` and `ui/` and fails the build if any other file names one of
  those four `RPCModule` methods. A unit test of the builder alone would have
  passed on the build the owner could not use.

## What refuses what

**Addresses.** Every recipient check in the app (the Send field, the address
book, the swap inputs and a scanned QR code) asks the Rust `parse_address` in
`rust/lib/src/lib.rs` and accepts the address only when the `chain_name` it
answers is the wallet's own chain (`Utils.isValidAddress`). `parse_address`
tries the two SWARM chains, `CustomTestnet` and `SwarmMainnet`, and no Zcash
chain. A mainnet wallet accepts `swm1…`, `texswm1…`, `zswmsapling1…`, `s1…`
and `s3…`; it refuses `swarm1…`, `utest1…`, `tm…` and `t2…`, which answer
`swarm-testnet`, and every upstream Zcash encoding (`u1…`, `zs1…`, `t1…`,
`t3…`), which answers `Invalid address`. A testnet wallet refuses mainnet's by
the same rule. `rust/lib/src/swarm_prefix_tests.rs` pins these answers and
`__tests__/swarmMainnet.recipients.unit.test.ts` holds each screen's check to
them.

The string-only rules in `app/utils/swarmAddress.ts` refuse the same strings
with a sentence naming the other network. They are tested, and no screen calls
them yet.

**Servers** (`app/utils/serverIdentity.ts`, wired by
`app/walletBackend/utils/serverGate.ts`). The indexer is asked which chain it
serves before a sync and again immediately before a send. Twice, because the
server can be changed between the two and a transaction built against the
wrong consensus rules and broadcast cannot be taken back. The chain label is
compared always; the genesis is compared when the indexer states one
(`GetLightdInfo` does not carry it in stock lightwalletd, so this tightens
against a server that says more and does not break against one that does not).
A server that cannot be reached at all is left to the existing unreachability
paths rather than accused of being the wrong one.

**Wallets on another chain.** A wallet whose chain is not a SWARM chain is
named for what it is and otherwise left alone: not synced, not sent from, and
not silently moved onto a SWARM chain, because its recovery phrase is the only
thing that opens it and moving it would hide that.

## The native layer

`rust/Cargo.toml` pins the SDK at `d9f1a5b8…`, which carries
`ChainType::SwarmMainnet(SwarmMainnetGenesis)`, `NetworkType::SwarmMain` and
`BranchId::SwarmMain`.

Four crates are vendored under `rust/vendor/`, not two, because
`zcash_primitives` and `zcash_transparent` each match one of those enums
exhaustively and so no longer compile against the patched `zcash_protocol`.
All four are byte-for-byte the desktop wallet's, which built and tested them
against this pin on four platforms; the versions match this workspace's
existing lockfile exactly, and the two crates already vendored here were
verified to be strict subsets of the desktop's, so the SWARM **testnet**
prefix work survives untouched. See `rust/vendor/README.md` for the archive
checksums and what each patch does.

`rust/lib/src/lib.rs` embeds the genesis and the mainnet indexer as constants,
parses `swarm-mainnet:<genesis>` (and refuses the bare label with a sentence
that says why), reports the **label** from `chain_name_short`, decodes
addresses on both SWARM networks, and reports both profiles from
`swarm_network_identity()` with each one's hint.

## Versions

Android `0.2.0` (`versionCode` 7, `SWARM_VERSION` `0.2.0-mainnet.4`); iOS
`MARKETING_VERSION` `0.2.0`. `0.2.0-mainnet.1` was `versionCode` 4,
`0.2.0-mainnet.2` `versionCode` 5 and `0.2.0-mainnet.3` `versionCode` 6.
Neither the mainnet.2 nor the mainnet.3 bytes were distributed.
The application id `green.swarm.wallet`, the Android namespace
`org.ZingoLabs.Zingo`, the iOS bundle identifier and the App Store record are
**unchanged**: this is the same app, on the network it was built for.

## What was verified

Recorded by the CI runs on this branch; see the vault handover note for the
run URLs and the artifact hashes.

- `SWARM Rust lockfile`: the workspace resolves against the new SDK pin with
  **no lockfile change**, and all four patched crates resolve from `vendor/`
  rather than from crates.io. That last check is the one that matters: if one
  of them stopped, SWARM production would silently decode as something else.
- `SWARM Android`: lint, `tsc --noEmit`, the full jest suite, the Rust
  library for `armeabi-v7a`, `arm64-v8a` and `x86_64`, the branding and
  listing guards, and a debug-signed APK.
- Mainnet recipients, from `0.2.0-mainnet.2`: the Rust job runs
  `swarm_prefix_tests`, which parse the live FUEL payout address
  `swm1q4q6yr3r…xqe5gv`, `s1UsiRFq4FrtHUbHobXxssCN7EVCcu9GvFk`, the vendored
  crate's `s1`/`s3`/`texswm` vectors and the addresses a mainnet wallet
  derives, and refuse the testnet's and Zcash's. The emulator smoke test types
  the two mainnet addresses and Zcash's `t1…` into the Send field of the fresh
  wallet and reads the check or the error the screen shows.
- Mainnet wording, from `0.2.0-mainnet.2`:
  `__tests__/mainnetWording.unit.test.ts` reads the risk notice, the privacy
  policy and the terms as a mainnet wallet shows them, the mainnet profile and
  every translation that names no other network, and fails on test-network
  wording. The testnet texts are held to their own sentences.
- `SWARM iOS`: the Rust xcframework and the simulator build.

## What this build still gets wrong, and who must fix it

**The website still carries the testnet notice.** `app/legal/riskNotice.ts`
and `app/legal/documents.json` now hold one text per network, picked from the
chain the wallet is on, and the vault source
(`D:/privacy/docs/ios/legal/RISK-NOTICE.md`) carries both. The published page
at swarm.green/wallet/risks has not been updated, so the app and the website
disagree until the owner publishes the mainnet text.

**The store listings describe the testnet.** The Play `full_description` and
the App Store description were not touched.

**The explorer follows the chain.** Each network profile carries its own site:
`mainnet.explore.swarm.green` on SWARM Mainnet, `testnet.explore.swarm.green`
on the engineering testnet. `Utils.getBlockExplorerTxIDURL` reads the profile
and the Settings row shows the host of the network the wallet is on. Until
`0.2.0-mainnet.2` the transaction link was `<explorer>/tx/<txid>`, which both
sites answer with 404. It is `<explorer>/transactions/<txid>` now, the path
both sites serve with 200, checked on 2026-09-27 against a live mainnet and a
live testnet transaction. How completely the mainnet site indexes the chain
was not measured.

**The legal pages carry the iOS text.** The privacy policy and the terms
shown in About describe "the SWARM Wallet iOS beta" and TestFlight on Android
too. They are reproduced from the vault's iOS legal set and from
swarm.green/wallet. An Android wording is the owner's to approve.

**The terms on mainnet were reworded in `0.2.0-mainnet.2`.** Their first
paragraph read "experimental, self-custody software distributed for testing"
on every network. A mainnet wallet now reads "self-custody software
distributed by S4FE AG", and the testnet keeps the old sentence. The published
page at swarm.green/wallet/terms still carries the old sentence.

**Background sync opened a mainnet wallet with the label, not the hint,
until `0.2.0-mainnet.4`.** `BackgroundSyncWorker.kt` (Android) and
`AppDelegate.swift` (iOS) read `server.chainName` from `settings.json` and
passed it to the native loader as the chain hint. For `swarm-mainnet` the
loader refuses the bare label, so the nightly background sync failed on every
mainnet wallet. The foreground sync was unaffected. Both loaders now look the
hint up in `swarm_network_identity()`, which lists each SWARM network's label
beside its hint, and pass any label it does not list through unchanged, as
`nativeChainHint` does in JS. `SwarmChainHintTest` (JVM, run by the
`Kotlin JVM unit tests` job) tests the Android mapping, and
`__tests__/backgroundSyncChainHint.unit.test.ts` fails if either loader passes
the stored label to the library again. The fix has not been watched running on
a device: WorkManager does not run a periodic task before its schedule.

**A fresh wallet's first sync shows no progress for minutes.** The mainnet
indexer collects every requested block below height ~1000 before it sends the
first one, and the first sync session of a fresh wallet times out on it. The
condition is lwd-main's, it affects the desktop wallet too, and the fix belongs
to the indexer. Every emulator run from 00:05 UTC on 2026-09-28 met it,
including a re-run of the green `e64b06024` build. The smoke test reports it as
a warning and fails on every other check.

**The Nym mixnet stays off on mainnet.** No mixnet send has been demonstrated
end to end against any SWARM indexer, and on mainnet a send that silently
leaves the mixnet is a real payment. `mixnetAvailability.ts` lists neither
SWARM chain.

Until `0.2.0-mainnet.3` that list hid the mixnet's switches and nothing more.
`WalletBackend.configure()` started the Nym transport on every chain: the
emulator log of run 36364054489 shows the app reaching `validator.nymtech.net`,
`cloudflare-dns.com` and a Nym gateway, sending the SDK's attach health check
through the mixnet to the Zcash indexer `zec.rocks:443`, and then streaming
cover traffic, about 80 KiB/s down and 140 KiB/s up, for as long as the app
ran. From `0.2.0-mainnet.3` the backend starts the transport only on a chain
the list offers, re-enabling it is a no-op elsewhere, and each session on a
SWARM chain is told to transmit over clearnet. The library's default policy is
the mixnet, under which it refuses a send until a transport is ready, and the
transport's start was what used to set clearnet. The emulator smoke test
samples the app's sockets from launch for at least five minutes and fails on
any remote host other than `lwd-main.swarm.green:8443`.

## Not done here, and why

**TestFlight.** The signed-archive job in `.github/workflows/swarm-ios.yml`
runs under the `apple-distribution` GitHub environment, whose deployment
branch policy allows exactly one branch: `codex/ios-device-release`. A signed
build from this branch would require either adding a branch policy to that
environment or merging into the owner's branch, and both are the owner's
decisions to make about his own Apple credentials. The unsigned iOS jobs prove
the code compiles and links for the device toolchain; the signed upload is
listed in the handover as an owner step.

**Google Play.** Nothing here uploads. The `bundle` job builds a Play-format
`.aab` only when the four upload-key secrets are present, and publishing stays
a manual owner action, as `docs/SWARM-ANDROID.md` describes.
