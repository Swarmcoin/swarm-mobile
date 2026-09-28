/**
 * A SWARM Mainnet wallet never calls itself, its network or its coins test.
 * The engineering testnet keeps its own sentences, where they are true.
 *
 * The surfaces are the ones a mainnet wallet renders: the risk notice, the
 * privacy policy and the terms resolved for `swarm-mainnet`, the mainnet
 * profile, and every translation that does not name another network.
 *
 * @format
 */

import en from '@app/translations/en.json';
import es from '@app/translations/es.json';
import pt from '@app/translations/pt.json';
import ru from '@app/translations/ru.json';
import tr from '@app/translations/tr.json';
import { LegalLinkIdEnum, riskNoticeParagraphs } from '@app/legal';
import { legalDocument } from '@app/legal/legalDocuments';
import {
  SWARM_MAINNET_PROFILE,
  chainNameKey,
  networkNoticeKey,
} from '@app/utils/networkProfiles';

const MAINNET = SWARM_MAINNET_PROFILE.chainLabel;
const TESTNET = 'swarm-testnet';

const NETWORK_WORDING: readonly RegExp[] = [
  /\btest ?coins?\b/i,
  /\btest ?nets?\b/i,
  /\btest network\b/i,
  /\btest balance\b/i,
  /\bno (monetary )?value\b/i,
  /\bworthless\b/i,
  /\b(can|may|will) (be )?(reset|wiped)\b/i,
  /\bfor testing\b/i,
  /\bengineering\b/i,
  /\butest1/i,
  /\bswarm1/i,
  /\bztestsapling/i,
  /\btextest/i,
  /\b(tm|t2)(…|\.{3})/,
];

// What a release says about itself. Checked on the texts in which the app
// describes the build, not on feature warnings.
const RELEASE_WORDING: readonly RegExp[] = [
  ...NETWORK_WORDING,
  /\bexperimental\b/i,
];

const CATALOGS = { en, es, pt, ru, tr };

// Keys whose text names another network, for example the testnet's entry in
// a network picker.
const OTHER_NETWORK_KEY = /-(swarm-testnet|main|test|regtest)$/;

type Found = { where: string; text: string; phrase: string };

const offending = (
  where: string,
  text: string,
  phrases: readonly RegExp[],
): Found[] =>
  phrases
    .filter(phrase => phrase.test(text))
    .map(phrase => ({ where, text, phrase: String(phrase) }));

const catalogTexts = (
  node: unknown,
  path: string,
): { where: string; text: string }[] => {
  if (typeof node === 'string') {
    return [{ where: path, text: node }];
  }
  if (Array.isArray(node)) {
    return node.flatMap((item, i) => catalogTexts(item, `${path}[${i}]`));
  }
  if (node && typeof node === 'object') {
    return Object.entries(node).flatMap(([key, value]) =>
      OTHER_NETWORK_KEY.test(key)
        ? []
        : catalogTexts(value, path ? `${path}.${key}` : key),
    );
  }
  return [];
};

describe('a SWARM Mainnet wallet', () => {
  test('shows no test-network wording in the risk notice when the wallet is on swarm-mainnet', () => {
    const found = riskNoticeParagraphs(MAINNET).flatMap((text, i) =>
      offending(`risk notice ${i}`, text, RELEASE_WORDING),
    );
    expect(found).toEqual([]);
  });

  test('shows no test-network wording in the privacy policy or the terms when the wallet is on swarm-mainnet', () => {
    const pages: readonly (LegalLinkIdEnum.privacy | LegalLinkIdEnum.terms)[] =
      [LegalLinkIdEnum.privacy, LegalLinkIdEnum.terms];
    const found = pages.flatMap(page =>
      legalDocument(page, MAINNET).paragraphs.flatMap((text, i) =>
        offending(`${page} ${i}`, text, RELEASE_WORDING),
      ),
    );
    expect(found).toEqual([]);
  });

  test('shows no test-network wording in any translation when the key names no other network', () => {
    const found = Object.entries(CATALOGS).flatMap(([language, catalog]) =>
      catalogTexts(catalog, '').flatMap(({ where, text }) =>
        offending(`${language} ${where}`, text, NETWORK_WORDING),
      ),
    );
    expect(found).toEqual([]);
  });

  test('describes its own network without test wording when the profile is shown', () => {
    expect(networkNoticeKey(MAINNET)).toBe('welcome.network-swarm-mainnet');
    const found = [
      SWARM_MAINNET_PROFILE.displayName,
      SWARM_MAINNET_PROFILE.tagline,
      en.welcome['network-swarm-mainnet'],
    ].flatMap(text => offending('mainnet profile', text, RELEASE_WORDING));
    expect(found).toEqual([]);
  });

  test('names SWARM Mainnet in the server panel when the server reports swarm-mainnet', () => {
    expect(chainNameKey(MAINNET)).toBe(
      'settings.value-chainname-swarm-mainnet',
    );
    expect(en.settings['value-chainname-swarm-mainnet']).toBe('SWARM Mainnet');
    expect(chainNameKey('lightwalletd-fork')).toBeUndefined();
    expect(chainNameKey('')).toBeUndefined();
  });
});

describe('a SWARM Testnet wallet', () => {
  test('keeps the testnet risk notice when the wallet is on swarm-testnet', () => {
    const notice = riskNoticeParagraphs(TESTNET).join(' ');
    expect(notice).toContain('SWARM Testnet is an engineering network.');
    expect(notice).toContain('SWM test coins have no value.');
  });

  test('keeps the testnet terms when the wallet is on swarm-testnet', () => {
    const terms = legalDocument(LegalLinkIdEnum.terms, TESTNET).paragraphs;
    expect(terms[0]).toBe(
      'Updated 24 September 2026. SWARM Wallet is experimental, self-custody software distributed for testing by S4FE AG. Support is available at swarmofficial@atomicmail.io.',
    );
    expect(terms[1]).toContain('SWM test coins have no monetary value.');
  });

  test('keeps the testnet notice under the app name when the wallet is on swarm-testnet', () => {
    expect(networkNoticeKey(TESTNET)).toBe('welcome.network-swarm-testnet');
    expect(en.welcome['network-swarm-testnet']).toContain(
      'Test coins have no monetary value.',
    );
  });
});
