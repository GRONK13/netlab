export { MODULES, getModule } from './catalog.ts';

export {
  TRAINERS,
  getTrainer,
  makeRound,
  solve,
  isCorrect,
  type TrainerSpec,
  type Problem,
  type ProblemKind,
} from './trainer.ts';
export { mulberry32, type Rng } from './random.ts';
export { dayNumber, fromDayNumber, weekStart } from './progress/days.ts';
export { streakOf, type Streak } from './progress/streak.ts';
export { GOAL_DEFAULT, GOAL_MAX, GOAL_MIN, weekOf, type Week } from './progress/week.ts';
export { doneFrom, moduleSteps, type Done, type ModuleStep, type StepKey } from './progress/steps.ts';
export { CCNA_DOMAINS, masteryByDomain, type DomainMastery } from './progress/mastery.ts';
export {
  BADGES,
  earnedBadges,
  getBadge,
  SPRINT_MS,
  type Badge,
  type BadgeIcon,
  type BadgeStats,
} from './progress/badges.ts';
export {
  WIDGETS,
  type WidgetName,
  type LessonSection,
  type Question,
  type Quiz,
  type Module,
} from './types.ts';
