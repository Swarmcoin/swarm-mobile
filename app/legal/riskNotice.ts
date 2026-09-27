import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  SwarmProfileIdEnum,
  swarmProfileFor,
} from '@app/utils/networkProfiles';

// The "Before you start" risk notice, one text per network.
//
// Which network the wallet is on decides what the notice has to say. On the
// engineering testnet the coins are worthless and the chain can be reset. On
// SWARM Mainnet the SWM is real and the recovery phrase is the only way back
// to it. A mainnet build that tells its first user the coins have no value is
// the defect this split exists to prevent.
//
// This is a LEGAL text, not UI copy. It is reproduced here word for word from
// `docs/ios/legal/RISK-NOTICE.md` (section "Before you start") in the project
// vault, which is also the source of the page published at
// https://swarm.green/wallet/risks. One source, two renderings, so the app and
// the website cannot drift apart — if you change a word here, change it there
// in the same commit.
//
// It is deliberately NOT in app/translations/*.json:
//
//  * a translated legal notice is a different legal notice, and nobody here is
//    qualified to write the Spanish, Portuguese, Russian or Turkish version of
//    a liability disclaimer; and
//  * the translation catalogues are shared with Android and get edited for
//    tone. This text must not be edited for tone.
//
// `**…**` marks the lead-in of each paragraph and is rendered bold. There are
// no checkboxes: one acknowledgement is enough and reads as adult.

export const RISK_NOTICE_TITLE = 'Before you start';

const TESTNET_PARAGRAPHS: readonly string[] = [
  '**SWARM Testnet is an engineering network.** SWM test coins have no value. Nobody sells them, and nobody should buy them. The network can be reset at any time and every balance with it.',
  '**Your recovery phrase is your wallet.** Write the 24 words down and keep them offline. Whoever has them controls your coins. If you lose them, nobody can recover your wallet, and that includes us. We will never ask for them.',
  '**Transactions cannot be undone.** Not by you, not by us, not by anyone. Check the address before you send.',
  '**Privacy has limits.** Shielded transactions hide sender, receiver and amount on the chain. They do not hide your internet address from the wallet server, and transparent ("t") addresses are public. The privacy software on this network is new and has not been independently audited.',
  '**The software is experimental.** It may have bugs that lose test coins, lose data or fail to sync. It is provided as is, without warranty.',
  '**You are responsible for your own laws.** Whether using cryptocurrency software is lawful where you live is yours to check.',
  '**Nothing here is advice.** Not financial, not legal, not tax.',
  '**A test balance is not a mainnet balance.** Nothing you hold or do on the test network gives you a right to anything on SWARM Mainnet.',
];

const MAINNET_PARAGRAPHS: readonly string[] = [
  '**SWARM Mainnet is the live network.** The SWM in this wallet is real. What you lose here is lost for good, and nobody can put it back.',
  '**You hold this wallet yourself.** The keys live on this device. No company custodies your coins. No support desk can move, freeze or refund them for you.',
  '**Your recovery phrase is your only backup.** Write the 24 words down and keep them offline. Whoever has them controls your coins. If you lose them, nobody can recover your wallet, and that includes us. We will never ask for them.',
  '**Transactions cannot be undone.** Not by you, not by us, not by anyone. Check the address before you send.',
  '**Privacy has limits.** Shielded transactions hide sender, receiver and amount on the chain. They do not hide your internet address from the wallet server, and transparent addresses are public. The privacy software on this network is new and has not been independently audited.',
  '**The software is early and comes from outside the app stores.** This is a first release for a network that launched this month. It may have bugs that lose coins, lose data or fail to sync. Install it only from the SWARM download page. It is provided as is, without warranty.',
  '**Start with an amount you can afford to lose.** Send a small test payment and confirm it arrived before you move anything larger.',
  '**You are responsible for your own laws.** Whether using cryptocurrency software is lawful where you live is yours to check.',
  '**Nothing here is advice.** Not financial, not legal, not tax.',
];

/** The notice for the network a chain label names. */
export const riskNoticeParagraphs = (
  chain: string | undefined | null,
): readonly string[] =>
  swarmProfileFor(chain)?.id === SwarmProfileIdEnum.mainnet
    ? MAINNET_PARAGRAPHS
    : TESTNET_PARAGRAPHS;

export const RISK_NOTICE_ACKNOWLEDGE = 'I understand';

// Versioned on purpose. If the notice ever changes materially, bump the
// suffix and every installation is asked again rather than silently treated
// as having read something it never saw. v2 carries the mainnet text.
export const RISK_NOTICE_STORAGE_KEY = '@risk-notice-acknowledged-v2';

/**
 * Whether this installation has acknowledged the risk notice.
 *
 * A storage read that throws answers `false`: showing the notice twice is a
 * small annoyance, letting a first wallet be created without it is the thing
 * this exists to prevent.
 */
export const hasAcknowledgedRiskNotice = async (): Promise<boolean> => {
  try {
    return (await AsyncStorage.getItem(RISK_NOTICE_STORAGE_KEY)) === 'true';
  } catch {
    return false;
  }
};

/** Records the acknowledgement. A failed write only means it is asked again. */
export const acknowledgeRiskNotice = async (): Promise<void> => {
  try {
    await AsyncStorage.setItem(RISK_NOTICE_STORAGE_KEY, 'true');
  } catch {
    // Nothing to do and nothing to report: the notice is shown again next
    // launch, which is the safe direction to fail in.
  }
};
