import NetInfo, { NetInfoConfiguration } from '@react-native-community/netinfo';

// The wallet's connectivity policy: no third-party reachability probe.
//
// `@react-native-community/netinfo` ships with an "is the internet
// reachable?" probe. Whenever the OS reports a connection, the library sends
// a HEAD request to https://clients3.google.com/generate_204 and repeats it
// every 60 s while the answer is good (every 5 s while it is not), for as
// long as the app is open. On iOS the native side reports no
// `isInternetReachable` at all (ios/RNCNetInfo.mm builds only `type`,
// `isConnected` and `details`), so the probe runs on every launch: the
// simulator log of CI run 35682338577 shows the QUIC connection to
// clients3.google.com two seconds after launch, before any user action. On
// Android the native side answers the question itself (the OS's
// NET_CAPABILITY_VALIDATED), so the JS probe never runs there.
//
// SWARM Wallet talks to the wallet server the user chose and, on SWARM Mainnet
// with "Show SWM price (USD)" on, to the SWARM price service at
// wallet.swarm.green (privacy policy, sections 3 and 7). Nothing in the app
// reads `isInternetReachable`: the boot sequence (LoadingApp), the start
// menu, the send path, the header and every screen branch on `isConnected`,
// `type` and `isConnectionExpensive`, all of which come straight from the
// OS. So the probe is switched off, not
// redirected: pointing it at lwd.swarm.green would only turn a Google
// heartbeat into a SWARM one that tells the server every minute that a
// wallet is open, and would hammer the server every 5 s should the HEAD ever
// fail its 204 test.
//
// The one visible consequence: with the probe off the library reports
// `isInternetReachable: false` on iOS (Android keeps the OS answer). Nothing
// reads it. If a future change needs it, bring the probe back deliberately,
// together with the privacy policy text.
export const SWARM_NETINFO_CONFIGURATION: Partial<NetInfoConfiguration> = {
  reachabilityShouldRun: () => false,
};

// Must run before the first `NetInfo.fetch()` or `NetInfo.addEventListener()`,
// i.e. at app start (index.js): `configure()` drops every listener registered
// before it.
export function applyNetInfoPolicy(): void {
  NetInfo.configure(SWARM_NETINFO_CONFIGURATION);
}
