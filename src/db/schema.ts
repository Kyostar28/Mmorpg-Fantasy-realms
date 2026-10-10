import { index, integer, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
// The project's Drizzle schema — the source of truth for `npm run db:generate` (A3.5). Add the app's tables
// below. Event logs, telemetry and analytics streams do not belong in this database (A3.18).
export * from './schema.auth';

// Fantasy Realms: username-only characters and the player-to-player auction house. Timestamps are ISO-8601 text.
export const players = sqliteTable(
  'players',
  {
    id: text().primaryKey(),
    username: text().notNull(),
    usernameLower: text().notNull(),
    race: text(),
    className: text(),
    level: integer().notNull().default(1),
    xp: integer().notNull().default(0),
    gold: integer().notNull().default(10),
    kills: integer().notNull().default(0),
    zone: text(),
    posX: real(),
    posZ: real(),
    inventory: text(),
    equipment: text(),
    graphics: text().notNull().default('normal'),
    primaryColor: text().default('#c79c6e'),
    secondaryColor: text().default('#5a3b22'),
    lastLogin: text(),
    createdAt: text().notNull(),
  },
  (t) => [uniqueIndex('players_username_lower').on(t.usernameLower), index('players_level').on(t.level)],
);

export const auctionListings = sqliteTable(
  'auction_listings',
  {
    id: text().primaryKey(),
    sellerId: text().notNull().references(() => players.id, { onDelete: 'cascade' }),
    sellerName: text().notNull(),
    itemId: text().notNull(),
    qty: integer().notNull().default(1),
    price: integer().notNull(),
    status: text().notNull().default('active'), // active | sold | cancelled
    buyerName: text(),
    proceedsClaimed: integer().notNull().default(0),
    createdAt: text().notNull(),
  },
  (t) => [index('auction_status').on(t.status), index('auction_seller').on(t.sellerId)],
);
