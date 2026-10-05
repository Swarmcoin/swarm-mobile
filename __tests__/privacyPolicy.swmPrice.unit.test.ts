import { LegalLinkIdEnum } from '@app/legal';
import { legalDocument } from '@app/legal/legalDocuments';

const policy = (chain: string) =>
  legalDocument(LegalLinkIdEnum.privacy, chain).paragraphs.join(' ');

test('Tests that the mainnet privacy policy names the price request and the switch that stops it.', () => {
  const text = policy('swarm-mainnet');
  expect(text).toContain('wallet.swarm.green');
  expect(text).toContain(
    'The request carries no address, balance or wallet identifier.',
  );
  expect(text).toContain('Turn off "Show SWM price (USD)" in Settings');
  expect(text).not.toContain('price lookup');
});

test('Tests that the testnet privacy policy keeps price lookup disabled when the wallet is on SWARM Testnet.', () => {
  const text = policy('swarm-testnet');
  expect(text).toContain(
    'This build disables third-party name resolution and price lookup.',
  );
  expect(text).not.toContain('wallet.swarm.green');
});
