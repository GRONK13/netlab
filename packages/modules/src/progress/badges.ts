import { MODULES } from '../catalog.ts';
import { moduleSteps, type Done } from './steps.ts';

/** Icon names the web app maps to lucide icons. */
export type BadgeIcon =
  | 'cable'
  | 'network'
  | 'tags'
  | 'route'
  | 'lock'
  | 'graduation-cap'
  | 'target'
  | 'lightbulb-off'
  | 'zap'
  | 'flame'
  | 'calendar-check'
  | 'activity'
  | 'goal'
  | 'signal';

export interface Badge {
  id: string;
  name: string;
  /** How to earn it. */
  description: string;
  icon: BadgeIcon;
}

/** What badges are decided from. The server gathers it; nothing here reads a clock. */
export interface BadgeStats {
  done: Done;
  /** Graded labs finished without a hint. */
  noHintLabs: number;
  /** A checkpoint quiz attempt with every question right. */
  perfectQuiz: boolean;
  /** The fastest subnetting trainer round with every problem right, in ms. */
  fastestPerfectRound: number | null;
  longestStreak: number;
  /** Weeks in which the student met their weekly goal. */
  goalWeeks: number;
}

/** Subnet Sprinter: a perfect trainer round within this time. */
export const SPRINT_MS = 3 * 60_000;

/** One badge per module, for finishing every step. A test checks every module has one. */
const MODULE_BADGES: Record<string, { name: string; icon: BadgeIcon }> = {
  'ip-addressing': { name: 'Subnetted', icon: 'network' },
  'switching-vlans': { name: 'Tagged', icon: 'tags' },
  'inter-vlan-routing': { name: 'Routed', icon: 'route' },
  'device-security': { name: 'Locked Down', icon: 'lock' },
};

const complete = (s: BadgeStats, moduleId: string) => {
  const mod = MODULES.find((m) => m.id === moduleId);
  return !!mod && moduleSteps(mod, s.done).every((step) => step.done);
};

const RULES: (Badge & { earned: (s: BadgeStats) => boolean })[] = [
  {
    id: 'first-link',
    name: 'First Link',
    description: 'Complete your first lab or guided practice.',
    icon: 'cable',
    earned: (s) => s.done.labs.size > 0,
  },
  ...MODULES.filter((m) => MODULE_BADGES[m.id]).map((m) => ({
    id: `module-${m.id}`,
    ...MODULE_BADGES[m.id]!,
    description: `Finish every step of Module ${m.number}, ${m.title}.`,
    earned: (s: BadgeStats) => complete(s, m.id),
  })),
  {
    id: 'core-complete',
    name: 'Core Complete',
    description: 'Finish every step of every module.',
    icon: 'graduation-cap',
    earned: (s) => MODULES.every((m) => complete(s, m.id)),
  },
  {
    id: 'ten-for-ten',
    name: 'Ten for Ten',
    description: 'Score 10/10 on a checkpoint quiz.',
    icon: 'target',
    earned: (s) => s.perfectQuiz,
  },
  {
    id: 'no-hints',
    name: 'No Hints Needed',
    description: 'Complete a graded lab without using a hint.',
    icon: 'lightbulb-off',
    earned: (s) => s.noHintLabs > 0,
  },
  {
    id: 'subnet-sprinter',
    name: 'Subnet Sprinter',
    description: 'Get 10/10 on a subnetting trainer round in under 3 minutes.',
    icon: 'zap',
    earned: (s) => s.fastestPerfectRound !== null && s.fastestPerfectRound < SPRINT_MS,
  },
  {
    id: 'streak-3',
    name: 'Link Up',
    description: 'Reach a 3-day streak.',
    icon: 'flame',
    earned: (s) => s.longestStreak >= 3,
  },
  {
    id: 'streak-7',
    name: 'Full Week',
    description: 'Reach a 7-day streak.',
    icon: 'calendar-check',
    earned: (s) => s.longestStreak >= 7,
  },
  {
    id: 'streak-30',
    name: 'Thirty-Day Uptime',
    description: 'Reach a 30-day streak.',
    icon: 'activity',
    earned: (s) => s.longestStreak >= 30,
  },
  {
    id: 'goal-met',
    name: 'Goal Met',
    description: 'Meet your weekly goal.',
    icon: 'goal',
    earned: (s) => s.goalWeeks >= 1,
  },
  {
    id: 'goal-4',
    name: 'Steady Signal',
    description: 'Meet your weekly goal in 4 different weeks.',
    icon: 'signal',
    earned: (s) => s.goalWeeks >= 4,
  },
];

/** Every badge, in display order. Cosmetic: badges give no XP. */
export const BADGES: Badge[] = RULES.map(({ earned: _, ...badge }) => badge);

export function getBadge(id: string): Badge | undefined {
  return BADGES.find((b) => b.id === id);
}

/** The ids of every badge these stats earn, in display order. */
export function earnedBadges(stats: BadgeStats): string[] {
  return RULES.filter((r) => r.earned(stats)).map((r) => r.id);
}
