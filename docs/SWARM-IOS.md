# SWARM Wallet on iOS

> This document records the 2026-09-21 simulator work. Its account and
> release status is outdated. Use [the 2026-09-24 TestFlight handoff](ios/TESTFLIGHT-HANDOFF-2026-09-24.md)
> for the current branch, Apple setup, and open checks.

Status of this document: written by the iOS build agent on 2026-09-21,
extended on 2026-09-22 with the upload-readiness work (section 9).
Everything under "Proven" was executed in GitHub Actions and has a run URL.
Everything else is described, not done.

> **The iOS deliverable today is a SIMULATOR build.**
> There is no Apple Developer Program account for this project, so no build
> can be signed, no build can be installed on a physical iPhone, and no
> build can go to TestFlight or the App Store. The workflow proves the app
> compiles and runs; it stops exactly there, on purpose.

---

## 1. What exists

| Thing | Where |
| --- | --- |
| Workflow | `.github/workflows/swarm-ios.yml`, branch `swarm-ios` |
| Rust library for iOS | upstream `rust/ios/build_ios.mjs`, run unmodified |
| App project | `ios/Zingo.xcworkspace`, scheme `Zingo` |
| Brand artwork (vector) | `ios/branding/swarm-mark.svg`, `ios/branding/swarm-appicon.svg` |
| Art renderer | `ios/scripts/generate-ios-art.sh`, `ios/scripts/flatten-png.swift` |
| Launch screen | `ios/Zingo/LaunchScreen.storyboard` |
| Owner instructions | this file |

The Xcode **target, scheme and product name stay `Zingo`**. They are build
identifiers, never shown to a person. Renaming them would touch the
workspace, the Podfile target, the test bridging header and the
`$(PRODUCT_MODULE_NAME).SceneDelegate` reference in `Info.plist` for no
user-visible gain. What a person sees is `CFBundleDisplayName`, and that
says **SWARM Wallet**.

### iOS identity

| Setting | Upstream | SWARM |
| --- | --- | --- |
| Display name | `Zingo` | **SWARM Wallet** (`SWARM Wallet Beta` for the beta configurations) |
| Bundle identifier | `org.ZingoLabs.Zingo` | **`green.swarm.swarmwallet`** (`green.swarm.swarmwallet.beta`) |
| `DEVELOPMENT_TEAM` | `788KRST4S8` (Zingo Labs) | empty — this project has no team |
| `zcash:` URL scheme | claimed | **removed** |
| `LSApplicationQueriesSchemes` | `zcash` | removed |
| App icon | Zingo artwork (PNGs in the repo) | SWARM hive bee, rendered in CI from SVG |
| Launch screen | `Zingo` in white on black, and never shown (see below) | warm black `#0A0908` with the hive bee |
| Minimum iOS | 16.0 | 16.0, unchanged |
| Entitlements | `aps-environment: development` | **empty** — the app registers for no remote notifications, so the entitlement is removed (see 9.2) |
| Background modes | `fetch`, `processing`, `remote-notification` | `fetch`, `processing` — sync only |
| Device family | iPhone + iPad (`1,2`) | **iPhone only (`1`)** |
| Build number | `CURRENT_PROJECT_VERSION = 1`, static | derived in CI from `github.run_number` (see 9.1) |
| Face ID / Touch ID / keychain | `ios/DeviceAuth.swift` | unchanged, byte for byte |
| Analytics | none | none |

Two upstream details worth naming:

* **The launch screen never appeared.** `UILaunchStoryboardName` read
  `LaunchScreen.storyboar` — a typo, so iOS found no storyboard. Corrected
  to `LaunchScreen`, which is why the SWARM launch screen is the first
  thing this build shows.
* **The `zcash:` claim is removed, not renamed.** SWARM is a separate test
  network; a SWARM wallet must not intercept Zcash payment links on
  anyone's phone. Nothing depends on the claim: the `zcash:` handling in
  the shared JavaScript parses strings that are pasted or scanned, not
  links routed by iOS. (The Android manifest still claims the scheme —
  that file belongs to the other agent.)

### The app icon is generated, not stored

`ios/branding/swarm-appicon.svg` is the only copy of the mark. CI installs
`librsvg` and runs `ios/scripts/generate-ios-art.sh`, which renders all 19
icon sizes into both app-icon sets plus the launch mark at 1x/2x/3x, then
strips the alpha channel that iOS icons must not carry. **No icon website
or third-party icon service is used, and no PNG of the mark is committed.**

If you open the project in Xcode on a Mac, run the script once first or
the asset catalog will report missing images:

```sh
brew install librsvg
bash ios/scripts/generate-ios-art.sh
```

The mark follows the design system exactly: hexagonal body `#FF8A1F`, two
stripes in the background colour `#0A0908`, two honey `#FFB020` elliptical
wings, on warm black. **Never tilt it and never give it a face.**

---

## 2. What the workflow does

`swarm-ios.yml` runs on `macos-latest` and has five jobs.

1. **`preflight`** — records what the hosted runner actually is. Every
   version pinned in the file is pinned against this.
