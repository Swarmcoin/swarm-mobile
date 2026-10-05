# iOS wallet data flows for App Privacy review

Prepared 2026-09-24. This is a code and fresh-install traffic inventory. It is
not an App Store Connect privacy answer.

| Flow | Trigger | Evidence | Open question |
| --- | --- | --- | --- |
| Wallet server | Wallet launch and sync | `app/uris/serverUris.ts`; [signed simulator run](https://github.com/Swarm-Official/swarm-mobile/actions/runs/36020885180) connected to `lwd.swarm.green:443` | Does the indexer retain IP addresses, request metadata, or wallet queries? For how long? |
| Recovery phrase and wallet file | Wallet creation and restore | `app/services/recoveryWalletInfo.ts` uses device-only Keychain options. `ios/RPCModule.swift` writes local wallet and backup files with backup exclusion and iOS file protection. | Verify recovery and backup attributes on a physical iPhone. |
| ZNS alias lookup | User enters a `.zcash` or `.zec` recipient | `screens/Send/Send.tsx` passes the server chain to `app/uris/resolveZnsName.ts`; its `clientFor` returns before the SDK call on `swarm-testnet` | Keep this route closed for SwarmTestnet. Recheck third-party requests if mainnet or Zcash testnet support returns. |
| Internet reachability | Network state changes | `app/services/netInfoPolicy.ts` disables the NetInfo HTTP check | Recheck after dependency updates. |
| SWM price | SWARM Mainnet wallet open, "Show SWM price (USD)" on (default) | `app/walletBackend/modules/SwmPriceService.ts` sends one unauthenticated `GET https://wallet.swarm.green/api/price/swm` about once a minute while the wallet is in the foreground; `ui/widgets/priceFetcherStore.ts` stops it in the background, offline, on SWARM Testnet and with the switch off. The request carries no address, balance, wallet identifier or cookie. | The relay sees the IP address and the request time. Confirm its access-log retention. Nothing is added to `ios/PrivacyInfo.xcprivacy`: the request collects no user data. |
| Analytics and crash reporting | No reporting provider found in the inspected source or dependency lists | `package.json`, `ios/Podfile.lock`, `rust/Cargo.lock`, and source search | Confirm server-side telemetry and operator retention. |

The bundled `ios/PrivacyInfo.xcprivacy` declares an empty collected-data array.
Confirm the indexer retention rules before submitting that declaration as the
App Privacy answer. The wallet privacy policy, terms, risk notice and licence
pages under `https://swarm.green/wallet/` return HTTP 200 as of 2026-09-24.
The app includes the same documents for offline reading. The App Store draft
uses `https://swarm.green/wallet/privacy` as its privacy URL. The default server's
operator and log-retention period still require the owner's answer.
