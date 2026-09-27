# SWARM Wallet iOS mainnet release

## Build

| Field | Candidate |
| --- | --- |
| Version | 0.2.0 |
| Build | 1044 |
| Source | `ba055bba39d1b28472425223053004ff249f5437` |
| Workflow | https://github.com/Swarm-Official/swarm-mobile/actions/runs/36320428820 |
| Bundle | `green.swarm.swarmwallet` |
| Apple app | `6815274408` |
| Distribution group | SWARM Internal |
| Status | The signed workflow is running. Apple processing remains pending. |

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

## Release completion

Record the IPA checksum, Apple build ID, processing status, group assignment,
and temporary-secret deletion after the signed workflow completes.
