// The small labels that sit on a card's photo: who this suits, and how it
// gets made. Fixed colours rather than theme tokens — they're over an image,
// so they have to hold up in both light and dark without changing.
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

export function HeroChip({ label, color }: { label: string; color?: string }) {
  return (
    <View style={[styles.chip, { backgroundColor: color ?? 'rgba(20,16,18,0.72)' }]}>
      <ThemedText type="smallBold" style={styles.text}>
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    borderRadius: 999,
    paddingHorizontal: Spacing.two + 2,
    paddingVertical: Spacing.half + 1,
  },
  text: { color: '#FFFFFF', fontSize: 11, lineHeight: 15 },
});