2. **`rust-xcframework`** — installs the three iOS Rust targets
   (`aarch64-apple-ios`, `aarch64-apple-ios-sim`, `x86_64-apple-ios`),
   `protoc` and `bindgen-cli`, then runs upstream's `rust/ios/build_ios.mjs`
   **unmodified**: uniffi Swift bindings, three `cargo build --release`
   runs, `lipo` of the two simulator slices, and two XCFrameworks. The
   finished XCFrameworks are cached on the Rust source hash — 0.35 GB
   that skips the whole hour whenever `rust/` is unchanged. The cargo
   cache keeps the registry and git checkouts but **not** the
   cross-compiled target directories: with them it was 5.59 GB of the
   repository's shared 10 GB, which starved the Android pipeline for a
   saving only the rarer `rust/`-changed build sees.
3. **`app-simulator`** — renders the icons, `yarn`, `pod install`, an
   **unsigned Release build for the iOS Simulator**
   (`CODE_SIGNING_ALLOWED=NO`), then creates and boots a simulator,
   installs the `.app`, launches it, screenshots it, checks it is still
   running, and uploads the zipped `.app` with `SHA256SUMS`.
   Release and not Debug so the JavaScript is bundled into the app: the
   artifact is standalone and the screenshot is real evidence rather than a
   Debug build's error screen about a missing Metro server.
4. **`string-sweep`** — reads the **built** app and fails while anything a
   person can see still says Zingo: the bundled JavaScript (Hermes
   bytecode keeps its string table, so `strings` finds it), the
   user-visible `Info.plist` keys, and the `.strings`/`.storyboard`/`.xib`
   resources. Licence and attribution lines are allow-listed — keeping the
   MIT notices is required, not a leak. Internal identifiers are
   deliberately out of scope and are **not** renamed: the React Native
   root module name, background-task identifiers, keychain service names,
   storage keys, the Xcode target and scheme, and SDK symbols such as
   `ZingolibError`.
   It is a separate job so that "does the app build" stays a readable
   answer independent of "is the rebrand finished". It complements
   `scripts/check_no_upstream_branding.mjs` on the shared side rather than
   duplicating it: that one reads the source, this one reads the artifact
   that would actually ship.
5. **`signed-release`** — **disabled**. Section 5.

### A note on the Actions cache, for whoever hits it next

A repository gets **10 GB of Actions cache in total**, shared by every
branch and both agents, and GitHub evicts least-recently-used without
warning. On 2026-09-21 the Android workflow saved three ~2.2 GB per-ABI
caches and evicted this pipeline's xcframework cache minutes after it was
written.

So the xcframework travels between the two iOS jobs as a **run-scoped
artifact**, not through the cache. The cache is kept purely as a
build-skip optimisation: when it survives, the hour-long Rust build is
skipped; when it does not, the build simply runs again. Nothing fails
because of an eviction. Do not reintroduce `fail-on-cache-miss` on the
consumer side.

Pinned versions and why:

| Pin | Value | Evidence |
| --- | --- | --- |
| Xcode | 26.5 | `macos-latest` ships Xcode 26.0 – 26.6 and defaults to 26.6, but has **no iOS 26.6 simulator runtime** — only 26.2, 26.4 and 26.5. Pinning 26.5 keeps the SDK and the runtime on the same version. |
| Simulator runtime | iOS 26.5, falling back to the newest present | same inventory |
| Simulator device | iPhone 17, falling back to the first iPhone present | same inventory |
| Node | 22.18.0 | repository `.nvmrc` |
| Deployment target | iOS 16.0 | upstream `ios/Podfile` and `IPHONEOS_DEPLOYMENT_TARGET` |

---

## 3. Running it yourself, on a simulator

This needs **a Mac and Xcode, and nothing else** — no Apple Developer
account, no payment, no signing, no enrolment. It is the whole iOS
deliverable until the account in section 5 exists.

**What you need:** a Mac (Apple silicon or Intel) and Xcode from the Mac
App Store, which includes the iPhone Simulator. Xcode is free. First
launch asks to install "additional components" — let it.

**Step by step:**

1. Open the branch's Actions page, pick the most recent green
   **SWARM iOS** run, and download the artifact
   **`swarm-ios-simulator-app`**. It contains
   `SwarmWallet-simulator.app.zip` and `SHA256SUMS`.
2. Check what you downloaded is what CI built. In Terminal, in the
   download folder:
   ```sh
   unzip -o swarm-ios-simulator-app.zip        # GitHub wraps artifacts in a zip
   shasum -a 256 -c SHA256SUMS                 # must print: OK
   ```
   If that does not print `OK`, stop and say so — do not install it.
3. Unpack the app itself:
   ```sh
   ditto -x -k SwarmWallet-simulator.app.zip .
   ```
   You now have `Zingo.app`. That filename is the internal Xcode product
   name and is expected; the app calls itself SWARM Wallet everywhere a
   person can see.
4. Start a simulator. Open Xcode once, then:
   ```sh
   open -a Simulator
   xcrun simctl boot "iPhone 17"     # skip if one is already running
   ```
