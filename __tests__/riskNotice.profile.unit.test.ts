import { riskNoticeParagraphs } from '@app/legal/riskNotice';
import {
  explorerHostFor,
  explorerUrlFor,
  SWARM_MAINNET_PROFILE,
  SWARM_TESTNET_PROFILE,
} from '@app/utils/networkProfiles';
import { ChainNameEnum } from '@app/AppState/enums/ChainNameEnum';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

describe('riskNoticeParagraphs', () => {
  const mainnet = riskNoticeParagraphs(SWARM_MAINNET_PROFILE.chainLabel).join(
    '\n',
  );
  const testnet = riskNoticeParagraphs(SWARM_TESTNET_PROFILE.chainLabel).join(
    '\n',
  );

  test('tells a mainnet wallet the network is live and its SWM is real', () => {
    expect(mainnet).toContain('SWARM Mainnet is the live network');
    expect(mainnet).toContain('The SWM in this wallet is real');
  });

  test('names self-custody and the recovery phrase as the only backup on mainnet', () => {
    expect(mainnet).toContain('You hold this wallet yourself');
    expect(mainnet).toContain('Your recovery phrase is your only backup');
  });

  test('keeps the early-software caveat on mainnet', () => {
    expect(mainnet).toContain('The software is early');
    expect(mainnet).toContain('without warranty');
  });

  // The defect this split fixes: the mainnet build showed the testnet notice
  // and told its first user that real SWM was worthless.
  test('never calls the live network a test network', () => {
    expect(mainnet).not.toMatch(/test network/i);
    expect(mainnet).not.toMatch(/test coins/i);
    expect(mainnet).not.toMatch(/have no value/i);
  });

  test('keeps the testnet notice for the engineering network', () => {
    expect(testnet).toContain('SWARM Testnet is an engineering network');
    expect(testnet).toContain('SWM test coins have no value');
  });

  test('an unrecognised chain gets the testnet caution', () => {
    expect(riskNoticeParagraphs(ChainNameEnum.mainChainName)).toBe(
      riskNoticeParagraphs(SWARM_TESTNET_PROFILE.chainLabel),
    );
  });
});

describe('explorerUrlFor', () => {
  test('each SWARM network reaches its own explorer', () => {
    expect(explorerUrlFor(ChainNameEnum.swarmMainnetChainName)).toBe(
      'https://mainnet.explore.swarm.green/',
    );
    expect(explorerUrlFor(ChainNameEnum.swarmChainName)).toBe(
      'https://explore.swarm.green/',
    );
  });

  test('the settings row shows the host of the network the wallet is on', () => {
    expect(explorerHostFor(ChainNameEnum.swarmMainnetChainName)).toBe(
      'mainnet.explore.swarm.green',
    );
    expect(explorerHostFor(ChainNameEnum.swarmChainName)).toBe(
      'explore.swarm.green',
    );
  });

  test('a chain with no SWARM profile reaches no explorer', () => {
    expect(explorerUrlFor(ChainNameEnum.mainChainName)).toBe('');
    expect(explorerHostFor(ChainNameEnum.noneChainName)).toBe('');
  });
});
