// The blog-post view behind a Growth card. Reads as a PROFILE of the
// community — overview, what they talk about, buyer likes/dislikes, house
// rules — with the how-to-approach guidance as a side element at the end.
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { ReactNode, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { api } from '@/api/client';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatMembers, KIND_LABELS, platformStyle } from '@/lib/platforms';
import type { GrowthPostDetail } from '@/types';

const splitLines = (text: string) =>
  text.split('\n').map((l) => l.trim()).filter(Boolean);

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

  const section = (title: string, children: ReactNode) => (
    <View style={styles.section}>
      <ThemedText type="smallBold" style={styles.sectionTitle}>{title}</ThemedText>
      {children}
    </View>
  );

  const bulletList = (text: string, mark: string, markColor?: string) => (
    <View style={styles.list}>
      {splitLines(text).map((item, i) => (
        <View key={i} style={styles.listRow}>
          <ThemedText type="small" style={[styles.listMark, markColor ? { color: markColor } : null]}>
            {mark}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.listText}>
            {item}
          </ThemedText>
        </View>
      ))}
    </View>
  );

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

              {post.overview.split(/\n\s*\n/).map((para, i) => (
                <ThemedText key={i} style={styles.para}>{para.trim()}</ThemedText>
              ))}

              <View style={[styles.audienceCard, { backgroundColor: theme.backgroundElement }]}>
                <ThemedText type="smallBold">Who you’ll find here</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">{post.audience}</ThemedText>
              </View>

              {section('What they talk about', bulletList(post.discussions, '•'))}
              {section('What wins them over', bulletList(post.loves, '✓', theme.success))}
              {section('What turns them off', bulletList(post.dislikes, '✕', theme.danger))}
              {section('House rules', bulletList(post.rules, '§'))}

              <View style={[styles.approachCard, { backgroundColor: theme.backgroundElement, borderColor: theme.accent }]}>
                <ThemedText type="smallBold" style={{ color: theme.accent }}>The play</ThemedText>
                <ThemedText type="small">{post.approach}</ThemedText>
              </View>

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
  para: { marginTop: Spacing.two },
  audienceCard: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.one,
    marginVertical: Spacing.two,
  },
  section: { marginTop: Spacing.three, gap: Spacing.two },
  sectionTitle: { fontSize: 16 },
  list: { gap: Spacing.two },
  listRow: { flexDirection: 'row', gap: Spacing.two, alignItems: 'flex-start' },
  listMark: { width: 16, textAlign: 'center' },
  listText: { flex: 1 },
  approachCard: {
    marginTop: Spacing.four,
    borderRadius: Spacing.three,
    borderWidth: 1.5,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  explore: {
    marginTop: Spacing.three,
    borderRadius: Spacing.three,
    paddingVertical: 16,
    alignItems: 'center',
  },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  centerText: { textAlign: 'center' },
});