5. Install and launch:
   ```sh
   xcrun simctl install booted Zingo.app
   xcrun simctl launch booted green.swarm.swarmwallet
   ```
6. The app opens on its privacy shutter and asks you to authenticate. On a
   simulator, enrol a face first — Simulator menu → **Features → Face ID →
   Enrolled** — then launch again and use **Features → Face ID → Matching
   Face**.

**What this does and does not tell you.** It shows the real app: the
SWARM name, icon, launch screen, typefaces and screens, running the real
Rust wallet library. It does **not** prove anything about syncing,
sending or receiving — that needs `lwd.swarm.green` reachable — and a
simulator is not a phone: no Secure Enclave, no real Face ID, no push
notifications, and different performance.

**You cannot put this build on an iPhone.** A simulator `.app` is a
different architecture and carries no signature; there is no side-load
path on iOS that avoids Apple-issued signing material. That is section 5.

## 4. What only the owner can do

None of this can be done by an agent. It needs a legal identity, a payment
method and Apple's agreement — three things no agent may supply.

### 4.1 Enrol in the Apple Developer Program **as an organisation**

This is not a preference. App Review guideline **3.1.5(b)(i)** allows
cryptocurrency **wallets** only from developers **enrolled as an
organisation**. An individual account cannot ship this app, however
complete it is.

Enrolling as an organisation requires, on Apple's side:

* a **D-U-N-S number** for the legal entity (free from Dun & Bradstreet,
  usually days, sometimes weeks);
* the entity in good legal standing, with a **public website on a domain
  the entity owns** — `swarm.green` serves;
* the person enrolling having **legal authority to bind the entity**, which
  Apple verifies, sometimes by phone;
* the annual fee (USD 99 at the time of writing), paid with the owner's own
  payment method.

Budget weeks, not hours. It is the long pole in the whole iOS path.

> **Related guideline, for the record:** **3.1.5(b)(ii)** forbids apps that
> mine cryptocurrency unless the processing happens off device. That is why
> the SWARM mobile wallet is a wallet only and contains no miner. Do not add
> one for iOS, ever.

### 4.2 Create the App ID and signing material

In the Apple Developer portal, once enrolled:

1. **Identifiers → App IDs → +** → App, explicit bundle ID
   **`green.swarm.swarmwallet`**. It must match the project exactly. Enable only
   the capabilities the app actually uses; the app adds **no** entitlement
   beyond upstream's push-notification `aps-environment`.
2. Either **(a)** an **App Store Connect API key** (Users and Access →
   Integrations → App Store Connect API, role *App Manager*): download the
   `.p8` **once** — Apple never shows it again — and note the Key ID and
   the Issuer ID; **or (b)** a distribution certificate (`.p12` with a
   password) plus an App Store provisioning profile for the App ID. The
   disabled job in the workflow expects **both**: the certificate and
   profile to sign, the API key to upload.
3. In **App Store Connect**, create the app record for
   `green.swarm.swarmwallet`, name it *SWARM Wallet*, and set the primary
   category (Utilities is what the project declares).

### 4.3 Add the repository secrets

`Swarmcoin/swarm-mobile` → Settings → Secrets and variables → Actions.
(The organisation was renamed from `brs-holding` on 2026-09-22; old URLs
redirect.)
**Names only below. Never paste a value into a chat, an issue, a commit, a
log or a file in this repository.** The workflow reads them only inside the
`apple-distribution` environment, which the owner should also create with
required reviewers so a release cannot start unattended.

**Four secrets are enough.** The job now picks its signing path from what
exists, and the short path needs no certificate file at all.

| Secret name | Needed | What goes in it |
| --- | --- | --- |
| `APPLE_TEAM_ID` | always | the 10-character team ID |
| `APPLE_APP_STORE_CONNECT_KEY_ID` | always | the API key's Key ID |
| `APPLE_APP_STORE_CONNECT_ISSUER_ID` | always | the API key's Issuer ID |
| `APPLE_APP_STORE_CONNECT_KEY_P8` | always | the `.p8` file, base64-encoded |
| `APPLE_DISTRIBUTION_CERT_P12` | only for manual signing | the distribution `.p12`, base64-encoded |
| `APPLE_DISTRIBUTION_CERT_PASSWORD` | only for manual signing | that `.p12`'s password |
| `APPLE_PROVISIONING_PROFILE` | only for manual signing | the `.mobileprovision`, base64-encoded |

With the first four alone the job archives with automatic signing and
`-allowProvisioningUpdates`, and Xcode creates the distribution
certificate and the App Store profile itself — no certificate file and no
certificate password ever leave Apple. Supplying the last three switches
the job to manual signing; supplying *some* of them is refused, because a
half-configured certificate is a silent wrong signature waiting to happen.

Base64 on a Mac: `base64 -i AuthKey_XXXX.p8 | pbcopy`.

---

## 5. The signed / TestFlight job (written, disabled)

The `signed-release` job in `swarm-ios.yml` is complete and **cannot run
today**, by two independent locks:

