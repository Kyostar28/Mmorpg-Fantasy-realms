import { desc, isNotNull } from 'drizzle-orm';

import { db } from '@/db';
import { players } from '@/db/schema';

export async function GET() {
  const rows = await db
    .select({ _id: players.id, username: players.username, race: players.race, class_name: players.className, level: players.level, kills: players.kills })
    .from(players)
    .where(isNotNull(players.className))
    .orderBy(desc(players.level), desc(players.xp))
    .limit(8);
  return Response.json({ ok: true, data: rows });
}
