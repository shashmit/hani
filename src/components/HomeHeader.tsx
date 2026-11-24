import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { HazelFace } from '@/components/mascot/HazelFace';
import { fonts, themed } from '@/theme';

/** Logo row at the top of the first sheet. Navigation lives in the dock. */
export function HomeHeader() {
  const now = new Date();
  const weekday = now.toLocaleDateString('en-US', { weekday: 'short' });
  const month = now.toLocaleDateString('en-US', { month: 'short' });

  return (
    <View style={styles.root}>
      <View>
        {/* Holding the logo replays the welcome tour. */}
        <Pressable
          style={styles.logoRow}
          onLongPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
            router.push('/onboarding');
          }}
          accessibilityRole="button"
          accessibilityLabel="hani"
          accessibilityHint="Hold to replay the welcome tour"
        >
          <HazelFace size={30} />
          <Text style={styles.logo}>hani</Text>
        </Pressable>
        <Text style={styles.tagline}>Hazel is minding your stash</Text>
      </View>
      <View style={styles.date}>
        <Text style={styles.dateSmall}>
          {weekday}, {month}
        </Text>
        <Text style={styles.dateDay}>{now.getDate()}</Text>
      </View>
    </View>
  );
}

const styles = themed((colors) =>
  StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 6,
    paddingBottom: 10,
  },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  logo: { fontFamily: fonts.display, fontSize: 28, lineHeight: 32, color: colors.ink },
  tagline: { fontFamily: fonts.medium, fontSize: 13.5, color: colors.muted },
  date: { alignItems: 'flex-end' },
  dateSmall: { fontFamily: fonts.semibold, fontSize: 12.5, color: colors.muted },
  dateDay: { fontFamily: fonts.display, fontSize: 28, color: colors.ink, lineHeight: 32 },
  }),
);
