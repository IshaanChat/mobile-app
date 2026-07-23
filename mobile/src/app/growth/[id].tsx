// The blog-post view behind a Growth card: hero, who-you'll-find-here,
// the coached write-up, and the Explore button out to the community.
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { api } from '@/api/client';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatMembers, KIND_LABELS, platformStyle } from '@/lib/platforms';
import type { GrowthPostDetail } from '@/types';

export default function GrowthPostScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [post, setPost] = useState<GrowthPostDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    api.getGrowthPost(id)
      .then(setPost)
      .catch((err) => setError(err?.message ?? 'Could not load this post.'));
  }, [id]);

  const style = post ? platformStyle(post.platform) : null;
  const members = post ? formatMembers(post.memberCount) : null;

  return (
    <ThemedView style={styles.root}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.body}>
          <View style={styles.topBar}>
            <Pressable accessibilityRole="button" onPress={() => router.back()} hitSlop={12}>
              <ThemedText type="smallBold" themeColor="textSecondary">← Back</ThemedText>
            </Pressable>
          </View>

          {error ? (
            <View style={styles.centered}>
              <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
                {error}
              </ThemedText>
            </View>
          ) : !post || !style ? (
            <View style={styles.centered}>
              <ActivityIndicator color={theme.accent} />
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
              <View style={[styles.hero, { backgroundColor: style.color }]}>
                <ThemedText style={styles.heroEmoji}>{style.emoji}</ThemedText>
                <View style={styles.heroChips}>
                  <View style={styles.chip}>
                    <ThemedText type="smallBold" style={styles.chipText}>{post.platform}</ThemedText>
                  </View>
                  <View style={styles.chip}>
                    <ThemedText type="small" style={styles.chipText}>
                      {KIND_LABELS[post.kind] ?? post.kind}
                    </ThemedText>
                  </View>
                </View>
              </View>

              <ThemedText type="subtitle" style={styles.title}>{post.title}</ThemedText>
              <ThemedText themeColor="textSecondary">{post.tagline}</ThemedText>
              {members ? (
                <ThemedText type="small" themeColor="textSecondary">{members}</ThemedText>
              ) : null}

              <View style={[styles.audienceCard, { backgroundColor: theme.backgroundElement }]}>
                <ThemedText type="smallBold">Who you’ll find here</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">{post.audience}</ThemedText>
              </View>

              {post.body.split(/\n\s*\n/).map((para, i) => (
                <ThemedText key={i} style={styles.para}>{para.trim()}</ThemedText>
              ))}

              <Pressable
                accessibilityRole="button"
                onPress={() => void WebBrowser.openBrowserAsync(post.url)}
                style={[styles.explore, { backgroundColor: theme.accent }]}>
                <ThemedText type="smallBold" style={{ color: theme.accentText }}>
                  Explore {post.title} ↗
                </ThemedText>
              </Pressable>
            </ScrollView>
          )}
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1, alignItems: 'center' },
  body: { flex: 1, width: '100%', maxWidth: MaxContentWidth, paddingHorizontal: Spacing.three },
  topBar: { paddingVertical: Spacing.three },
  scroll: { gap: Spacing.two, paddingBottom: Spacing.six },
  hero: {
    height: 160,
    borderRadius: Spacing.three,
    padding: Spacing.three,
    justifyContent: 'space-between',
  },
  heroEmoji: { fontSize: 52, lineHeight: 60 },
  heroChips: { flexDirection: 'row', gap: Spacing.two },
  chip: {
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderRadius: 999,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
  },
  chipText: { color: '#ffffff', fontSize: 12, lineHeight: 16 },
  title: { marginTop: Spacing.two },
  audienceCard: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.one,
    marginVertical: Spacing.two,
  },
  para: { marginTop: Spacing.two },
  explore: {
    marginTop: Spacing.four,
    borderRadius: Spacing.three,
    paddingVertical: 16,
    alignItems: 'center',
  },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  centerText: { textAlign: 'center' },
});
