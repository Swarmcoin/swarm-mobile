import { SendJsonToTypeType, ServerType } from '@app/AppState';
import { WalletBackendConfig } from './config/WalletBackendConfig';
import { RPCPerformanceLevelEnum } from './enums/RPCPerformanceLevelEnum';
import { DataService } from './modules/DataService';
import { MixnetCoordinator } from './modules/MixnetCoordinator';
import { mixnetAvailableOnChain } from './transforms/mixnetAvailability';
import { TransmitPolicy, setTransmitPolicy } from './utils/mixnetUtils';
import { SyncCoordinator } from './modules/SyncCoordinator';
import { TransactionService } from './modules/TransactionService';
import { WalletLifecycleService } from './modules/WalletLifecycleService';

// Wires the sub-services together and exposes one API to LoadedApp.
export default class WalletBackend {
  private config: WalletBackendConfig;
  private dataService: DataService;
  private syncCoordinator: SyncCoordinator;
  private transactionService: TransactionService;
  private walletLifecycle: WalletLifecycleService;
  private mixnetCoordinator: MixnetCoordinator;
  private mixnetArmed: boolean = false;

  constructor(config: WalletBackendConfig) {
    this.config = config;
    this.dataService = new DataService(config);
    this.syncCoordinator = new SyncCoordinator(config, this.dataService);
    this.mixnetCoordinator = new MixnetCoordinator(
      config.startMixnetTransport,
      config.onMixnetViewChanged,
      config.transmitPolicy,
    );
    this.dataService.onSyncError = async () => {
      await this.syncCoordinator.clearTimers();
      await this.syncCoordinator.configure();
    };
    this.transactionService = new TransactionService(
      config,
      this.syncCoordinator,
    );
    this.walletLifecycle = new WalletLifecycleService(this.syncCoordinator);
  }

  // Whether the Nym transport may run for the chain the wallet is on now.
  private mixnetOffered(): boolean {
    return (
      this.config.mixnetSupported &&
      mixnetAvailableOnChain(this.config.server.chainName)
    );
  }

  // The mixnet bootstrap is not awaited because it takes tens of seconds.
  // Where the mixnet is not offered nothing starts it, and each session is
  // told to transmit over clearnet: the library refuses a send under its
  // default policy, the mixnet, until a transport is ready.
  async configure() {
    if (!this.mixnetOffered()) {
      await this.transmitOverClearnet();
    } else if (!this.mixnetArmed) {
      this.mixnetArmed = true;
      this.mixnetCoordinator.ensureForConnectedSession();
    }
    return this.syncCoordinator.configure();
  }

  private async transmitOverClearnet(): Promise<void> {
    try {
      await setTransmitPolicy('clearnet');
    } catch (error) {
      this.config.onError(`Transmit policy: ${error}`);
    }
  }
  async clearTimers() {
    return this.syncCoordinator.clearTimers();
  }
  async pauseSyncProcess() {
    return this.syncCoordinator.pauseSyncProcess();
  }
  async refreshSync(fullRescan?: boolean) {
    return this.syncCoordinator.refreshSync(fullRescan);
  }

  async fetchInfoAndServerHeight() {
    return this.dataService.fetchInfoAndServerHeight();
  }
  async fetchTandZandOValueTransfers() {
    return this.dataService.fetchTandZandOValueTransfers();
  }
  async fetchTandZandOMessages() {
    return this.dataService.fetchTandZandOMessages();
  }

  async sendTransaction(sendJson: Array<SendJsonToTypeType>): Promise<string> {
    return this.transactionService.sendTransaction(sendJson);
  }

  async reenableMixnet() {
    if (!this.mixnetOffered()) {
      return;
    }
    return this.mixnetCoordinator.reenable();
  }
  async setTransmitPolicy(policy: TransmitPolicy) {
    return this.mixnetCoordinator.setTransmitPolicy(policy);
  }
  stopMixnetPolling() {
    this.mixnetCoordinator.stop();
  }

  async changeWallet() {
    return this.walletLifecycle.changeWallet();
  }
  async changeWalletNoBackup() {
    return this.walletLifecycle.changeWalletNoBackup();
  }
  async restoreBackup() {
    return this.walletLifecycle.restoreBackup();
  }

  async getWalletVersion() {
    return this.dataService.getWalletVersion();
  }

  setInSend(value: boolean) {
    this.transactionService.setInSend(value);
  }
  getInSend() {
    return this.transactionService.getInSend();
  }

  setReadOnly(value: boolean) {
    this.config.readOnly = value;
  }
  getReadOnly() {
    return this.config.readOnly;
  }

  // Mutates the shared config so every sub-service reads the new server.
  setServer(server: ServerType) {
    this.config.server = server;
  }

  setPerformanceLevel(performanceLevel: RPCPerformanceLevelEnum) {
    this.config.performanceLevel = performanceLevel;
  }
}
