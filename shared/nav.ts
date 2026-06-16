/**
 * Single source of truth for primary navigation, shared by web and mobile so
 * the tab order, labels, icons, and per-tab accent tints stay in sync.
 */
export type MainTab = 'trans' | 'stats' | 'categories' | 'accounts' | 'more';

export type NavItem = {
  id: MainTab;
  /** Full label (web sidebar, screen titles). */
  label: string;
  /** Short label for compact tab bars. */
  shortLabel: string;
  /** Emoji icon. */
  icon: string;
  /** Accent tint used for the active state. */
  tint: string;
};

export const NAV: NavItem[] = [
  { id: 'trans', label: 'Transactions', shortLabel: 'Records', icon: '📒', tint: '#4f7cff' },
  { id: 'stats', label: 'Statistics', shortLabel: 'Stats', icon: '📊', tint: '#22c08b' },
  { id: 'categories', label: 'Categories', shortLabel: 'Cats', icon: '🗂️', tint: '#ffb020' },
  { id: 'accounts', label: 'Accounts', shortLabel: 'Accounts', icon: '🏦', tint: '#9b6bff' },
  { id: 'more', label: 'Budgets & Data', shortLabel: 'More', icon: '⚙️', tint: '#ff5d8f' }
];

export const TAB_TITLES: Record<MainTab, string> = {
  trans: 'Transactions',
  stats: 'Statistics',
  categories: 'Categories',
  accounts: 'Accounts',
  more: 'Budgets & Data'
};
