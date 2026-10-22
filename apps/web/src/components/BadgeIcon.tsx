import type { BadgeIcon as IconName } from '@netlab/modules';
import {
  Activity,
  Cable,
  CalendarCheck,
  Flame,
  Goal,
  GraduationCap,
  LightbulbOff,
  Lock,
  Network,
  Route,
  Signal,
  Tags,
  Target,
  Zap,
  type LucideIcon,
} from 'lucide-react';

const ICONS: Record<IconName, LucideIcon> = {
  cable: Cable,
  network: Network,
  tags: Tags,
  route: Route,
  lock: Lock,
  'graduation-cap': GraduationCap,
  target: Target,
  'lightbulb-off': LightbulbOff,
  zap: Zap,
  flame: Flame,
  'calendar-check': CalendarCheck,
  activity: Activity,
  goal: Goal,
  signal: Signal,
};

export function BadgeIcon({ name, size = 20 }: { name: IconName; size?: number }) {
  const Icon = ICONS[name];
  return <Icon size={size} aria-hidden="true" />;
}
