import { AppText } from '@/components';
import type { VeteranRelevance } from '@/types/resource';

// Why a resource belongs in a veterans' app, as a mono tag. Veteran rows read in
// olive; general rows ("Open to everyone") stay in secondary ink so veteran
// resources lead — the label is honesty, not flair.
const LABEL: Record<VeteranRelevance, string> = {
  veteran_specific: 'For veterans',
  veteran_benefit: 'Veterans’ benefit',
  general: 'Open to everyone',
};

export function VeteranBadge({ relevance }: { relevance: VeteranRelevance }) {
  return (
    <AppText
      variant="kicker"
      color={relevance === 'general' ? 'textSecondary' : 'accent'}
      numberOfLines={1}
    >
      {LABEL[relevance]}
    </AppText>
  );
}
