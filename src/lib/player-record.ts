import type { players } from '@/db/schema';

// The client's shape of a character row (`_id` kept from the game's first version).
export function toRecord(p: typeof players.$inferSelect) {
  return {
    _id: p.id,
    username: p.username,
    race: p.race ?? undefined,
    class_name: p.className ?? undefined,
    level: p.level,
    xp: p.xp,
    gold: p.gold,
    kills: p.kills,
    zone: p.zone ?? undefined,
    pos_x: p.posX ?? undefined,
    pos_z: p.posZ ?? undefined,
    inventory: p.inventory ?? undefined,
    equipment: p.equipment ?? undefined,
    graphics: p.graphics,
    primaryColor: (p as any).primaryColor ?? undefined,
    secondaryColor: (p as any).secondaryColor ?? undefined,
    last_login: p.lastLogin ?? undefined,
  };
}
