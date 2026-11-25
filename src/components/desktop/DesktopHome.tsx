import { isTauri } from '@tauri-apps/api/core';
import { router, usePathname, type Href } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { BLOCKS, type BlockDef } from '@/blocks';
import { EntriesPanel } from '@/components/EntriesPanel';
import { DockedPanel, SidePanelHost } from '@/components/SidePanel';
import { ask, useDialog } from '@/lib/ask';
import { currentSummary, isEmpty, whenLoaded } from '@/lib/backup';
import { importBackup } from '@/lib/backupActions';
import { BlockActive, BlockSpace } from '@/lib/blockSpace';
import { useDesk } from '@/store/desk';
import { orderBlocks, useLayout } from '@/store/layout';
import { usePrefs } from '@/store/prefs';
import { fonts, themed } from '@/theme';

import { ADD_KEY, DRAG_REGION, FRAME_PAD, IS_MAC, SHEET_RADIUS } from './frame';
import { Sidebar } from './Sidebar';

/** ⌘E new expense, ⌘T new task, ⌘L new link, ⌘N new note, ⌘B budget, ⌘, settings. */
const SHORTCUTS: Record<string, Href> = {
  b: '/budget',
  ',': '/settings',
  ...Object.fromEntries(BLOCKS.filter((b) => ADD_KEY[b.key]).map((b) => [ADD_KEY[b.key].toLowerCase(), b.addRoute])),
};

/** How wide each block's content may run before it stops and centres. */
const MAX_W: Record<string, number> = { money: 1180, tasks: 760, bookmarks: 1240, notes: 820 };
/** Money shows its entries beside it once the workspace is at least this wide. */
const SPLIT_MIN = 820;
/** Nothing floats over a desktop page, so lists only need a little room at the bottom. */
const SPACE = { bottom: 24 };

/**
 * Desktop home, laid out like a desktop app: a sidebar on the bark (blocks, and the open
 * block's own places), and one rounded workspace beside it showing that block. Money
 * splits into summary and entries side by side; the other blocks keep a readable column.
 * ⌘1…⌘4 switch blocks, ⌘\ folds the sidebar.
 */
export function DesktopHome() {
  const pathname = usePathname();
  // Same block order the user set on this device.
  const order = useLayout((st) => st.order);
  const rail = useLayout((st) => st.railOnly);
  const setRail = useLayout((st) => st.setRailOnly);
  const blocks = useMemo(() => orderBlocks(BLOCKS, order), [order]);
  const last = blocks.length - 1;
  const current = useDesk((st) => st.block);
  const setBlock = useDesk((st) => st.setBlock);
  const index = Math.max(0, blocks.findIndex((b) => b.key === current));
  const block = blocks[index];

  const go = useCallback((i: number) => setBlock(blocks[Math.min(last, Math.max(0, i))].key), [blocks, last, setBlock]);

  // First launch with nothing saved: offer to bring a stash over from a backup. This is
  // the desktop's whole welcome (the phone has its tour), so it is only asked once.
  useEffect(() => {
    let live = true;
    whenLoaded().then(() => {
      const { onboarded, setOnboarded } = usePrefs.getState();
      if (!live || onboarded) return;
      setOnboarded(true);
      if (!isEmpty(currentSummary())) return;
      ask('Welcome to hani', 'Everything you add stays on this computer. Moving in from another device? Bring your stash over from a backup file. You can also do this later in Settings.', [
        { text: 'Restore a backup', onPress: () => void importBackup() },
        { text: 'Start fresh', style: 'cancel' },
      ]);
    });
    return () => {
      live = false;
    };
  }, []);

  // Only home itself answers keys, with no form or dialog on top.
  const homeActive = useCallback(() => pathname === '/' && !useDialog.getState().dialog, [pathname]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = IS_MAC ? e.metaKey : e.ctrlKey;
      if (!mod || e.shiftKey || e.altKey || !homeActive()) return;
      const k = e.key.toLowerCase();
      let handled = true;
      if (SHORTCUTS[k]) router.push(SHORTCUTS[k]);
      else if (/^[1-9]$/.test(k) && +k - 1 <= last) go(+k - 1);
      else if (k === '\\') setRail(!useLayout.getState().railOnly);
      else handled = false;
      if (handled) e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [homeActive, go, last, setRail]);

  // In the desktop app, right-click opens hani's own menus only (no "Reload / Inspect").
  useEffect(() => {
    if (!isTauri()) return;
    const onMenu = (e: MouseEvent) => {
      const el = e.target as HTMLElement | null;
      if (!el?.closest('input, textarea')) e.preventDefault();
    };
    document.addEventListener('contextmenu', onMenu);
    return () => document.removeEventListener('contextmenu', onMenu);
  }, []);

  return (
    <View style={styles.root}>
      <Sidebar
        blocks={blocks}
        index={index}
        onSelect={go}
        rail={rail}
        onToggleRail={() => setRail(!rail)}
        addKey={ADD_KEY}
      />

      <View style={[styles.work, { backgroundColor: block.ground }]}>
        {/* Window title strip: drags the window, names where you are. */}
        <View style={styles.strip} {...DRAG_REGION}>
          <Text style={styles.crumb} pointerEvents="none">
            {block.title}
            <Text style={styles.crumbSoft}>{`  ·  ${block.blurb}`}</Text>
          </Text>
        </View>

        <View style={styles.stage}>
          {blocks.map((b, i) => (
            <Pane key={b.key} block={b} active={i === index} />
          ))}
        </View>
      </View>
    </View>
  );
}

