import { getBadge } from '@netlab/modules';
import { BadgeIcon } from './BadgeIcon.tsx';

/** "Badge earned" lines for badges a result just awarded. Renders nothing when there are none. */
export function NewBadges({ ids }: { ids: readonly string[] | undefined }) {
  const badges = (ids ?? []).flatMap((id) => getBadge(id) ?? []);
  if (badges.length === 0) return null;
  return (
    <ul className="new-badges" aria-label="Badges earned">
      {badges.map((b) => (
        <li key={b.id}>
          <span className="badge-mark">
            <BadgeIcon name={b.icon} size={16} />
          </span>
          <span>
            Badge earned: <strong>{b.name}</strong>. <span className="muted">{b.description}</span>
          </span>
        </li>
      ))}
      <li>
        <a href="#/progress" className="small">
          See all your badges
        </a>
      </li>
    </ul>
  );
}
