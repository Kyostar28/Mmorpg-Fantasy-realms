import type { PlayerRecord } from '@/lib/game/data';
import { playersStore } from '@/lib/player-store';

export async function GET() {
  try {
    // Obtener todos los jugadores del store en memoria
    const allPlayers = Array.from(playersStore.values());
    
    // Filtrar jugadores que tienen clase y ordenar por nivel y xp
    const rows = allPlayers
      .filter(p => p.class_name !== undefined && p.class_name !== null)
      .sort((a, b) => {
        if (b.level !== a.level) return b.level - a.level;
        return (b.xp ?? 0) - (a.xp ?? 0);
      })
      .slice(0, 8)
      .map(p => ({
        _id: p._id,
        username: p.username,
        race: p.race,
        class_name: p.class_name,
        level: p.level,
        kills: p.kills,
      }));
    
    return Response.json({ ok: true, data: rows });
  } catch (err) {
    console.error('[players/top] error:', err);
    return Response.json({ ok: true, data: [] });
  }
}