/** One block's page. All of them stay mounted (search, scroll and filters survive a switch). */
function Pane({ block, active }: { block: BlockDef; active: boolean }) {
  const shown = useSharedValue(active ? 1 : 0);
  useEffect(() => {
    shown.set(active ? withTiming(1, { duration: 220 }) : 0);
  }, [active, shown]);
  const style = useAnimatedStyle(() => ({
    opacity: shown.get(),
    transform: [{ translateY: (1 - shown.get()) * 10 }],
  }));

  const { Component } = block;
  return (
    <Animated.View style={[styles.pane, !active && styles.hidden, style]} aria-hidden={!active}>
      <BlockActive.Provider value={active}>
        <BlockSpace.Provider value={SPACE}>
          <View style={[styles.column, { maxWidth: MAX_W[block.key] ?? 820 }]}>
            {block.key === 'money' ? <MoneyDesk /> : <Component />}
          </View>
        </BlockSpace.Provider>
      </BlockActive.Provider>
    </Animated.View>
  );
}

/**
 * Money on a wide window: the month's summary and places on the left, every entry on the
 * right, both always there. On a narrow one the entries slide in over the summary, as on
 * the phone.
 */
function MoneyDesk() {
  const [width, setWidth] = useState(0);
  const Money = BLOCKS.find((b) => b.key === 'money')!.Component;
  const split = width >= SPLIT_MIN;
  const side = Math.round(Math.min(460, Math.max(360, width * 0.4)));

  return (
    <View style={styles.fill} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {width === 0 ? null : split ? (
        <View style={styles.split}>
          <View style={{ width: side }}>
            <DockedPanel at={0} width={side}>
              <Money />
            </DockedPanel>
          </View>
          <View style={styles.fill}>
            <DockedPanel at={1} width={width - side}>
              <EntriesPanel />
            </DockedPanel>
          </View>
        </View>
      ) : (
        <SidePanelHost plain panels={{ entries: <EntriesPanel /> }}>
          <Money />
        </SidePanelHost>
      )}
    </View>
  );
}

const styles = themed((colors) => StyleSheet.create({
  root: { flex: 1, flexDirection: 'row', backgroundColor: colors.backdrop },
  work: {
    flex: 1,
    marginVertical: FRAME_PAD,
    marginRight: FRAME_PAD,
    borderRadius: SHEET_RADIUS,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  strip: { height: 44, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 28 },
  crumb: { fontFamily: fonts.semibold, fontSize: 13, color: colors.ink },
  crumbSoft: { fontFamily: fonts.medium, color: colors.muted },
  stage: { flex: 1 },
  pane: { ...StyleSheet.absoluteFill, paddingHorizontal: 28, paddingBottom: 16, alignItems: 'center' } as object,
  hidden: { display: 'none' },
  column: { flex: 1, width: '100%' },
  fill: { flex: 1, minWidth: 0 },
  split: { flex: 1, flexDirection: 'row', gap: 32 },
}));

