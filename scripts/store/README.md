# The store submission kit

Everything the two stores read, and every rule they enforce on it, in one place.

```
fastlane/
  Appfile, Fastfile, Deliverfile      the lanes (§ "Running it")
  metadata/en-US/…                    the App Store listing: name, subtitle,
                                      keywords, promo, description, release
                                      notes, support/privacy/marketing URLs
  metadata/review_information/…       the App Review contact and notes
  screenshots/en-US/…                 App Store screenshots, 6.9-inch class
  metadata/android/<locale>/…         the Play listing: title, short and full
                                      description, changelogs/<versionCode>.txt
  metadata/android/<locale>/images/   Play icon, feature graphic, phone shots
scripts/store/
  build_store_art.py                  compose a real capture into a store-sized
                                      screenshot on the SWARM canvas
  check_store_art.mjs                 refuse any asset the store would refuse
  screens.json                        the iOS screens, their captions, in order
  screens-android.json                the same for Play
```

## The rules the checker enforces, and where each one comes from

| Store | Asset | Rule | Source |
| --- | --- | --- | --- |
| App Store | screenshot | one of Apple's size classes: 1320×2868 (6.9", the required class for a new iPhone app), 1290×2796, 1284×2778, 1242×2688, 1170×2532, 1125×2436, 1242×2208, 2048×2732, portrait or landscape | Apple, "Screenshot specifications" |
| App Store | screenshot | 1 to 10 per size class | same |
| App Store | `name.txt` ≤ 30, `subtitle.txt` ≤ 30, `keywords.txt` ≤ 100, `promotional_text.txt` ≤ 170, `description.txt` ≤ 4,000, `release_notes.txt` ≤ 4,000 | Apple's field limits | App Store Connect help |
| App Store | support and privacy URLs | must be `https://` and must exist before submission | Apple, guideline 2.1 |
| Play | icon | 512×512, no alpha channel (a full square with no transparency; Play masks the corners itself) | Play Console help; Google Play icon design specifications |
| Play | feature graphic | 1024×500, 24-bit PNG or JPEG, opaque | same |
| Play | phone screenshot | 2 to 8 per locale, each side 320–3840 px, long side at most twice the short side | same |
| Play | `title.txt` ≤ 30, `short_description.txt` ≤ 80, `full_description.txt` ≤ 4,000, `changelogs/<n>.txt` ≤ 500 | Play's field limits | same |
| Play | locale folder names | Play's codes: `en-US`, `es-ES` — not `es` | Play Console help, and fastlane supply refuses anything else |
| both | any listing text | no upstream wording (Zingo, "Zcash wallet", "Real Secure Money") outside the MIT attribution | this project's rule: the listing must describe SWARM |

`node scripts/store/check_store_art.mjs` runs all of it. It reads PNG and JPEG
headers directly, so it needs no image library and runs in any job with Node.

## Composing screenshots from real captures

Captures come from a device: the Android emulator in CI (`SWARM Android`
workflow), the iOS simulator (`SWARM iOS` workflow), or the owner's phone. The
composer never invents a screen — it frames what was captured.

```sh
# Apple, 6.9-inch class, into the deliver tree
python scripts/store/build_store_art.py --preset ios69 \
  --raw <captures of the app> --out fastlane/screenshots/en-US

# Google Play, 1440x2560
python scripts/store/build_store_art.py --preset play_hd \
  --manifest scripts/store/screens-android.json \
  --raw <captures> --out fastlane/metadata/android/en-US/images/phoneScreenshots

# What is still missing from the set
python scripts/store/build_store_art.py --list-captures --raw <captures>

# One image holding every shot, to review the whole listing at once
python scripts/store/build_store_art.py --contact-sheet out.png fastlane/screenshots/en-US/*.png
```

Presets: `ios69` (1320×2868), `ios65` (1242×2688), `play` (1080×1920),
`play_hd` (1440×2560). Requirements: Python 3 with Pillow; the typefaces are
the ones the app already ships in `assets/fonts`.

## Running it

```sh
bundle install
bundle exec fastlane ios verify      # Apple rules, no network
bundle exec fastlane ios metadata    # upload the listing (no build)
bundle exec fastlane ios beta        # upload an .ipa to TestFlight
bundle exec fastlane android verify
bundle exec fastlane android play track:internal aab:/path/app.aab
```

Credentials are environment variables, never files in this repository:
`DELIVER_USER`, `FASTLANE_TEAM_ID`, `ASC_KEY_ID`, `ASC_ISSUER_ID`,
`ASC_KEY_PATH` for Apple; `PLAY_JSON_KEY` for Play.

## What is deliberately not in this tree

No recovery words, no private keys, no upload keystore, no API key, no Apple ID
password. `docs/ios/07-PUSH-TO-APPLE.md` says which of those the owner keeps
and how they reach CI as secrets.