1. it runs only on a manual `workflow_dispatch` with the input
   `signed_release` set to true, which defaults to **false**; and
2. its first step enumerates the seven secrets above and **fails the job**
   if any is empty, before any signing step is reached.

When the secrets exist, it would: import the `.p12` into a **throwaway
keychain created for that job alone**, install the provisioning profile,
`xcodebuild archive` for `generic/platform=iOS` with manual signing,
`-exportArchive` with `method: app-store-connect`, upload the `.ipa` with
`xcrun altool` and the API key, and then delete the keychain, the profile
and the private key in an `if: always()` step. Nothing is ever echoed.

**No signing material belongs in this repository, in these logs or in any
artifact.** If a certificate or key is ever pasted somewhere it should not
be, treat it as compromised and revoke it in the developer portal.

### What TestFlight review will ask about

TestFlight has two paths:

* **Internal testers** (up to 100 people who are users on the App Store
  Connect team): **no review**. This is the realistic first step — the
  owner can install SWARM Wallet on their own iPhone this way within a day
  of the account existing.
* **External testers** (up to 10 000, by email or public link): each build
  needs **Beta App Review**, a shorter review than the App Store but
  against the same guidelines. For a testnet crypto wallet, expect:
  * **3.1.5(b)(i)** — the organisation check. This is the one that fails
    outright on an individual account.
  * **2.1 / App completeness** — the reviewer will run it. The wallet must
    reach a usable state against a server that is up. `lwd.swarm.green`
    must be reachable from Apple's network, or the build is rejected as
    non-functional.
  * **Demo instructions** — supply a seed phrase for a funded testnet
    wallet and say plainly, in the "What to Test" notes and in the app,
    that **SWM are test coins on a private test network and have no value
    and cannot be bought or sold**. Ambiguity here reads as a financial
    product and invites a much harder review.
  * **Export compliance.** `Info.plist` inherits
    `ITSAppUsesNonExemptEncryption = false` from upstream. A shielded
    wallet performs cryptography well beyond authentication, so **the owner
    should confirm that declaration with their own legal advice before any
    upload.** No agent changed it and no agent can decide it.
  * **Guideline 2.2** — beta, demo and trial versions belong on TestFlight
    and are not accepted on the App Store. A testnet wallet is a
    TestFlight product; do not plan an App Store listing for it.

### What is impossible without the account

* **Installing on a physical iPhone.** A simulator `.app` cannot be
  installed on a phone — different architecture, different bundle, no
  signature. There is no side-load path on iOS that does not involve
  Apple-issued signing material.
* The one lesser route is a **free** Apple ID used from Xcode on a Mac,
  which issues a personal development profile that **expires after 7 days**
  and is limited to a handful of devices. It still needs: a Mac, a cable,
  the phone, and a human signed in to that Apple ID. This project has no
  Mac, so that route is unavailable here too, and it can never reach
  TestFlight.
* TestFlight, App Store, push notifications on device, and any test of Face
  ID against real hardware all wait on the same account.

---

## 6. Proven vs assumed

