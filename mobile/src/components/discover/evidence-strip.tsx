// The two chips over the top-left of a card's photo: the hardest measured
// claims we can make about it.
//
// Renders nothing when there's no evidence, which today is every product.
// That's deliberate — an empty strip is the honest state, and a card that
// shows numbers only when there are numbers is worth more than one that
// always has something to say.
import { StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { evidenceChips } from '@/lib/catalog';
import type { DiscoverEvidence } from '@/types';

export function EvidenceStrip({ evidence }: { evidence: DiscoverEvidence | null }) {
  const chips = evidenceChips(evidence);
  if (chips.length === 0) return null;

  return (
    <View style={styles.row}>
      {chips.map((chip) => (
        <View key={chip.text} style={styles.chip}>
          <Icon name={chip.icon} size={13} color="#F6D98A" />
          <ThemedText type="smallBold" style={styles.text}>
            {chip.text}
          </ThemedText>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.one },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    backgroundColor: 'rgba(20,16,18,0.78)',
    borderRadius: 999,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half + 1,
  },
  text: { color: '#FFFFFF', fontSize: 11, lineHeight: 15 },
});
