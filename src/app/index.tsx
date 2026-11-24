import { Redirect } from 'expo-router';
import { useMemo } from 'react';

import { BLOCKS } from '@/blocks';
import { BlockPager } from '@/components/BlockPager';
import { DesktopHome } from '@/components/desktop/DesktopHome';
import { EntriesPanel } from '@/components/EntriesPanel';
import { HomeHeader } from '@/components/HomeHeader';
import { SidePanelHost } from '@/components/SidePanel';
import { useIsDesktop } from '@/lib/useDesktop';
import { orderBlocks, useLayout } from '@/store/layout';
import { usePrefs, usePrefsReady } from '@/store/prefs';

export default function Home() {
  const desktop = useIsDesktop();
  const order = useLayout((s) => s.order);
  const setOrder = useLayout((s) => s.setOrder);
  const blocks = useMemo(() => orderBlocks(BLOCKS, order), [order]);
  const prefsReady = usePrefsReady();
  const onboarded = usePrefs((s) => s.onboarded);

  if (desktop) return <DesktopHome />;
  // First launch on a phone: the tour first (it plays behind the intro animation).
  if (prefsReady && !onboarded) return <Redirect href="/onboarding" />;

  return (
    <SidePanelHost panels={{ entries: <EntriesPanel /> }}>
      <BlockPager blocks={blocks} header={<HomeHeader />} onReorder={setOrder} />
    </SidePanelHost>
  );
}
