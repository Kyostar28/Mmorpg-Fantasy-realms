import type { PlayerRecord } from '@/lib/game/data';
import { playersStore } from '@/lib/player-store';

const GRAPHICS = ['low', 'normal', 'high'];
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
const str = (v: unknown) => (typeof v === 'string' ? v : undefined);

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let p = playersStore.get(id);
  if (!p) {
    p = {
      _id: id,
      username: 'Aventurero',
      race: 'human',
      class_name: 'warrior',
      level: 1,
      xp: 0,
      gold: 10,
      kills: 0,
      zone: 'Valle de Ventormenta',
      pos_x: 0,
      pos_z: 8,
      graphics: 'normal',
      last_login: new Date().toISOString(),
    };
    playersStore.set(id, p);
  }
  return Response.json({ ok: true, data: p });
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const b = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!b) return Response.json({ ok: false, error: 'Datos no válidos' }, { status: 400 });
  
  let existing = playersStore.get(id);
  if (!existing) {
    existing = {
      _id: id,
      username: str(b.username) ?? 'Aventurero',
      level: 1,
      xp: 0,
      gold: 10,
      kills: 0,
      graphics: 'normal',
      last_login: new Date().toISOString(),
    };
  }
  
  // Actualizar el jugador con los nuevos datos
  const updated: PlayerRecord = { ...existing };
  if (str(b.username)) updated.username = str(b.username)!;
  if (str(b.race)) updated.race = str(b.race);
  if (str(b.class_name)) updated.class_name = str(b.class_name);
  if (num(b.level) !== undefined) updated.level = Math.max(1, Math.min(60, Math.round(b.level as number)));
  if (num(b.xp) !== undefined) updated.xp = Math.max(0, Math.round(b.xp as number));
  if (num(b.gold) !== undefined) updated.gold = Math.max(0, Math.round(b.gold as number));
  if (num(b.kills) !== undefined) updated.kills = Math.max(0, Math.round(b.kills as number));
  if (str(b.zone)) updated.zone = str(b.zone);
  if (num(b.pos_x) !== undefined) updated.pos_x = b.pos_x as number;
  if (num(b.pos_z) !== undefined) updated.pos_z = b.pos_z as number;
  if (b.inventory !== undefined) updated.inventory = typeof b.inventory === 'string' ? b.inventory : JSON.stringify(b.inventory);
  if (b.equipment !== undefined) updated.equipment = typeof b.equipment === 'string' ? b.equipment : JSON.stringify(b.equipment);
  if (str(b.graphics) && GRAPHICS.includes(b.graphics as string)) updated.graphics = b.graphics as "low" | "normal" | "high";
  if (str(b.primaryColor)) updated.primaryColor = str(b.primaryColor);
  if (str(b.secondaryColor)) updated.secondaryColor = str(b.secondaryColor);
  
  playersStore.set(id, updated);
  console.log('[player PUT] saved', id, Object.keys(b).join(','));
  return Response.json({ ok: true, data: updated });
}