**Proven** (each has a workflow run behind it — see the branch's Actions):

* The Rust wallet library and the Nym proxy shim build for all three iOS
  targets on a hosted macOS runner and pack into XCFrameworks.
* The app compiles for the iOS Simulator with signing disabled.
* The built `.app` installs on a booted simulator, launches, and is still
  running afterwards; screenshots are uploaded as artifacts.
* The built bundle carries the SWARM bundle identifier, the SWARM display
  name and no URL-scheme claim.

**Assumed, not proven:**

* Anything on a physical iPhone. No device has ever run this build.
* Anything about App Review's actual response. The guidelines are quoted;
  reviewers decide.
* Wallet behaviour against a live SWARM network. The genesis hash is no
  longer a placeholder — the merged SDK pin carries SwarmTestnet's real
  genesis `045993f5c91ea160c7ebda573dd97b0016816bca68d395bfff202779b88e2a28`
  — but no iOS build has yet synced a block. The screenshots prove the app
  starts and reaches its authentication gate; they prove nothing about
  syncing, sending or receiving. That needs `lwd.swarm.green` reachable
  and a run that gets past the gate.

## 7. What is shared and what is iOS-only

Two agents work in this repository. Getting this boundary wrong means the
same job done twice, or differently on each platform.

**iOS-only — changed here, and nowhere else:**

| Area | File |
| --- | --- |
| Display name, bundle id, version, team | `ios/Zingo.xcodeproj/project.pbxproj` |
| Permission prompts, URL schemes, fonts, launch storyboard, copyright | `ios/Zingo/Info.plist` |
| Launch screen | `ios/Zingo/LaunchScreen.storyboard` |
| App icon + launch mark (vector and renderer) | `ios/branding/`, `ios/scripts/` |
| Bundling the shared typefaces into the app | `ios/Zingo.xcodeproj` folder reference + `UIAppFonts` |
| The pipeline | `.github/workflows/swarm-ios.yml` |

**Shared — owned by the `swarm-mobile` branch, consumed here:** the
network identity and SDK pin (`rust/`), every screen and string
(`app/`, `screens/`, `ui/`, `app/translations/*.json`), the palette and
type scale (`app/theme/`), the typeface files themselves
(`assets/fonts/`), and the removal of the fiat picker and donation
surfaces. The iOS build renders those; it does not define them.

Two specifically worth naming, because they look iOS-shaped and are not:

* **The typefaces.** The `.ttf` files and `app/theme/typography.ts` are
  shared. But `react-native.config.js` declares `project: { android: {} }`
  and the app does no runtime font loading, so linking them into the iOS
  bundle is iOS work, done here. Without it every `fontFamily: 'Sora-…'`
  falls back to the system face — silently, which is why the build now
  fails if a face named in `UIAppFonts` is missing from the app.
* **The authentication prompt.** The title on the iOS passcode sheet is
  `CFBundleDisplayName` (iOS-only, fixed here). The subtitle under it is
  the `localizedReason` passed in from shared JavaScript.

### Open items for the shared branch (found by the iOS sweep)

Both are shared JavaScript, so they are fixed on `swarm-mobile`, once, for
both platforms — not here.

1. **"Zenny Tips" still ships, in four languages.** `app/translations/`
   carries `zenny-tips-ab` = "Zenny Tips" (en), "Zenny Propinas" (es),
   "Zenny Gorjetas" (pt), "Zenny Tavsiyeleri" (tr), and
   "Поддержать Zenny" (ru). A *Zenny* is upstream's name for its 0.01 ZEC
   donation unit, so this is donation branding on a screen after the
   donation surfaces were removed. `scripts/check_no_upstream_branding.mjs`
   passes on it because `Zenny` is not in its `FORBIDDEN` list — adding it
   there is the fix, plus deleting the strings.
2. **`app/utils/ZingoAppData.ts:59` is now dead logic.** It reads
   `getApplicationName() === 'Zingo Beta' ? BETA_LOGO : PROD_LOGO`. The
   display name is now "SWARM Wallet" / "SWARM Wallet Beta", so that
   comparison can never be true and the beta build silently shows the
   production logo. This is a behavioural consequence of the rename, not
   cosmetics.

Also worth a decision on the shared side: `zennies` is still referenced in
ten files (`app/LoadedApp`, `app/walletBackend`, `screens/AddressBook`,
`screens/History`, …), and the iOS bridge still exposes
`getZenniesDonationAddress` / `getDonationAddress` in `ios/RPCModule.swift`
because they forward to the SDK. Those native methods were left in place
deliberately: removing them while the shared JavaScript still calls them at
startup would break iOS only, which is exactly the platform divergence to
avoid. They should go when the shared callers do.

## 8. What remains

**The genesis hash is in.** The SDK pin
`8507eac5caf1e0e7abe739dcbfb4bf2501f7ff0f` carries the real
`045993f5…` and keeps `swarm_testnet_genesis_is_placeholder()` as a
release gate, which this build reports rather than assumes.

**After the owner has an organisation account** — add the seven secrets,
create the `apple-distribution` environment with required reviewers, run
the workflow manually with `signed_release: true`, and take the first build
to **internal** TestFlight testers before considering external testing.

---

## 9. Upload readiness (2026-09-22)

Everything in this section is about the *first* TestFlight upload: the
things App Store Connect checks before a human ever sees the app, and the
things a reviewer looks at first. The full work list is
`docs/ios/06-BUILD-REQUIREMENTS.md` in the project vault.

### 9.1 The build number now increases by itself

`MARKETING_VERSION` stays `0.1.0` for the whole testnet series.
`CURRENT_PROJECT_VERSION` is computed in CI as
`github.run_number + BUILD_NUMBER_OFFSET` (offset `1000`, so the first one
is well clear of the `1` in the project file) and injected on the
`xcodebuild` command line for both the simulator build and the signed
archive. The job then reads `CFBundleVersion` back out of the built bundle
and fails if it is not the number it asked for, and prints version, build
and commit into the job summary.

The project file keeps `CURRENT_PROJECT_VERSION = 1`. That is deliberate:
it is what makes the project open and build in Xcode with no environment,
and CI overrides it. If the fallback path of D7 is ever used — a manual
Xcode archive on someone's Mac — **set the build number by hand in Xcode
first**, higher than any build CI has uploaded.

### 9.2 No push entitlement, no push background mode

The app registers for **no** remote notifications: there is no
`registerForRemoteNotifications`, no
`didRegisterForRemoteNotificationsWithDeviceToken`, no
`UNUserNotificationCenter` delegate and no push SDK in `ios/*.swift`,
`app/`, `screens/` or `ui/`. The only notification dependency is
`@notifee/react-native`, which schedules **local** reminders.

So `aps-environment` is gone from `Zingo.entitlements` (now an empty
`<dict/>`) and `remote-notification` is gone from `UIBackgroundModes`.
This matters beyond tidiness: a provisioning profile whose App ID does not
carry the Push Notifications capability **refuses** an entitlement that
asks for it, which would have failed the very first upload. `fetch` and
`processing` stay — they are what continues wallet synchronisation, and
that is the sentence for the App Review notes.

### 9.3 The bundled privacy manifest is the complete one

`ios/Zingo.xcodeproj` references the **root** `ios/PrivacyInfo.xcprivacy`,
not the near-identical copy in `ios/Zingo/`. Apple reads the manifest that
is actually bundled, and the root one was missing `NSPrivacyTracking` and
`NSPrivacyCollectedDataTypes`. Both keys are now in the root file
(tracking `false`, collected data an **empty array** — present and empty,
because a missing key is "unanswered" and an empty one is "nothing").

The simulator job now reads `PrivacyInfo.xcprivacy` out of the built
`.app`, prints its SHA-256 next to both source files so the summary says
which one shipped, prints the manifest, and fails if either key is absent
or if tracking is not `false`.

### 9.4 Permissions: only the ones that exist

* `NSLocationWhenInUseUsageDescription` — **deleted**. `ios/Podfile` now
  sets `$VCEnableLocation = false` before `use_react_native!`, which keeps
  VisionCamera's own `CLLocationManager` out of the build (it is on by
  default so a photo can carry a GPS tag; this app scans QR codes and takes
  no photo). Run 35737908538 confirms it took effect — the pod install log
  reads `[VisionCamera] $VCEnableLocation is set to false!`.

  **The binary still links CoreLocation and still references
  `CLLocationManager`, and both are correct.** It took two failed runs to
  get this check right, so the reasoning is written down rather than
  repeated:

  * Run 35737908538 failed on the *load commands*. React Native compiles
    `RCTConvert+CoreLocation` into React-Core, so **every** React Native app
    links CoreLocation; the same run logs `libtool: warning:
    'RCTConvert+CoreLocation.o' has no symbols`.
  * Run 35741774745 then failed on the *symbol table*, on
    `_OBJC_CLASS_$_CLLocationManager`. That symbol is real, and still proves
    nothing: VisionCamera compiles `ios/Core/**/*.swift` unconditionally, so
    `LocationProvider.swift` (which holds a `CLLocationManager` and calls
    `startUpdatingLocation()` in its `init`) and
    `CLLocationManager+requestAccess.swift` (which calls
    `requestWhenInUseAuthorization()`) are in the binary whatever the flag
    says. What `$VCEnableLocation = false` removes is every **call site**:
    the only `LocationProvider()` construction
    (`CameraSession+Location.swift`), `requestLocationPermission` and
    `getLocationPermissionStatus` (`CameraViewManager.swift`) are each
    inside `#if VISION_CAMERA_ENABLE_LOCATION`, and with the condition unset
    they throw `locationNotEnabled` or return `.restricted` instead.
    Separately, `react-native-device-info` calls four `CLLocationManager`
    **class** methods that only read status — `locationServicesEnabled`,
    `significantLocationChangeMonitoringAvailable`, `headingAvailable`,
    `isRangingAvailable`. None of them prompts, none needs a purpose string,
    and this app never calls the JavaScript that reaches them.

  Neither linkage nor a symbol can tell code that runs from code that is
  merely compiled, so the check asserts the **mechanism** instead, and CI
  fails if either half changes:

  1. `VISION_CAMERA_ENABLE_LOCATION` must be **absent** from VisionCamera's
     generated xcconfig under `ios/Pods/Target Support Files` — that is the
     condition gating every call site, and the step errors out rather than
     passing quietly if the xcconfig cannot be found at all;
  2. `app/`, `screens/`, `ui/` and `ios/*.swift` must contain **no** location
     API — no `CLLocationManager`, no authorization request, not even
     device-info's `isLocationEnabled`;
  3. and `NSLocationWhenInUseUsageDescription` must stay out of Info.plist.

  What the binary links and references is printed as a **note**, because
  that is all it is.
