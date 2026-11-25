import { Feather } from '@expo/vector-icons';
import { router, usePathname } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BLOCKS } from '@/blocks';
import { useDialog } from '@/lib/ask';
import { useIsDesktop } from '@/lib/useDesktop';
import { useDesk } from '@/store/desk';
import { orderBlocks, useLayout } from '@/store/layout';
import { colors, fonts, themed } from '@/theme';

import { ADD_KEY, DRAG_REGION, FRAME_PAD, PAGE_MAX, SHEET_RADIUS } from './frame';
import { Sidebar } from './Sidebar';

type Hover = { hovered?: boolean };

/**
 * Frame for a full-screen route (settings, the note editor) on desktop. The window keeps
 * its shape: the same sidebar and the same workspace as home, with the page inside the
 * workspace. Its title strip drags the window, says where you are and leads back; picking
 * a block in the sidebar goes home to it. Escape goes back.
 * On phones it renders the page as it is.
 */
export function DesktopPage({
  title = '',
  note,
  back = 'Back',
  block: blockKey,
  settings,
  ground = colors.bg,
  maxWidth = PAGE_MAX,
  children,
}: {
  /** Where you are, in the title strip. */
  title?: string;
  /** A quieter line after the title. */
  note?: string;
  /** Where Back leads, e.g. "Notes". */
  back?: string;
  /** The block this page belongs to: it stays lit in the sidebar. */
  block?: string;
  /** This is the settings page: Settings is the lit row instead. */
  settings?: boolean;
  ground?: string;
  /** How wide the page runs before it stops and centres. */
  maxWidth?: number;
  children: React.ReactNode;
}) {
  const desktop = useIsDesktop();
  const pathname = usePathname();
  const order = useLayout((s) => s.order);
  const rail = useLayout((s) => s.railOnly);
  const setRail = useLayout((s) => s.setRailOnly);
  const current = useDesk((s) => s.block);
  const setBlock = useDesk((s) => s.setBlock);
  const blocks = useMemo(() => orderBlocks(BLOCKS, order), [order]);
  const index = Math.max(0, blocks.findIndex((b) => b.key === (blockKey ?? current)));

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/'));

  // Bubble phase: drawers, dialogs and forms catch Escape first (capture) and stop it.
  useEffect(() => {
    if (!desktop) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented || useDialog.getState().dialog) return;
      e.preventDefault();
      if (router.canGoBack()) router.back();
      else router.replace('/');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [desktop, pathname]);

  if (!desktop) return <>{children}</>;

  return (
    <View style={styles.root}>
      <Sidebar
        blocks={blocks}
        index={index}
        onSelect={(i) => {
          setBlock(blocks[i].key);
          goBack();
        }}
        rail={rail}
        onToggleRail={() => setRail(!rail)}
        addKey={ADD_KEY}
        settings={settings}
      />

      <View style={[styles.work, { backgroundColor: ground }]}>
        <View style={styles.strip} {...DRAG_REGION}>
          <Pressable
            onPress={goBack}
            style={({ hovered }: Hover) => [styles.back, hovered && styles.backHover]}
            accessibilityRole="button"
            accessibilityLabel={`${back} (Esc)`}
          >
            <Feather name="chevron-left" size={15} color={colors.inkSoft} />
            <Text style={styles.backText}>{back}</Text>
          </Pressable>
          {title ? (
            <Text style={styles.crumb} numberOfLines={1} pointerEvents="none">
              {title}
              {note ? <Text style={styles.crumbSoft}>{`  ·  ${note}`}</Text> : null}
            </Text>
          ) : null}
          <Text style={styles.key} pointerEvents="none">
            Esc
          </Text>
        </View>
        <View style={styles.area}>
          <View style={[styles.column, { maxWidth }]}>{children}</View>
        </View>
      </View>
    </View>
  );
}

const styles = themed((colors) => StyleSheet.create({
  root: { flex: 1, flexDirection: 'row', backgroundColor: colors.backdrop },
  // Same box as the home workspace, so the window doesn't change shape between pages.
  work: {
    flex: 1,
    marginVertical: FRAME_PAD,
    marginRight: FRAME_PAD,
    borderRadius: SHEET_RADIUS,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  strip: { height: 44, flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 16, paddingRight: 20 },
  back: {
    height: 30,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingLeft: 6,
    paddingRight: 11,
    backgroundColor: colors.chip,
  },
  backHover: { backgroundColor: colors.line },
  backText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.inkSoft },
  crumb: { flex: 1, fontFamily: fonts.semibold, fontSize: 13, color: colors.ink },
  crumbSoft: { fontFamily: fonts.medium, color: colors.muted },
  key: { fontFamily: fonts.medium, fontSize: 11.5, color: colors.faint },
  area: { flex: 1, alignItems: 'center', paddingHorizontal: 28 },
  column: { flex: 1, width: '100%' },
}));
