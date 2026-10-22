import { dayNumber, type Week } from '@netlab/modules';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/** Monday to Sunday as port LEDs: lit on days with practice, today outlined. */
export function WeekStrip({ week, today }: { week: Week; today: string }) {
  const t = dayNumber(today) - dayNumber(week.start);
  return (
    <ol className="week-strip" aria-label="This week">
      {DAYS.map((name, i) => {
        const state = week.days[i] ? 'practised' : i < t ? 'no practice' : i === t ? 'not yet' : 'still to come';
        return (
          <li key={name} className={i === t ? 'today' : i > t ? 'later' : undefined} title={`${name}: ${state}`}>
            <i className={week.days[i] ? 'on' : undefined} />
            <span className="mono" aria-hidden="true">
              {name[0]}
            </span>
            <span className="sr-only">
              {name}
              {i === t && ' (today)'}: {state}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
