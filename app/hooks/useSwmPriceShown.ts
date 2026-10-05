import { useContext } from 'react';
import { ContextAppLoaded } from '@app/context';
import { swmPriceShown } from '@app/utils/priceAvailability';

/** True when this wallet shows the SWM price. */
export function useSwmPriceShown(): boolean {
  const { info, selectServer, showSwmPrice } = useContext(ContextAppLoaded);
  return swmPriceShown({
    chainName: info.chainName,
    selectServer,
    showSwmPrice,
  });
}