* `NSPhotoLibraryUsageDescription` → `NSPhotoLibraryAddUsageDescription`.
  The read key asked for the whole library; nothing here reads photos.
  **Recorded honestly:** a sweep of `app/`, `screens/`, `ui/` and
  `ios/*.swift` finds no photo-library API *at all* — no CameraRoll
  dependency, no `PHPhotoLibrary`, no `UIImageWriteToSavedPhotosAlbum` —
  and the receive QR is rendered on screen by `react-native-qrcode-svg`
  and never saved. `Photos.framework` *is* in the load commands (run
  35737908538), but by the same rule as CoreLocation that is linkage, not
  usage. CI reports, advisory and not fatal, whether any symbol that writes
  to the library survives; if none does, this key should be deleted too.
  Advisory rather than enforced on purpose: deleting a purpose string that
  a pod turns out to reach dynamically is a crash, not a warning.
* `NSCameraUsageDescription` and `NSFaceIDUsageDescription` — kept. Both
  features exist.

### 9.5 iPhone only, and no macOS key

`TARGETED_DEVICE_FAMILY` is `1` in all four app configurations. iPhone-only
apps still run on iPad in compatibility mode, and the change is one line to
reverse — but universal would oblige a 13-inch iPad screenshot set and an
iPad layout review for a first testnet build. `LSMinimumSystemVersion`, a
macOS key that had no business in an iOS-only plist, is removed. CI asserts
both from the built bundle.

