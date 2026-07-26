// Journey: the bottom sheet the top bar opens.
//
// It opens on "Next up" rather than the full list, because the whole point
// of the journey is that there's exactly one thing to do next. The rest is
// there to scroll to, not to greet you.
//
// NOTE: the level gating from the prototype isn't here yet. The 16
// milestones and their 5 levels live in server/content/missions.json, but
// /api/missions is built on an older mission model that doesn't carry a
// level per mission — so this shows the real XP level from the summary and
// groups by cadence, which is what the endpoint actually returns. Inventing
// the gating client-side would put a number on screen the server disagrees
// with.
import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { api } from '@/api/client';
import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAppData } from '@/state/app-data';
import type { Mission, MissionCadence, MissionsPayload } from '@/types';

export function JourneySheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { activeBusiness } = useAppData();
  const [data, setData] = useState<MissionsPayload | null>(null);

  useEffect(() => {
    if (!open || !activeBusiness) return;
    let cancelled = false;
    api
      .getMissions(activeBusiness.id)
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [open, activeBusiness]);

  const nextUp = data?.missions.find((m) => !m.completed) ?? null;
  const done = data?.missions.filter((m) => m.completed).length ?? 0;

  return (
    <Modal visible={open} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose} accessibilityLabel="Close" />
      <View
        style={[
          styles.sheet,
          { backgroundColor: theme.background, paddingBottom: insets.bottom + Spacing.three },
        ]}>
        <View style={[styles.grab, { backgroundColor: theme.border }]} />

        <View style={styles.head}>
          <View style={styles.headText}>
            <ThemedText type="subtitle" style={styles.title}>Your journey</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {data
                ? `${done} of ${data.missions.length} done · ${data.summary.xp} XP`
                : 'Idea to first sale, one step at a time.'}
            </ThemedText>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} hitSlop={8}>
            <Icon name="x" size={16} color={theme.textSecondary} />
          </Pressable>
        </View>

        {data === null ? (
          <ActivityIndicator color={theme.accent} style={styles.loading} />
        ) : (
          <>
            <LevelBar summary={data.summary} />

            {nextUp ? (
              <View style={[styles.next, { backgroundColor: theme.accentSoft, borderColor: theme.accent }]}>
                <ThemedText type="small" style={[styles.kicker, { color: theme.accent }]}>NEXT UP</ThemedText>
                <ThemedText type="smallBold" style={styles.nextTitle}>{nextUp.title}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">{nextUp.description}</ThemedText>
                <ThemedText type="smallBold" style={{ color: theme.accent }}>
                  +{nextUp.xp} XP{nextUp.target > 1 ? ` · ${nextUp.current}/${nextUp.target}` : ''}
                </ThemedText>
              </View>
            ) : (
              <View style={[styles.next, { backgroundColor: theme.accentSoft, borderColor: theme.accent }]}>
                <ThemedText type="smallBold">You’ve walked the whole journey.</ThemedText>
              </View>
            )}

            <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
              {(Object.keys(data.cadenceInfo) as MissionCadence[]).map((cadence) => {
                const group = data.missions.filter((m) => m.cadence === cadence);
                if (group.length === 0) return null;
                return (
                  <View key={cadence} style={styles.group}>
                    <ThemedText type="smallBold" style={styles.groupTitle}>
                      {data.cadenceInfo[cadence].title}
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {data.cadenceInfo[cadence].blurb}
                    </ThemedText>
                    {group.map((m) => (
                      <MissionRow key={m.id} mission={m} />
                    ))}
                  </View>
                );
              })}
            </ScrollView>
          </>
        )}
      </View>
    </Modal>
  );
}

function LevelBar({ summary }: { summary: MissionsPayload['summary'] }) {
  const theme = useTheme();
  // nextLevelXp is null at the top level — a full bar reads better there
  // than an empty one.
  const span = summary.nextLevelXp === null ? 0 : summary.nextLevelXp - summary.currentLevelXp;
  const pct = span > 0 ? Math.min(1, (summary.xp - summary.currentLevelXp) / span) : 1;

  return (
    <View style={styles.level}>
      <View style={styles.levelHead}>
        <ThemedText type="smallBold">{summary.levelName}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">Level {summary.level}</ThemedText>
      </View>
      <View style={[styles.track, { backgroundColor: theme.backgroundSelected }]}>
        <View style={[styles.fill, { width: `${pct * 100}%`, backgroundColor: theme.accent }]} />
      </View>
    </View>
  );
}

function MissionRow({ mission }: { mission: Mission }) {
  const theme = useTheme();
  return (
    <View style={[styles.row, { borderBottomColor: theme.border }]}>
      <View
        style={[
          styles.check,
          mission.completed
            ? { backgroundColor: theme.customer, borderColor: theme.customer }
            : { borderColor: theme.border },
        ]}>
        {mission.completed ? <Icon name="check" size={13} color={theme.accentText} /> : null}
      </View>
      <View style={styles.rowMain}>
        <ThemedText type="small" themeColor={mission.completed ? 'textSecondary' : 'text'}>
          {mission.title}
        </ThemedText>
        {!mission.completed && mission.target > 1 ? (
          <ThemedText type="small" themeColor="textSecondary">
            {mission.current}/{mission.target}
          </ThemedText>
        ) : null}
      </View>
      <ThemedText type="small" themeColor="textSecondary">+{mission.xp}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    maxHeight: '85%',
    borderTopLeftRadius: Spacing.four,
    borderTopRightRadius: Spacing.four,
    paddingHorizontal: Spacing.three,
  },
  grab: { width: 36, height: 4, borderRadius: 999, alignSelf: 'center', marginTop: Spacing.two },
  head: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.three,
    paddingTop: Spacing.three,
  },
  headText: { flex: 1, gap: Spacing.half },
  title: { fontSize: 24, lineHeight: 30 },
  loading: { paddingVertical: Spacing.five },
  level: { gap: Spacing.two, paddingTop: Spacing.three },
  levelHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  track: { height: 6, borderRadius: 999, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 999 },
  next: {
    borderWidth: 1.5,
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.half,
    marginTop: Spacing.three,
  },
  kicker: { fontSize: 11, letterSpacing: 0.8 },
  nextTitle: { fontSize: 16 },
  list: { marginTop: Spacing.three },
  group: { gap: Spacing.half, paddingBottom: Spacing.three },
  groupTitle: { fontSize: 15, marginTop: Spacing.two },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
    borderBottomWidth: 1,
  },
  check: {
    width: 20,
    height: 20,
    borderRadius: 999,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowMain: { flex: 1, gap: Spacing.half },
});
