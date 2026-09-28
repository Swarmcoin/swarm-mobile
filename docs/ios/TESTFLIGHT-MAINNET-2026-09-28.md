# SWARM Wallet iOS 0.2.0 (1050)

| Field | Release |
| --- | --- |
| Source | `83db86a38b854828e98d11263d1d631fca483951` |
| Mainnet branch integrated through | `cf56befc811b8a1302f8843e09587636a76a56c1` |
| Workflow | https://github.com/Swarm-Official/swarm-mobile/actions/runs/36373320306 |
| Bundle | `green.swarm.swarmwallet` |
| Apple app | `6815274408` |
| Distribution group | SWARM Internal |
| Status | VALID and IN_BETA_TESTING on 28 September 2026 |
| Apple build ID | `721bc63c-0312-4e81-81ba-0e40dc4e071f` |
| IPA SHA-256 | `08262e9e0d934a9fa2e410ac2c5287b9e11d64af3e7c790ab014d2d841a3f75f` |
| Apple delivery UUID | `721bc63c-0312-4e81-81ba-0e40dc4e071f` |

## Changes

This build includes the latest mainnet recipient checks, transaction explorer
links, network names in Settings, and mainnet terms. The Nym configuration
checks network support before starting its transport. SWARM payments use the
direct connection.

The SDK remains pinned to `c7464d2ec40a5d619500a9ebee76ac4c39775baa`.
The mainnet server is `https://lwd-main.swarm.green:8443`. Saved wallet
selection and network migration from build 1044 remain in this release.

## Local checks

- JavaScript: 99 suites, 710 tests and 95 snapshots passed.
- TypeScript passed.
- Native address compatibility: six tests passed.
- App Store text checks passed.

## Hosted release

The native job passed six address tests, eight network identity tests, four
saved-wallet validation tests and one sync-pause test. One live network test
was ignored by the hosted test command.

The framework artifact has SHA-256
`bb2d1af1135882d5c33ae432bd03385e8f408c6c23fd3b2db712442c82791582`.
Its full archive checksum and architecture slices were verified locally.
Both frameworks and Swift bindings are installed in `ios/`. The Swift
bindings match build 1044. The previous frameworks are backed up outside
the repository.

The iOS 26.5 simulator passed the wallet walkthrough in 98 seconds. The
screenshots show the mainnet `swm1…` receive address and both saved wallets
after restarting the app. Wallet creation, Send, Receive and switching
wallets passed. The bundle, branding and user-visible text checks passed.

The app container selected `https://lwd-main.swarm.green:8443` on
`swarm-mainnet`. The packet capture recorded 1,693 packets for
`64.94.84.101:8443`.

All five release jobs passed. The signed archive contains version 0.2.0,
build 1050 and bundle `green.swarm.swarmwallet`. Apple accepted the upload
at 05:06 UTC on 28 September 2026.

The four temporary release secrets were removed from the restricted
`apple-distribution` GitHub environment. A separate API read confirmed
that the environment contains zero secrets.

Apple processing passed. The build is assigned to SWARM Internal with state
`IN_BETA_TESTING`. The SWARM icon is present and the published What to Test
notes match `fastlane/testflight/what_to_test.txt`.

Funded mainnet payment testing on an iPhone remains a tester step.