### 9.6 The signed job takes either path

See the secrets table in 4.3. The job:

1. refuses to run unless the four API-key secrets exist;
2. refuses to run if *some* but not all of the certificate trio exists;
3. picks `automatic` (API key, `-allowProvisioningUpdates`) or `manual`
   (`.p12` + profile in a throwaway keychain) from what it found. The
   automatic path also forces `CODE_SIGN_IDENTITY="Apple Distribution"`,
   because the project inherits upstream's
   `CODE_SIGN_IDENTITY[sdk=iphoneos*] = "iPhone Developer"` and automatic
   signing would otherwise hunt for a *development* certificate for a build
   headed to the App Store. **The API key must be an Admin key on this path:**
   an App Manager key can upload but cannot mint certificates;
4. archives with the derived build number, reads the archive back and
   fails if the build number or the bundle id is not what it asked for;
5. exports with method `app-store-connect`;
6. uploads with `xcrun altool --upload-app --apiKey --apiIssuer`;
7. writes signing style, version, build, commit, the `.ipa`'s SHA-256 and
   the delivery UUID into the job summary; and
8. deletes the keychain, the profile and both copies of the API key in an
   `if: always()` step.

It has **never been run**, and cannot be until the secrets exist. What was
checked instead, on 2026-09-22:

* `actionlint` 1.7.7 over the whole workflow: clean.
* `bash -n` over every `run:` block in the file: clean.
* the refusal step's own shell, run against five combinations with **fake
  placeholder values** (no real secret exists anywhere in that work): no
  secrets → refuses; the four API-key secrets → `automatic`; four plus the
  whole certificate trio → `manual`; four plus a certificate but no password
  or profile → refuses; three of the four → refuses.

What that does **not** prove is anything downstream of the refusal: no
archive, no export and no upload has ever run, and none can until the account
exists.

### 9.7 Still open, and not an agent's to close

* **Export compliance** (`ITSAppUsesNonExemptEncryption`, currently
  `false`, inherited from upstream) — owner and legal advice, see
  `docs/ios/03-APPLE-GUIDELINES-CHECK.md`. Do not upload before it is
  confirmed.
* **The Apple Developer Program organisation account itself**, the App ID,
  the App Store Connect app record and the API key. Section 4.
* **A funded App Review wallet** or a faucet, so a reviewer can exercise
  Send (`06-BUILD-REQUIREMENTS.md` item C5).
* **Store screenshots at 6.9-inch size** from a synced wallet with real
  SWM amounts (item B8).

---

## 10. What App Review will look at (2026-09-22)

Four content changes and one piece of evidence. Three of the four are in the
**shared** JavaScript (`app/`, `screens/`, `ui/`), made on `swarm-ios` so CI
could prove them, and **meant to be cherry-picked onto `swarm-mobile`** — see
section 10.5.

### 10.1 No "Coming soon" card

`screens/MigrationStrategy/MigrationStrategy.tsx` shipped a third option card,
greyed out, with a "Coming soon" badge: the private two-phase migration path
(split notes, then send batches inside scheduled windows). Guideline 2.1 reads
a placeholder feature as an incomplete app, so the card is not rendered —
`SHOW_PRIVATE_MIGRATION_OPTION = false`.

Nothing else is removed. The `'private'` option, the `MigrationSplitPlan`
route, the screens behind it and the translations all stay. Flipping that one
constant is the whole of putting the card back, the day the path works.

### 10.2 The Nym mixnet is not offered on SwarmTestnet

The "Enhanced Privacy" toggle in Settings, the Nym gate sheet in the migration
flow, the Send toggle and the mixnet pill in the sync status bar were all
visible, because `mixnetView` is non-null by default.

**No mixnet send has ever been demonstrated against `lwd.swarm.green` on
SwarmTestnet** — not by this agent, not by any build, on any device. Nobody
has watched one work. A visible feature that fails is a 2.1 rejection, so the
surfaces are gated off for this chain:

* `app/walletBackend/transforms/mixnetAvailability.ts` answers whether a chain
  offers the mixnet. SwarmTestnet is not in the set; `main`, `test` and
  `regtest` are, which keeps the Storybook stories and the unit tests honest.
* `LoadedApp` applies it once, where the context is assembled: `mixnetView`
  becomes `null` and `nym` becomes `false`. Every consumer already renders
  nothing when `mixnetView` is null, so one gate hides all of them. `nym` is
  forced with it so a setting left `true` by an earlier build cannot route a
  send through a transport whose switch is no longer visible.
* `MigrationStrategy` needs its own check, because it presents the gate sheet
  unconditionally: with no mixnet on offer, Start migrates straight away.

