import type { Feather } from '@expo/vector-icons';
import type { ComponentType } from 'react';

import { colors } from '@/theme';
import { BookmarksBlock } from './BookmarksBlock';
import { ExpensesBlock } from './ExpensesBlock';
import { NotesBlock } from './NotesBlock';
import { TasksBlock } from './TasksBlock';

export type BlockDef = {
  key: string;
  /** Short label shown on the dock pill. */
  title: string;
  /** One line for the dock's hold menu. */
  blurb: string;
  icon: React.ComponentProps<typeof Feather>['name'];
  Component: ComponentType;
  /** Where the dock's + button goes while this block is on screen. */
  addRoute: '/add-expense' | '/add-task' | '/add-bookmark' | '/add-note';
  addLabel: string;
  /** Background colour of this block's sheet (read live: it follows light/dark). */
  ground: string;
};

/**
 * The home screen is a vertical stack of full-screen "blocks" (sheets).
 * Pull the dock to move between neighbours, or hold it to jump to any block.
 * Add a new block here.
 */
export const BLOCKS: BlockDef[] = [
  {
    key: 'money',
    title: 'Money',
    blurb: 'Budget, places and spending',
    icon: 'credit-card',
    Component: ExpensesBlock,
    addRoute: '/add-expense',
    addLabel: 'Add expense',
    get ground() {
      return colors.ground;
    },
  },
  {
    key: 'tasks',
    title: 'Tasks',
    blurb: 'Your day, one tick at a time',
    icon: 'check-circle',
    Component: TasksBlock,
    addRoute: '/add-task',
    addLabel: 'Add task',
    get ground() {
      return colors.groundTasks;
    },
  },
  {
    key: 'bookmarks',
    title: 'Bookmarks',
    blurb: 'Links, sorted into collections',
    icon: 'bookmark',
    Component: BookmarksBlock,
    addRoute: '/add-bookmark',
    addLabel: 'Add bookmark',
    get ground() {
      return colors.groundBookmarks;
    },
  },
  {
    key: 'notes',
    title: 'Notes',
    blurb: 'Folders, tags, quick thoughts',
    icon: 'edit-3',
    Component: NotesBlock,
    addRoute: '/add-note',
    addLabel: 'New note',
    get ground() {
      return colors.groundNotes;
    },
  },
];
