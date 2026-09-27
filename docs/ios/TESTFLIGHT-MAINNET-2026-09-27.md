# SWARM Wallet iOS mainnet release

## Build

| Field | Release |
| --- | --- |
| Version | 0.2.0 |
| Build | 1044 |
| Source | `ba055bba39d1b28472425223053004ff249f5437` |
| Workflow | https://github.com/Swarm-Official/swarm-mobile/actions/runs/36320428820 |
| Bundle | `green.swarm.swarmwallet` |
| Apple app | `6815274408` |
| Distribution group | SWARM Internal |
| Status | VALID and IN_BETA_TESTING on 27 September 2026 |
| Apple build ID | `e57a81fd-677b-4f01-b5f2-3f7655a66045` |
| IPA SHA-256 | `7d9d7d372ac4b406f4a689db4a386ae64fba18561f10244bcdc2173d7f6e6e4b` |

## Changes

The release imports the mobile mainnet branch through `467342c83` and pins
the published `swarm-sdk-mainnet-1` SDK. The default server is
`https://lwd-main.swarm.green:8443`. Mainnet uses `swm1…` receive addresses.

The saved-wallet validator now accepts both SWARM networks. Opening a saved
wallet resolves its network before opening the indexer. The wallet picker
opens new mainnet onboarding and retains the existing saved wallets.
Risk acknowledgements are stored separately for each network.

The App Store and TestFlight descriptions were updated through Apple's API.
The source review notes now describe mainnet. Saving review notes in Apple
requires the owner's review name, phone, and email fields.

## Local evidence

The JavaScript suite passed 684 tests and 95 snapshots. TypeScript and the
changed-file lint checks passed. Native tests passed for address compatibility,
network identity, wallet validation, and idle sync pause. The live native
test confirmed the production chain label and pinned genesis.

The upgrade test used a separate iPhone 16 Pro simulator on iOS 18.3:

1. Installed the checksum-verified simulator artifact from build 1028.
2. Created two testnet wallets and switched back to wallet 1.
3. Installed the mainnet candidate over that app.
4. Confirmed that both saved wallet IDs remained present.
5. Created mainnet wallet 3 and viewed its Receive screen.
6. Switched to testnet wallet 1 and back to mainnet wallet 3.
7. Restarted the app and reopened mainnet wallet 3.

The receive QR decoded as a 108-character `swm1…` address. The persisted
server was `https://lwd-main.swarm.green:8443` on `swarm-mainnet`.

A second, fresh simulator passed the full mainnet flow: network notice,
wallet creation, Send, Receive, two saved wallets, switching back to wallet 1,
and reopening both saved wallets after an app restart.

The repeatable upgrade flow is `.maestro/ios_upgrade_from_testnet.yaml`.
It expects two wallets created by the build 1028 fresh-install flow before
installing this candidate. The test changes authentication preferences only
inside its disposable simulator.

Funded mainnet payment testing on an iPhone remains a tester step.

## Hosted evidence

The native job passed its compatibility, identity, saved-wallet validation,
and sync-pause tests. The iOS 26.5 simulator passed the wallet walkthrough
in 187 seconds. The screenshots show the `swm1…` receive address and both
wallets after an app restart. The bundle and branding checks passed.

The app container selected `https://lwd-main.swarm.green:8443` on
`swarm-mainnet`. The packet capture contains 3,310 packets for
`64.94.84.101:8443`. The workflow's text report counted the previous port
443. Commit `d739e8cb7` corrects that report for future runs.

The simulator app ZIP has SHA-256
`df14616cd1f89b9181acc1b498cf244c3354dae44bccb8c8d06b1b948052501c`.
GitHub reports the native framework artifact ZIP digest as
`798e305ff097708d1dec3831d72e57200c44ee8e5ed467fadfce814bd1c5340e`.
The full device and simulator frameworks and matching Swift bindings are
installed in the local `ios/` directory.

## Release completion

All five GitHub jobs passed. The signed archive contained version 0.2.0,
build 1044, and bundle `green.swarm.swarmwallet`. Apple accepted the upload
at 14:57 UTC. Its delivery UUID matches the Apple build ID above.

Apple processed the build as `VALID`. The internal build state is
`IN_BETA_TESTING`, and the SWARM Internal group includes build 1044.
The icon asset is present. The en-US test notes match
`fastlane/testflight/what_to_test.txt`.

The existing encryption declaration was retained after reviewing the SDK
dependency changes. The four temporary GitHub release secrets were removed
at 14:58 UTC. A separate read confirmed that the release environment's
secret list was empty.

Existing testers can update the installed app, open Wallets, and select
Create or restore on SWARM Mainnet. Their saved wallets remain available.
The public App Store submission still requires the review details recorded
above and the remaining submission checks.
