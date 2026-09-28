/**
 * Where the Nym transport may start. On a chain that does not offer the
 * mixnet (both SWARM networks, see mixnetAvailability.ts) the app must not
 * reach Nym's validators, a gateway, a DNS-over-HTTPS resolver or the SDK's
 * health-check indexer, and must not stream cover traffic.
 *
 * @format
 */

jest.mock('@app/RPCModule', () =>
  require('../__mocks__/rpcModuleProxy').rpcModuleProxyMock(),
);

import RPCModule from '@app/RPCModule';
import { ChainNameEnum } from '@app/AppState';
import WalletBackend from '@app/walletBackend/WalletBackend';
import { SyncCoordinator } from '@app/walletBackend/modules/SyncCoordinator';
import { RPCPerformanceLevelEnum } from '@app/walletBackend/enums/RPCPerformanceLevelEnum';
import type { WalletBackendConfig } from '@app/walletBackend/config/WalletBackendConfig';

const bridge = RPCModule as unknown as Record<string, jest.Mock>;

// The configuration LoadedApp builds, on `chainName`.
function backendOn(chainName: ChainNameEnum) {
  const startMixnetTransport = jest.fn().mockResolvedValue({
    socks5Addr: '127.0.0.1:1080',
    exitNode: 'exit',
  });
  const config: WalletBackendConfig = {
    onBalanceChanged: jest.fn(),
    onValueTransfersChanged: jest.fn(),
    onMessagesChanged: jest.fn(),
    onAddressesChanged: jest.fn(),
    onInfoChanged: jest.fn(),
    onSyncStatusChanged: jest.fn(),
    onZingolibVersionChanged: jest.fn(),
    onBirthdayChanged: jest.fn(),
    onError: jest.fn(),
    onMixnetViewChanged: jest.fn(),
    startMixnetTransport,
    transmitPolicy: 'clearnet',
    mixnetSupported: true,
    keepAwake: jest.fn(),
    readOnly: false,
    server: { uri: 'https://lwd-main.swarm.green:8443', chainName },
    performanceLevel: RPCPerformanceLevelEnum.Medium,
  };
  return { backend: new WalletBackend(config), config, startMixnetTransport };
}

async function settle(): Promise<void> {
  for (let i = 0; i < 10; i += 1) {
    await Promise.resolve();
  }
}

beforeEach(() => {
  jest.spyOn(SyncCoordinator.prototype, 'configure').mockResolvedValue();
  bridge.setTransmitPolicy.mockResolvedValue(
    JSON.stringify({ transmit_policy: 'clearnet' }),
  );
  bridge.attachMixnet.mockResolvedValue(
    JSON.stringify({
      mixnet_indicator: 'ready',
      socks5_addr: '127.0.0.1:1080',
    }),
  );
});

afterEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
});

describe.each([
  ChainNameEnum.swarmMainnetChainName,
  ChainNameEnum.swarmChainName,
])('a wallet on %s', chainName => {
  test('starts no Nym transport when the session is configured or re-enabled', async () => {
    const { backend, startMixnetTransport } = backendOn(chainName);
    await backend.configure();
    await backend.configure();
    await backend.reenableMixnet();
    await settle();
    backend.stopMixnetPolling();
    expect(startMixnetTransport).not.toHaveBeenCalled();
    expect(bridge.attachMixnet).not.toHaveBeenCalled();
  });

  test('transmits over clearnet when each session is configured', async () => {
    // The SDK's default policy is the mixnet, under which a send is refused
    // until a transport is ready. Nothing else sets clearnet on this chain.
    const { backend } = backendOn(chainName);
    await backend.configure();
    await backend.configure();
    await settle();
    backend.stopMixnetPolling();
    expect(bridge.setTransmitPolicy).toHaveBeenCalledTimes(2);
    expect(bridge.setTransmitPolicy).toHaveBeenCalledWith('clearnet');
  });

  test('reports a refused clearnet policy when the library rejects it', async () => {
    bridge.setTransmitPolicy.mockRejectedValueOnce(
      new Error('not initialized'),
    );
    const { backend, config } = backendOn(chainName);
    await backend.configure();
    backend.stopMixnetPolling();
    expect(config.onError).toHaveBeenCalledWith(
      expect.stringContaining('not initialized'),
    );
  });
});

describe('a wallet on a chain that offers the mixnet', () => {
  test('starts the Nym transport once when the session is configured', async () => {
    const { backend, startMixnetTransport } = backendOn(
      ChainNameEnum.mainChainName,
    );
    await backend.configure();
    await backend.configure();
    await settle();
    backend.stopMixnetPolling();
    expect(startMixnetTransport).toHaveBeenCalledTimes(1);
  });
});
