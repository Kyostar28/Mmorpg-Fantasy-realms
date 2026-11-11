import { playersStore } from '@/lib/player-store';

export function GET() {
  try {
    // Obtener todos los jugadores del store en memoria
    const allPlayers = Array.from(playersStore.values());
    
    // Filtrar jugadores que tienen clase y ordenar por nivel y xp
    const rows = allPlayers
      .filter((player) => player.class_name !== undefined)
      .sort((a, b) => {
        const levelDifference = (b.level ?? 0) - (a.level ?? 0);
        if (levelDifference !== 0) return levelDifference;
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
