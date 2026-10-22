"use client";

import { ITEMS, RARITY_COLOR, RARITY_NAME, SLOT_NAME } from "@/lib/game/data";

const STAT_NAME: Record<string, string> = { str: "Fuerza", agi: "Agilidad", int: "Intelecto", sta: "Aguante", armor: "Armadura", dmg: "Daño" };

export function ItemTooltip({ id, x, y, hint, price }: { id: string; x: number; y: number; hint?: string; price?: number }) {
  const it = ITEMS[id];
  if (!it) return null;
  const left = Math.min(x + 18, (typeof window !== "undefined" ? window.innerWidth : 1600) - 290);
  const top = Math.min(y + 12, (typeof window !== "undefined" ? window.innerHeight : 900) - 260);
  return (
    <div className="pointer-events-none fixed z-[200] w-[270px] rounded border border-stone-500/70 bg-[#0a0d1a]/95 p-3 text-sm shadow-2xl" style={{ left, top }}>
      <p className="font-display text-base font-bold" style={{ color: RARITY_COLOR[it.rarity] }}>{it.name}</p>
      <p className="text-xs text-stone-400">{RARITY_NAME[it.rarity]}</p>
      <div className="mt-1 flex justify-between text-stone-200">
        <span>{SLOT_NAME[it.type]}</span>
        {it.level > 1 && <span className="text-stone-400">Nivel {it.level}</span>}
      </div>
      {it.stats && (
        <div className="mt-1.5 space-y-0.5">
          {it.stats.dmg ? <p className="text-white">{it.stats.dmg} de daño</p> : null}
          {it.stats.armor ? <p className="text-white">{it.stats.armor} de armadura</p> : null}
          {Object.entries(it.stats)
            .filter(([k]) => k !== "dmg" && k !== "armor")
            .map(([k, v]) => (
              <p key={k} className="text-[#1eff00]">+{v} {STAT_NAME[k]}</p>
            ))}
        </div>
      )}
      {it.desc && <p className="mt-1.5 text-[#1eff00]">{it.type === "consumable" ? `Uso: ${it.desc}` : it.desc}</p>}
      <p className="mt-2 text-xs text-stone-300">
        {price !== undefined ? <>Precio: <span className="text-amber-300">{price} 🪙</span></> : <>Venta: <span className="text-amber-300">{it.value} 🪙</span></>}
      </p>
      {hint && <p className="mt-1 text-xs italic text-sky-300">{hint}</p>}
    </div>
  );
}
