import ServerType from '@app/AppState/types/ServerType';
import { swarmProfileFor } from './networkProfiles';

export function serverForWallet(
  chain: string | undefined,
  current: ServerType,
): ServerType {
  const profile = swarmProfileFor(chain);
  if (!profile || profile.chainLabel === current.chainName) return current;
  return {
    uri: current.uri ? profile.defaultServer : '',
    chainName: profile.chainLabel,
  };
}
