// Moderation for the public leaderboard, run by the site admin through scripts/admin.ts.

import type { Db } from './db.ts';
import { displayNameProblem } from './names.ts';

export interface AdminUser {
  id: number;
  email: string;
  display_name: string;
  hidden: boolean;
}

/** An account by id ("12") or email. */
async function one(db: Db, who: string): Promise<AdminUser> {
  const [user] = /^\d+$/.test(who)
    ? await db.query<AdminUser>('select id, email, display_name, hidden from users where id = $1', [Number(who)])
    : await db.query<AdminUser>('select id, email, display_name, hidden from users where email = $1', [
        who.trim().toLowerCase(),
      ]);
  if (!user) throw new Error(`No account matches "${who}".`);
  return user;
}

/** Accounts whose email or display name contains `text`. */
export function findUsers(db: Db, text: string): Promise<AdminUser[]> {
  return db.query<AdminUser>(
    `select id, email, display_name, hidden from users
     where strpos(lower(email), lower($1)) > 0 or strpos(lower(display_name), lower($1)) > 0
     order by id limit 50`,
    [text],
  );
}

export async function renameUser(db: Db, who: string, name: string): Promise<AdminUser> {
  const user = await one(db, who);
  const displayName = name.trim().slice(0, 40);
  const problem = displayNameProblem(displayName);
  if (problem) throw new Error(problem);
  await db.query('update users set display_name = $2 where id = $1', [user.id, displayName]);
  return { ...user, display_name: displayName };
}

/** Hidden accounts keep working but never appear on the leaderboard. */
export async function setHidden(db: Db, who: string, hidden: boolean): Promise<AdminUser> {
  const user = await one(db, who);
  await db.query('update users set hidden = $2 where id = $1', [user.id, hidden]);
  return { ...user, hidden };
}
