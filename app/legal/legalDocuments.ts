import documents from './documents.json';
import { LegalLinkIdEnum } from './legalLinks';
import {
  DEFAULT_SWARM_PROFILE,
  SwarmProfileIdEnum,
  swarmProfileFor,
} from '@app/utils/networkProfiles';

// A paragraph that differs by network is stored in documents.json as one
// string per profile id. An unknown chain reads the testnet's wording, and a
// chain not known yet reads the wording of the network this build opens on.
const profileIdFor = (chain?: string | null): SwarmProfileIdEnum =>
  chain
    ? (swarmProfileFor(chain)?.id ?? SwarmProfileIdEnum.testnet)
    : DEFAULT_SWARM_PROFILE.id;

/** The privacy policy or the terms as a wallet on `chain` shows them. */
export const legalDocument = (
  page: LegalLinkIdEnum.privacy | LegalLinkIdEnum.terms,
  chain?: string | null,
): { title: string; paragraphs: readonly string[] } => {
  const id = profileIdFor(chain);
  return {
    title: documents[page].title,
    paragraphs: documents[page].paragraphs.map(paragraph =>
      typeof paragraph === 'string' ? paragraph : paragraph[id],
    ),
  };
};
