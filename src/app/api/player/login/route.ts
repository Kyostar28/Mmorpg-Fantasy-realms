import { eq } from 'drizzle-orm';

import { db } from '@/db';
import { players } from '@/db/schema';
import { toRecord } from '@/lib/player-record';

// Username-only login: finds the player by username or creates a new one.
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as { username?: string };
    const username = (body.username ?? '').trim();
    if (!/^[\p{L}\p{N}_-]{3,16}$/u.test(username)) {
      return Response.json({ ok: false, error: 'El nombre debe tener entre 3 y 16 caracteres (letras, números, _ o -).' }, { status: 400 });
    }
    const lower = username.toLowerCase();
    const now = new Date().toISOString();
    const [existing] = await db.select().from(players).where(eq(players.usernameLower, lower)).limit(1);
    if (existing) {
      await db.update(players).set({ lastLogin: now }).where(eq(players.id, existing.id));
      console.log('[player/login] existing player', existing.username);
      return Response.json({ ok: true, data: toRecord({ ...existing, lastLogin: now }) });
    }
    const [created] = await db
      .insert(players)
      .values({ 
        id: crypto.randomUUID(), 
        username, 
        usernameLower: lower, 
        lastLogin: now, 
        createdAt: now,
        primaryColor: '#c79c6e',
        secondaryColor: '#5a3b22',
      } as any)
      .returning();
    console.log('[player/login] new player', username);
    return Response.json({ ok: true, data: toRecord(created) });
  } catch (err) {
    console.error('[player/login] error:', err);
    return Response.json({ ok: false, error: 'Error al procesar el login. Intenta de nuevo.' }, { status: 500 });
  }
}
