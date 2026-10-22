import type { PlayerRecord } from '@/lib/game/data';
import { playersStore } from '@/lib/player-store';

// Username-only login: simula login sin base de datos usando localStorage del cliente
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as { username?: string };
    const username = (body.username ?? '').trim();
    if (!/^[\p{L}\p{N}_-]{3,16}$/u.test(username)) {
      return Response.json({ ok: false, error: 'El nombre debe tener entre 3 y 16 caracteres (letras, números, _ o -).' }, { status: 400 });
    }
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    
    // Simular creación de jugador sin base de datos
    const player: PlayerRecord = {
      _id: id,
      username,
      race: undefined,
      class_name: undefined,
      level: 1,
      xp: 0,
      gold: 10,
      kills: 0,
      zone: undefined,
      pos_x: undefined,
      pos_z: undefined,
      inventory: undefined,
      equipment: undefined,
      graphics: 'normal',
      last_login: now,
    };
    
    // Guardar en el store en memoria
    playersStore.set(id, player);
    
    console.log('[player/login] new player (no database)', username);
    return Response.json({ ok: true, data: player });
  } catch (err) {
    console.error('[player/login] error:', err);
    return Response.json({ ok: false, error: 'Error al procesar el login. Intenta de nuevo.' }, { status: 500 });
  }
}
