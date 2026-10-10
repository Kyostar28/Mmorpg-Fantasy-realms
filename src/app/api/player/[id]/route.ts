import { eq } from 'drizzle-orm';

import { db } from '@/db';
import { players } from '@/db/schema';
import { toRecord } from '@/lib/player-record';

const GRAPHICS = ['low', 'normal', 'high'];
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
const str = (v: unknown) => (typeof v === 'string' ? v : undefined);

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [p] = await db.select().from(players).where(eq(players.id, id)).limit(1);
  if (!p) return Response.json({ ok: false, error: 'Jugador no encontrado' }, { status: 404 });
  return Response.json({ ok: true, data: toRecord(p) });
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const b = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!b) return Response.json({ ok: false, error: 'Datos no válidos' }, { status: 400 });
  const patch: Partial<typeof players.$inferInsert> = {};
  if (str(b.race)) patch.race = str(b.race);
  if (str(b.class_name)) patch.className = str(b.class_name);
  if (num(b.level) !== undefined) patch.level = Math.max(1, Math.min(60, Math.round(b.level as number)));
  if (num(b.xp) !== undefined) patch.xp = Math.max(0, Math.round(b.xp as number));
  if (num(b.gold) !== undefined) patch.gold = Math.max(0, Math.round(b.gold as number));
  if (num(b.kills) !== undefined) patch.kills = Math.max(0, Math.round(b.kills as number));
  if (str(b.zone)) patch.zone = str(b.zone);
  if (num(b.pos_x) !== undefined) patch.posX = b.pos_x as number;
  if (num(b.pos_z) !== undefined) patch.posZ = b.pos_z as number;
  if (b.inventory !== undefined) patch.inventory = typeof b.inventory === 'string' ? b.inventory : JSON.stringify(b.inventory);
  if (b.equipment !== undefined) patch.equipment = typeof b.equipment === 'string' ? b.equipment : JSON.stringify(b.equipment);
  if (str(b.graphics) && GRAPHICS.includes(b.graphics as string)) patch.graphics = b.graphics as string;
  // if (str(b.primaryColor)) patch.primaryColor = str(b.primaryColor);
  // if (str(b.secondaryColor)) patch.secondaryColor = str(b.secondaryColor);
  if (!Object.keys(patch).length) return Response.json({ ok: false, error: 'Nada que guardar' }, { status: 400 });
  const [p] = await db.update(players).set(patch).where(eq(players.id, id)).returning();
  if (!p) return Response.json({ ok: false, error: 'Jugador no encontrado' }, { status: 404 });
  console.log('[player PUT] saved', id, Object.keys(patch).join(','));
  return Response.json({ ok: true, data: toRecord(p) });
}
