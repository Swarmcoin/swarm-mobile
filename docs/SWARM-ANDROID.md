# SWARM Wallet for Android

> **Since 0.2.0 this app opens on SWARM Mainnet, the live network.** The
> engineering account of what changed and what enforces it is in
> [docs/MAINNET.md](MAINNET.md). A few sections further down still describe the
> engineering testnet profile, and say so where they do.

A wallet for **SWARM Mainnet**, a private Zcash-derived proof-of-work network
that launched in September 2026. It is a fork of
[zingo-mobile](https://github.com/zingolabs/zingo-mobile) (MIT) built on the
project's fork of the Zingo SDK,
[privacy-zingolib](https://github.com/Swarm-Official/privacy-zingolib).

**The SWM in this wallet is real.** What is lost here is lost for good. This is
a first release for a young network, it has not been independently audited, and
it is not a reason to move more than you can afford to lose. The engineering
testnet is still selectable in Settings as **SWARM Testnet (engineering)**, and
its coins have no value.

Phones do not mine. Both app stores forbid on-device mining, so this is a
wallet only — mining happens on a PC with the SWARM Node app.

---

## What this app is

| | |
| --- | --- |
| Network | SWARM Mainnet, light-wallet chain label `swarm-mainnet` |
| Genesis | `01c34428b9e67cdd8345e0b365aaa37dd8d2d65d3869e0e5d77d567f2c39afdd` |
| Ticker | **SWM** |
| Addresses | `swm1…` (unified), `s1…` / `s3…` (transparent) |
| Wallet birthday | Height 1 |
| Upgrades | Everything through NU6.3 active from height 1 |
| Indexer | `https://lwd-main.swarm.green:8443` (a lightwalletd-compatible Zaino), or your own |
| Explorer | `https://mainnet.explore.swarm.green/` (the engineering testnet's is `https://explore.swarm.green/`) |
| Android package | `green.swarm.wallet` |
| Also selectable | **SWARM Testnet (engineering)**, chain label `swarm-testnet`, `https://lwd.swarm.green:443`, addresses `swarm1…`; its coins have no value |

### Where the default server comes from

A fresh install must already know its server; the user configures nothing. The
value lives in two places, one per language:

- `app/uris/serverUris.ts` — the single TypeScript entry,
  `uri: 'https://lwd-main.swarm.green:8443'`, the whole list the app ships with.
  `app/uris/fetchServerList.ts` returns `[]` on purpose, so nothing overrides
  it from the network.
- `rust/lib/src/lib.rs` — `SWARM_DEFAULT_SERVER_URI`, the native copy, so the
  SDK never reaches for a public server registry either.

On the first launch `app/LoadingApp/LoadingApp.tsx` finds no `server` key in
`settings.json` and writes that default before anything else runs;
`app/services/SettingsFileImpl.ts` fills it in again for a settings file that
predates the key. The emulator smoke test asserts the result rather than the
mechanism: it installs from nothing, drives the first launch to a wallet, and
reads the server back off the Settings screen. The desktop wallet shipped a
fresh install reading "NOT CONNECTED - No server configured" because only its
launcher script wrote the default, which is the defect that check exists for.

A fresh install runs in **basic mode**, whose Settings screen carries the
language and the About link and nothing else. The server row belongs to
advanced mode, so the test taps the mode pill in the drawer before it can read
the server back. Someone in basic mode has no way to see which server their
wallet uses.

The app speaks **only** SWARM: mainnet by default, the engineering testnet if
you choose it in Settings. There is no ZEC, no fiat price, no currency picker,
no donation toggle, no exchange or swap, and no public server registry: the app
never asks a third party which server to trust.

---

## Installing the APK on a phone

This APK is **debug-signed**, and sideloading is the only thing it is for. No
signing key exists in this repository. Android will treat it as an app from an
unknown source, which is correct. The Play build is a separate artifact with a
separate certificate — see "Google Play" below.

You need an Android **8.0 (API 26) or newer** phone with an `arm64-v8a` or
`armeabi-v7a` processor — that is every phone sold in the last decade.

1. **Get the APK.** Open the repository's
   [Actions tab](https://github.com/brs-holding/swarm-mobile/actions), pick the
   most recent successful **SWARM Android** run, and download the
   `swarm-wallet-android-<version>` artifact. It is a zip containing the APK,
   `SHA256SUMS` and `release-manifest.json`.

2. **Check the download.** Unzip it, then verify the APK is the file CI built:

   ```sh
   sha256sum -c SHA256SUMS
   ```

   Open `release-manifest.json` and confirm `network.genesis` is
   `045993f5c91ea160c7ebda573dd97b0016816bca68d395bfff202779b88e2a28` and
   `network.genesis_is_placeholder` is `false`. If it is `true`, that build
   cannot verify which chain a server is on — see "The genesis gate" below.

3. **Move the APK to the phone** — USB cable, or upload it somewhere you
   control and download it on the device. Do not pass it through a chat app
   that re-compresses attachments.

   It is a large file. The wallet's Rust library is about 60 MB per processor
   type and the APK carries all three, uncompressed, so expect roughly 200 MB.
   That is the price of one APK that installs on any phone without you having
   to know which chip it has.

4. **Allow this one installer.** Android blocks sideloading per-app, not
   globally. Open the APK from your file manager or browser; Android will say
   the app is not allowed to install unknown apps and offer a Settings
   shortcut. Enable **Install unknown apps** for *that* app (Files, Chrome,
   whichever you opened it from), then go back and tap Install.

   The manual route is **Settings → Apps → Special app access → Install unknown
   apps**, then pick the app you are installing from. Wording varies by
   manufacturer.

5. **Turn it back off** when you are done. It is a per-app permission; leaving
   it on for a browser is a standing risk for no benefit.

6. **Open "SWARM Wallet".** It installs alongside Zingo without touching it:
   the package name is different, so Android gives it its own private storage.
   A Zingo wallet on the same phone is not read, not migrated and not at risk.

To remove it: uninstall like any app. **Uninstalling deletes the wallet.** Back
up your seed phrase first — it is the only way back in.

---

## Google Play

Google Play refuses a debug-signed upload and wants an Android App Bundle
(`.aab`) rather than an APK. The `bundle` job in
`.github/workflows/swarm-android.yaml` produces both the bundle and a
release-signed APK.

### The upload key

The key is the owner's. It lives outside this repository — it is not in the
tree, not in the history, and not in any artifact CI uploads. CI reads it from
four repository secrets, named here and never printed:

| Secret | What it holds |
| --- | --- |
| `SWARM_UPLOAD_KEYSTORE_B64` | the `.jks` keystore, base64 |
| `SWARM_UPLOAD_KEYSTORE_PASSWORD` | the keystore password |
| `SWARM_UPLOAD_KEY_ALIAS` | the key alias inside the keystore |
| `SWARM_UPLOAD_KEY_PASSWORD` | the key password |

The job decodes the keystore into `$RUNNER_TEMP`, never into the checkout, and
deletes it in a step that runs whether the build passed or failed. Gradle picks
it up through the four `SWARM_UPLOAD_*` environment variables and prints
`****** SWARM UPLOAD-KEY SIGNING ******`. `-PrequireReleaseSigning=true` fails
configuration if the signing config would fall back to the debug keystore, so a
missing secret cannot produce a quietly unpublishable bundle.

With the secrets absent the job prints `no upload key configured - Play bundle
skipped` and finishes green, which is what happens on a branch that has none.

Before uploading, the job proves the artifacts: the certificate is not
`CN=Android Debug` and the AAB and the APK carry the same one (the SHA-256
fingerprint is printed and recorded in `release-manifest.json`), bundletool
reports what each ABI would actually download and fails over 190 MB, the 64-bit
libraries are 16 KB page aligned, no keystore, wallet file or seed fixture is
packaged, and no upstream branding reaches a user.

### The versionCode rule

**Play keeps every versionCode it has ever seen and refuses a repeat**, even
one from a release that was later deleted. The number comes from
`SWARM_ANDROID_VERSION_CODE` in the workflow's `env` block; raise it for every
upload. The source no longer carries it: `android/app/build.gradle.kts` reads
`-PswarmVersionCode` and `-PswarmVersionName`, defaulting to `1` and `0.1.0`
for a local build. The ceiling is 9999 — past that the split-APK encoding
(`abi * 10000 + build`) collides, and Gradle fails rather than ship it.

### The two signatures do not mix

A release-signed build and the debug-signed sideload build carry different
certificates. Android refuses to install one over the other and reports it as a
signature mismatch, which is the system working as intended.

**Write your recovery words down first.** Then uninstall the debug build —
which deletes its wallet — and install the release-signed one. There is no
upgrade path between the two and no way to move the wallet across.

The debug-signed APK stays sideload-only. It is what the private test runs on,
and it is never what goes to Play.

---

## What works, and what is not proven

Be precise about this, because a wallet that overstates itself is worse than no
wallet, and this one now holds real coins.

### Proven

- The app builds end to end in CI: JS lint, typecheck and unit tests; the Rust
  wallet library cross-compiled for `arm64-v8a`, `armeabi-v7a` and `x86_64`;
  Kotlin UniFFI bindings; a debug-signed APK.
- The APK installs on an Android emulator, launches, loads the native wallet
  library, runs its JS bundle and reaches its first screen without crashing.
  This is asserted by `scripts/swarm_smoke_test.sh` on every CI run.
- A fresh install already holds `https://lwd-main.swarm.green:8443` with
  nothing configured by hand. The same smoke test uninstalls first, drives the first
  launch to a wallet with `uiautomator`, and reads the server back off the
  Settings screen. It measures whether the runner can reach that server, and
  when it can, it also requires the app to report a connected state rather
  than "Offline".
- The app is pinned to the SWARM SDK, not upstream's. CI fails the build if the
  pin points back at `zingolabs/zingolib`.
- No upstream branding reaches a user. `scripts/check_no_upstream_branding.mjs`
  reads the shipped translations and then the built APK — the bundled JS
  string table and the app label — and fails the build on anything outside the
  attribution allow-list. The About screen credits Zingo Mobile and carries its
  MIT notice, which is required and deliberate.
- The APK contains what it claims: the eight bundled typefaces, the native
  wallet library for all three ABIs, `applicationId green.swarm.wallet`, no
  `zcash:` scheme, and a real genesis rather than the placeholder. CI unzips
  the APK and asserts each one.

### Not proven

- **No money has moved.** The smoke test proves the app comes up pointed at
  `lwd-main.swarm.green:8443`, creates a wallet, shows the mainnet risk notice
  and reports a connected state. No balance, no send and no receive has been
  exercised against SWARM Mainnet *from this app*.
- **Nothing on real hardware.** The emulator smoke test runs on x86_64. The
  `arm64-v8a` and `armeabi-v7a` libraries are built and packaged but have not
  been executed on a phone.
- **Seed backup, restore and biometric unlock** are upstream's, unmodified, and
  have not been re-verified against this build.
- **The Nym mixnet transport** is inherited from upstream and is off by
  default. It has not been exercised against either SWARM network.
- Screens inherited from upstream that have no meaning on this network yet
  (migration flows, address book chains) are present but untested here.

---

## The genesis gate

Each SWARM network's genesis hash lives in exactly **one** constant in the SDK.
Mainnet's is `01c34428b9e67cdd8345e0b365aaa37dd8d2d65d3869e0e5d77d567f2c39afdd`,
and the build records it in `release-manifest.json`. The paragraphs below
describe the same gate on the engineering testnet, whose constant is
`SWARM_TESTNET_GENESIS` in `zingolib/src/config.rs`. It holds the real hash:

```
045993f5c91ea160c7ebda573dd97b0016816bca68d395bfff202779b88e2a28
```

which is the value in `network/swarm-testnet/manifest.json`. An earlier
candidate, `06b0b56c…`, was superseded because its header timestamp was in the
future, and is not used by any build here.

That constant is what lets the app **prove** a server is on SwarmTestnet: the
SDK asks the indexer for its chain label and its genesis block, and refuses a
server that answers with anything else. A wallet opened against the wrong
chain is how coins get lost, so this is a refusal, not a warning.

The gate that guarded the placeholder is still in place.
`SWARM_TESTNET_GENESIS_PLACEHOLDER` and
`swarm_testnet_genesis_is_placeholder()` remain in the SDK, and the app
reports their answer rather than assuming it — see `swarm_network_identity()`
in `rust/lib/src/lib.rs`, which is covered by tests. If a future build ever
ships with the stand-in again, it will say so.

Every build records what it was made with, in `release-manifest.json`:

```json
"network": {
  "genesis": "01c34428b9e67cdd8345e0b365aaa37dd8d2d65d3869e0e5d77d567f2c39afdd",
  "genesis_is_placeholder": false
}
```

read out of the SDK revision the APK was actually built against, so the
manifest cannot drift from the binary.

---

## When something goes wrong

The app fails with one plain sentence rather than a stack trace:

- **The server cannot be reached.** Check the server address in Settings; the
  default is `https://lwd-main.swarm.green:8443`.
- **The server is on a different chain.** The app refuses it. A server that
  does not report `swarm-mainnet` is not a SWARM Mainnet server, and opening a
  wallet against the wrong chain is how coins get lost.
- **The explorer does not open.** The app checks whether the link can be
  opened before opening it, and reports it instead of throwing.

---

## Building it yourself

CI is the supported path — it is reproducible and needs nothing installed. The
workflow is `.github/workflows/swarm-android.yaml`; push to the `swarm-mobile`
or `play-release` branch, or run it from the Actions tab.

To build locally you need Linux or macOS with Docker, Node 22.18.0, Yarn and
JDK 17. A Windows host can run the JS checks but not the native build.

```sh
git clone https://github.com/brs-holding/swarm-mobile
cd swarm-mobile
git checkout swarm-mobile
yarn install --frozen-lockfile

# JS checks
yarn lint:check && yarn typecheck && yarn test

# Native wallet library for all ABIs, via Docker (upstream's script)
yarn rust:android

# Debug-signed APK
cd android && ./gradlew assembleProdRelease
```

The APK lands in `android/app/build/outputs/apk/prod/release/`.

`yarn rust:android` builds all four of upstream's ABIs. CI builds three — it
drops 32-bit x86, which no current phone or emulator image needs.

### Where the SDK comes from

`rust/Cargo.toml` pins three crates to
`Swarm-Official/privacy-zingolib`. That fork carries the SWARM network
identities (mainnet and the engineering testnet) and nothing else — chain type, chain label, birthday, the indexer identity check,
and a distinct wallet-file chain tag so a wallet from another chain cannot be
opened against the wrong genesis. Key derivation, signing, proving, note
scanning, address encoding and transaction building are upstream's, untouched.

To move the pin, change the `rev` in `rust/Cargo.toml` and the eight matching
`source =` lines in `rust/Cargo.lock`.

---

## Licence and attribution

Upstream zingo-mobile is MIT, and this fork keeps that licence and its
copyright notices — see `LICENSE`. The bundled fonts (Sora, Manrope, JetBrains
Mono) are SIL Open Font Licence 1.1; their licence files ship with them.

Official SWARM channels: <https://swarm.green>,
<https://github.com/brs-holding>, [@swarm_coin](https://x.com/swarm_coin),
`swarmofficial@atomicmail.io`. The app links to these and to nothing else.