**Nothing is deleted.** The transport, the coordinator, the transforms, the
sheet and their tests are all still here and still tested;
`__tests__/MigrationStrategy.nymGate.unit.tsx` now says which chain each test
is on, and has a new case pinning the gate itself. One edit to the set in
`mixnetAvailability.ts` turns it back on — **after** a mixnet send is proven
end to end, not before. §4.2 of the privacy policy, which describes the
mixnet, comes out while this is off.

### 10.3 Legal links, and a risk notice that is shown once

Settings → About now has a **Legal** section with four entries:

| Entry | Where it goes |
| --- | --- |
| Privacy policy | `https://swarm.green/wallet/privacy` |
| Terms of use | `https://swarm.green/wallet/terms` |
| Risk notice | opens **inside the app** |
| Open-source notices | `https://swarm.green/wallet/notices` |

The three web links open in the system browser. **Those pages are not
published yet**, which is expected and is recorded rather than hidden: the app
side is finished so it can be reviewed, and the website agent publishes the
four pages from the drafts in the vault (`docs/ios/legal/`). Guideline
5.1.1(i) needs the privacy policy reachable from inside the app; the MIT
licence this fork inherits needs the notices.

The risk notice opens inside the app on purpose. It is the text a person
acknowledged before their wallet existed, and a wallet that can only show it
again when the network is up is a wallet that asked someone to agree to
something they can no longer read.

**"Before you start"** (`ui/widgets/RiskNotice.tsx`) is shown once per
installation, with a single **I understand** button, before any wallet comes
into existence. It is wired into `LoadingApp.ensureRiskNoticeAcknowledged`,
which `createNewWallet` and `getwalletToRestore` both await — and
`createNewWallet` is also the **basic-mode first launch, which creates a
wallet with no user action at all**. That is exactly the case the notice
exists for: without gating it there, the person it is written for would never
see it.

The text lives in `app/legal/riskNotice.ts`, word for word from
`docs/ios/legal/RISK-NOTICE.md`, which is also the source of the published
page — one source, two renderings. It is deliberately **not** translated: a
translated liability disclaimer is a different disclaimer, and nobody here is
qualified to write one in five languages. The link labels around it are UI and
are translated, in all five catalogues.

The gate does **not** cover the server check that runs before it, so a fresh
install still reaches `lwd.swarm.green` by itself. What is gated is the
wallet, not the network.

### 10.4 Fresh-install evidence (item C9)

The simulator job now answers "what does a fresh install do, with nobody
touching it?" from the artifact and from the wire, not from a screenshot
somebody read:

1. **The default server.** After the run, the app's data container is opened
   and `Documents/settings.json` is read. The job **fails** unless
   `server.uri` is `https://lwd.swarm.green:443` and `server.chainName` is
   `swarm-testnet`. Nothing was typed and nothing was chosen, so this is the
   reviewer's first minute, asserted.
2. **The connection.** `tcpdump` runs on the runner from before the app
   launches. `lwd.swarm.green` is resolved first, and the capture is then read
   back for packets to that address on 443 and for DNS naming it. Best effort
   and reported either way — the wallet talks gRPC over raw sockets, so
   nothing useful lands in the simulator's own log and the wire is the only
   place to look.
3. **The screens.** Six screenshots at 30-second intervals after the privacy
   shutter is passed, so the risk notice and whatever follows it are
   photographed.
4. **The walk.** Maestro is installed and asked to tap **I understand** and
   wait for the home screen, then screenshot it. This is **best effort and
   never fails the job**: a headless simulator has no other way to tap a
   button, and if Maestro cannot run, the run says so and the assertions above
   still have to pass.

Artifacts: `swarm-ios-simulator-screenshot` (all screenshots and the app log)
and `swarm-ios-freshinstall-evidence` (the settings file, the capture and its
summary).

**One finding from this work, and it is now fixed.** The app log of run
35682338577 showed a connection to
`https://clients3.google.com/generate_204` about two seconds after launch,
before any user action — `@react-native-community/netinfo`'s default
reachability probe, which on iOS runs on every launch and then every 60 s,
because the iOS native side reports no `isInternetReachable` of its own. The
privacy policy draft says a fresh install contacts only `lwd.swarm.green`.

The shared branch fixed it (`25747ec35`, "Switch off NetInfo's third-party
reachability probe"), and that commit is **merged into `swarm-ios`** so this
build carries it: `app/services/netInfoPolicy.ts` sets
`reachabilityShouldRun: () => false` and `index.js` applies it before
anything subscribes. The probe is switched off rather than pointed at
`lwd.swarm.green`, which would only have turned a Google heartbeat into a
SWARM one. Nothing reads `isInternetReachable`; every screen branches on
`isConnected`, `type` and `isConnectionExpensive`, which come from the OS.
The packet capture in this job is what will show whether anything else is
left.

### 10.5 For the Android side

Sections 10.1, 10.2 and 10.3 are shared JavaScript and belong on
`swarm-mobile` too. They are one commit on `swarm-ios` so they can be
cherry-picked whole. The iOS-only parts of the same commit are
`.github/workflows/swarm-ios.yml` and this file; everything under `app/`,
`screens/`, `ui/` and `__tests__/` is shared and platform-neutral.
