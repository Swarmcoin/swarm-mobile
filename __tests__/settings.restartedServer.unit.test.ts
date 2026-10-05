jest.mock('react-native-fs', () => ({
  DocumentDirectoryPath: '/docs',
  exists: jest.fn(async () => true),
  readFile: jest.fn(),
  writeFile: jest.fn(async () => {}),
}));

import 'react-native';
import * as RNFS from 'react-native-fs';
import SettingsFileImpl from '@app/services/SettingsFileImpl';

const readFile = RNFS.readFile as jest.MockedFunction<typeof RNFS.readFile>;

test('Tests that a stored :8443 mainnet server reads as :443 when the settings come from a build before the 2026-10-02 restart.', async () => {
  readFile.mockResolvedValue(
    JSON.stringify({
      server: {
        uri: 'https://lwd-main.swarm.green:8443',
        chainName: 'swarm-mainnet',
      },
      selectServer: 'auto',
    }),
  );
  const settings = await SettingsFileImpl.readSettings();
  expect(settings.server).toEqual({
    uri: 'https://lwd-main.swarm.green:443',
    chainName: 'swarm-mainnet',
  });
});

test('Tests that a custom server stays as the user set it when it is not the abandoned indexer.', async () => {
  readFile.mockResolvedValue(
    JSON.stringify({
      server: { uri: 'https://my.node:8443', chainName: 'swarm-mainnet' },
      selectServer: 'custom',
    }),
  );
  const settings = await SettingsFileImpl.readSettings();
  expect(settings.server.uri).toBe('https://my.node:8443');
});
