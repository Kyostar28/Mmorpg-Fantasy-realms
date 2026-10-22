import type { PlayerRecord } from '@/lib/game/data';

// Almacenamiento en memoria compartido para simular base de datos
// Los datos se pierden al reiniciar el servidor
export const playersStore = new Map<string, PlayerRecord>();
