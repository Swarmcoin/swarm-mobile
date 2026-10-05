import { ChainNameEnum } from '@app/AppState/enums/ChainNameEnum';
import { SelectServerEnum } from '@app/AppState/enums/SelectServerEnum';

/** True only on SWARM Mainnet, the one chain whose coin has a listed price. */
export const priceAvailableOnChain = (chainName: string): boolean =>
  chainName === ChainNameEnum.swarmMainnetChainName;

/** True when the wallet fetches and shows the SWM price. */
export const swmPriceShown = (gate: {
  chainName: string;
  selectServer: SelectServerEnum;
  showSwmPrice: boolean;
}): boolean =>
  gate.showSwmPrice &&
  gate.selectServer !== SelectServerEnum.offline &&
  priceAvailableOnChain(gate.chainName);
