"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Backpack, BookOpen, HelpCircle, LogOut, Map as MapIcon, Skull, User, X } from "lucide-react";
import { api } from "@/lib/api";
import {
  CLASSES, ITEMS, RACES, RARITY_COLOR, ZONES, type PlayerRecord, type Slot,
} from "@/lib/game/data";
import { GameEngine, type HudSnapshot } from "@/lib/game/engine";
import { getSession } from "@/lib/game/session";
import { ItemTooltip } from "./ItemTooltip";

const RACE_EMBLEM: Record<string, string> = { human: "🦁", elf: "🌙", orc: "🪓", undead: "💀", tauren: "🐂" };
const EQUIP_SLOTS: { slot: Slot; label: string; icon: string }[] = [
  { slot: "head", label: "Cabeza", icon: "⛑️" },
  { slot: "chest", label: "Torso", icon: "🦺" },
  { slot: "legs", label: "Piernas", icon: "👖" },
  { slot: "feet", label: "Pies", icon: "🥾" },
  { slot: "weapon", label: "Arma", icon: "⚔️" },
  { slot: "offhand", label: "Mano izq.", icon: "🛡️" },
  { slot: "trinket", label: "Abalorio", icon: "💍" },
];

interface LogLine { id: number; msg: string; color: string }
type Tip = { id: string; x: number; y: number; hint?: string; price?: number } | null;

function Bar({ value, max, from, to, label, h = "h-4" }: { value: number; max: number; from: string; to: string; label?: string; h?: string }) {
  const pct = Math.max(0, Math.min(100, (value / Math.max(1, max)) * 100));
  return (
    <div className={`relative ${h} w-full overflow-hidden rounded-sm border border-black bg-black/70`}>
      <div className="absolute inset-y-0 left-0 transition-[width] duration-150" style={{ width: `${pct}%`, background: `linear-gradient(180deg, ${from}, ${to})` }} />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.18),transparent_50%)]" />
      {label && <span className="absolute inset-0 flex items-center justify-center text-[11px] font-semibold text-white [text-shadow:0_1px_2px_#000]">{label}</span>}
    </div>
  );
}

function CooldownOverlay({ remaining, total }: { remaining: number; total: number }) {
  if (remaining <= 0 || total <= 0) return null;
  const pct = (remaining / total) * 360;
  return (
    <>
      <div className="absolute inset-0 rounded" style={{ background: `conic-gradient(rgba(0,0,0,0.72) ${pct}deg, transparent ${pct}deg)` }} />
      {remaining > 1 && <span className="absolute inset-0 flex items-center justify-center font-display text-sm font-bold text-white [text-shadow:0_0_4px_#000]">{Math.ceil(remaining)}</span>}
    </>
  );
}

export default function GameClient() {
  const router = useRouter();
  const mountRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const minimapRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const logId = useRef(0);
  const [snap, setSnap] = useState<HudSnapshot | null>(null);
  const [loading, setLoading] = useState<{ msg: string; pct: number } | null>({ msg: "Conectando con el reino…", pct: 0 });
  const [error, setError] = useState<string | null>(null);
  const [log, setLog] = useState<LogLine[]>([]);
  const [zoneTitle, setZoneTitle] = useState<{ zone: number; key: number } | null>(null);
  const [win, setWin] = useState({ inv: false, char: false, map: false, help: false });
  const [mapUrl, setMapUrl] = useState("");
  const [tip, setTip] = useState<Tip>(null);
  const [saving, setSaving] = useState(false);
  const [player, setPlayer] = useState<PlayerRecord | null>(null);

  const pushLog = useCallback((msg: string, color = "#e8e0c8") => {
    setLog((l) => [...l.slice(-40), { id: logId.current++, msg, color }]);
  }, []);

  // ---------- Load player & start engine ----------
  useEffect(() => {
    const s = getSession();
    if (!s) { router.replace("/"); return; }
    let engine: GameEngine | null = null;
    let cancelled = false;
    (async () => {
      const r = await api.get<PlayerRecord>(`/api/player/${s.id}`);
      if (cancelled) return;
      if (!r.ok || !r.data) {
        console.error("[Game] could not load player", r.error);
        setError("No se pudo cargar tu personaje. Vuelve a iniciar sesión.");
        return;
      }
      if (!r.data.race || !r.data.class_name) { router.replace("/create"); return; }
      setPlayer(r.data);
      if (!mountRef.current || !overlayRef.current) {
        setError("Error: No se pudo inicializar el contenedor del juego.");
        return;
      }
      engine = new GameEngine(mountRef.current, overlayRef.current, r.data, {
        onSnapshot: (sn) => setSnap(sn),
        onLog: (m, c) => pushLog(m, c),
        onZone: (z) => {
          setZoneTitle({ zone: z, key: Date.now() });
          pushLog(`Entras en ${ZONES[z].name}.`, "#ffd100");
        },
        onSave: async (data) => {
          setSaving(true);
          const res = await api.put(`/api/player/${s.id}`, data);
          if (!res.ok) console.error("[Game] save failed", res.error);
          setSaving(false);
        },
        onReady: () => {
          setLoading(null);
          setMapUrl(engine!.getMapDataURL());
          pushLog(`¡Bienvenido a Fantasy Realms, ${r.data!.username}!`, "#ffd100");
          pushLog("WASD para moverte, ratón para girar la cámara, TAB para seleccionar enemigos y 1-5 para tus habilidades.", "#9fd8ff");
          if (!localStorage.getItem("fr_help_seen")) {
            setWin((w) => ({ ...w, help: true }));
            localStorage.setItem("fr_help_seen", "1");
          }
        },
        onProgress: (msg, pct) => setLoading({ msg, pct }),
      });
      engineRef.current = engine;
      engine.setMinimap(minimapRef.current);
      try {
        await engine.init();
      } catch (e) {
        if ((e as Error).message !== "disposed") {
          console.error("[Game] engine init failed", e);
          setError("Tu navegador no pudo iniciar WebGL. Prueba con Chrome, Edge o Firefox actualizados.");
        }
      }
    })();
    return () => {
      cancelled = true;
      engine?.dispose();
      engineRef.current = null;
    };
  }, [router, pushLog]);

  // ---------- Window hotkeys ----------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === "i" || k === "b") setWin((w) => ({ ...w, inv: !w.inv }));
      if (k === "c") setWin((w) => ({ ...w, char: !w.char }));
      if (k === "m") setWin((w) => ({ ...w, map: !w.map }));
      if (k === "h") setWin((w) => ({ ...w, help: !w.help }));
      if (k === "escape") { setWin({ inv: false, char: false, map: false, help: false }); setTip(null); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const hasSnap = !!snap;
  useEffect(() => {
    engineRef.current?.setMinimap(minimapRef.current);
  }, [hasSnap]);

  useEffect(() => {
    if (snap?.vendor !== null && snap?.vendor !== undefined) setWin((w) => (w.inv ? w : { ...w, inv: true }));
  }, [snap?.vendor]);

  const eng = engineRef.current;
  const race = RACES.find((r) => r.id === player?.race);
  const cls = CLASSES.find((c) => c.id === player?.class_name);
  const zone = snap ? ZONES[snap.zone] : null;

  const exit = () => {
    engineRef.current?.saveNow();
    setTimeout(() => router.push("/"), 400);
  };

  const showTip = (e: React.MouseEvent, id: string, hint?: string, price?: number) => setTip({ id, x: e.clientX, y: e.clientY, hint, price });

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black p-6">
        <div className="wow-frame max-w-md rounded-lg p-6 text-center">
          <p className="font-display text-xl text-red-300">{error}</p>
          <button onClick={() => router.push("/")} className="mt-4 rounded bg-amber-600 px-5 py-2 font-display text-black">Volver</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 select-none overflow-hidden bg-black font-sans">
      <div ref={mountRef} className="absolute inset-0" />
      <div ref={overlayRef} className="pointer-events-none absolute inset-0 overflow-hidden" />

      {/* Loading */}
      {loading && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[radial-gradient(ellipse_at_center,#1a2a30,#020304)]">
          <h1 className="font-display text-5xl font-black text-gold-gradient md:text-7xl">FANTASY REALMS</h1>
          <p className="mt-6 font-display tracking-widest text-amber-200/80">{loading.msg}</p>
          <div className="mt-4 h-4 w-[min(520px,80vw)] overflow-hidden rounded border border-amber-700/70 bg-black p-0.5">
            <div className="h-full rounded-sm bg-gradient-to-r from-amber-700 via-amber-400 to-amber-200 transition-all duration-300" style={{ width: `${loading.pct}%` }} />
          </div>
          <p className="mt-8 max-w-md text-center text-sm italic text-stone-400">Consejo: los enemigos con nombre amarillo son de tu nivel; los rojos son muy peligrosos.</p>
        </div>
      )}

      {snap && cls && race && (
        <>
          {/* Player frame */}
          <div className="absolute left-3 top-3 z-20 flex items-start gap-2">
            <div className="relative">
              <div className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-amber-600 bg-[radial-gradient(circle_at_40%_35%,#3a2f20,#0a0805)] text-4xl shadow-[0_0_14px_rgba(0,0,0,0.9)]">
                {RACE_EMBLEM[race.id]}
              </div>
              <span className="absolute -bottom-1 -left-1 flex h-8 w-8 items-center justify-center rounded-full border-2 border-amber-600 bg-black font-display text-sm font-bold text-amber-200">{snap.level}</span>
              {snap.inCombat && <span className="absolute -right-1 -top-1 text-lg">⚔️</span>}
            </div>
            <div className="wow-frame mt-2 w-60 rounded p-1.5">
              <p className="px-1 font-display text-sm font-bold" style={{ color: cls.color }}>{snap.name}</p>
              <Bar value={snap.hp} max={snap.maxHp} from="#3ddc4a" to="#11741b" label={`${Math.round(snap.hp)} / ${snap.maxHp}`} />
              <div className="mt-0.5" />
              <Bar value={snap.res} max={snap.maxRes} from={cls.resourceColor} to="#0a0a20" label={`${Math.round(snap.res)} / ${snap.maxRes}`} h="h-3.5" />
            </div>
            {/* Target frame */}
            {snap.target && (
              <div className={`wow-frame mt-2 w-60 rounded p-1.5 ${snap.target.elite ? "ring-2 ring-amber-500/70" : ""}`}>
                <div className="flex items-center justify-between px-1">
                  <p className="font-display text-sm font-bold text-red-300">{snap.target.elite && "☠ "}{snap.target.name}</p>
                  <span className="font-display text-xs text-amber-200">{snap.target.elite ? "Élite " : ""}Nv {snap.target.level}</span>
                </div>
                <Bar value={snap.target.hp} max={snap.target.maxHp} from="#e33" to="#6a0a0a" label={snap.target.dead ? "Muerto" : `${Math.round((snap.target.hp / snap.target.maxHp) * 100)}%`} />
              </div>
            )}
          </div>
          {/* Buffs */}
          <div className="absolute left-28 top-[86px] z-20 flex gap-1">
            {snap.buffs.map((b) => (
              <div key={b.id} className="wow-slot relative flex h-9 w-9 items-center justify-center rounded text-lg" title={b.name}>
                {b.icon}
                <span className="absolute -bottom-3.5 text-[10px] text-amber-100">{Math.ceil(b.remaining)}s</span>
              </div>
            ))}
          </div>

          {/* Minimap */}
          <div className="absolute right-3 top-2 z-20 flex flex-col items-center">
            <div className="wow-frame mb-1 rounded px-4 py-0.5 font-display text-sm text-amber-200">{zone?.name}</div>
            <div className="relative rounded-full border-[3px] border-[#8a6a30] shadow-[0_0_0_2px_#000,0_6px_20px_#000]">
              <canvas ref={minimapRef} width={190} height={190} className="block rounded-full" />
              <span className="absolute left-1/2 top-0.5 -translate-x-1/2 font-display text-xs font-bold text-amber-200 [text-shadow:0_0_3px_#000]">N</span>
              <button onClick={() => setWin((w) => ({ ...w, map: true }))} className="pointer-events-auto absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full border-2 border-[#8a6a30] bg-black text-amber-200 hover:text-white" title="Mapa (M)">
                <MapIcon className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-1 font-mono text-[11px] text-stone-300 [text-shadow:0_1px_2px_#000]">{Math.round(snap.pos[0])}, {Math.round(snap.pos[1])}</p>
          </div>

          {/* Objectives */}
          <div className="absolute right-3 top-[260px] z-10 w-72 [text-shadow:0_1px_2px_#000,0_0_6px_#000]">
            <p className="font-display text-base text-amber-300">Objetivos</p>
            {snap.objectives.filter((o) => o.zone === snap.zone).map((o) => (
              <div key={o.key} className="mt-1.5">
                <p className={`font-display text-sm ${o.done ? "text-stone-400 line-through" : "text-amber-200"}`}>{o.done ? "✔" : "◆"} {o.name}</p>
                <p className="pl-4 text-xs text-stone-200">- {o.count}/{o.need} {o.need === 1 ? "derrotado" : "eliminados"}</p>
              </div>
            ))}
          </div>

          {/* Zone title */}
          {zoneTitle && (
            <div key={zoneTitle.key} className="zone-title pointer-events-none absolute left-1/2 top-[22%] z-30 -translate-x-1/2 text-center">
              <p className="font-display text-5xl font-black text-gold-gradient drop-shadow-[0_3px_6px_#000]">{ZONES[zoneTitle.zone].name}</p>
              <p className="mt-2 font-display text-lg italic text-amber-100/90 [text-shadow:0_2px_4px_#000]">{ZONES[zoneTitle.zone].subtitle} · Niveles {ZONES[zoneTitle.zone].levels}</p>
            </div>
          )}

          {/* Interaction hint */}
          {snap.interactHint && !snap.loot && snap.vendor === null && (
            <div className="absolute bottom-48 left-1/2 z-20 -translate-x-1/2 rounded border border-amber-500/60 bg-black/70 px-4 py-1.5 font-display text-sm text-amber-200">{snap.interactHint}</div>
          )}

          {/* Combat log */}
          <div className="absolute bottom-16 left-3 z-10 w-[380px]">
            <div className="mb-0.5 flex gap-1">
              <span className="rounded-t border border-b-0 border-amber-800/60 bg-black/60 px-3 py-0.5 font-display text-[11px] text-amber-300">General</span>
              <span className="rounded-t px-3 py-0.5 font-display text-[11px] text-stone-500">Registro de combate</span>
            </div>
            <div className="flex h-40 flex-col justify-end overflow-hidden rounded-b rounded-tr bg-black/45 p-2 text-[13px] leading-snug">
              {log.slice(-9).map((l) => (
                <p key={l.id} style={{ color: l.color }} className="[text-shadow:0_1px_1px_#000]">{l.msg}</p>
              ))}
            </div>
          </div>

          {/* Bottom bars */}
          <div className="absolute bottom-2 left-1/2 z-20 flex -translate-x-1/2 flex-col items-center">
            {snap.cast && (
              <div className="mb-3 w-72">
                <Bar value={snap.cast.progress} max={1} from="#ffd84a" to="#a8701c" label={snap.cast.name} h="h-5" />
              </div>
            )}
            <div className="wow-frame flex items-end gap-1 rounded-t-lg px-3 pb-2 pt-2">
              {cls.abilities.map((a, i) => {
                const cd = snap.cooldowns[i];
                const noRes = snap.res < a.cost;
                return (
                  <button
                    key={a.id}
                    onClick={() => eng?.useAbility(i)}
                    className={`wow-slot group pointer-events-auto relative flex h-14 w-14 items-center justify-center rounded text-3xl transition hover:border-amber-400 ${noRes ? "opacity-50 grayscale" : ""}`}
                    title={`${a.name} — ${a.desc} (Coste ${a.cost}, ${a.cooldown}s)`}
                  >
                    <span style={{ filter: `drop-shadow(0 0 6px ${a.color})` }}>{a.icon}</span>
                    <CooldownOverlay remaining={Math.max(cd.remaining, snap.gcd)} total={cd.remaining > snap.gcd ? cd.total : 1} />
                    <span className="absolute left-1 top-0.5 font-display text-xs font-bold text-white [text-shadow:0_0_3px_#000]">{i + 1}</span>
                  </button>
                );
              })}
              <span className="mx-1 h-12 w-px bg-amber-800/60" />
              {[0, 1, 2, 3].map((i) => {
                const q = snap.quick[i];
                return (
                  <button
                    key={i}
                    onClick={() => eng?.useQuick(i)}
                    onMouseMove={(e) => q && showTip(e, q.id)}
                    onMouseLeave={() => setTip(null)}
                    className="wow-slot pointer-events-auto relative flex h-12 w-12 items-center justify-center rounded text-2xl hover:border-amber-400"
                  >
                    {q ? ITEMS[q.id].icon : ""}
                    {q && <span className="absolute bottom-0 right-1 text-xs font-bold text-white [text-shadow:0_0_3px_#000]">{q.qty}</span>}
                    <span className="absolute left-1 top-0.5 font-display text-[10px] text-stone-300">{i + 6}</span>
                  </button>
                );
              })}
              <span className="mx-1 h-12 w-px bg-amber-800/60" />
              <div className="flex gap-1 pb-1">
                {[
                  { k: "char", icon: User, t: "Personaje (C)" },
                  { k: "inv", icon: Backpack, t: "Inventario (B)" },
                  { k: "map", icon: MapIcon, t: "Mapa (M)" },
                  { k: "help", icon: HelpCircle, t: "Ayuda (H)" },
                ].map((b) => (
                  <button
                    key={b.k}
                    title={b.t}
                    onClick={() => setWin((w) => ({ ...w, [b.k]: !w[b.k as keyof typeof w] }))}
                    className="wow-slot flex h-9 w-9 items-center justify-center rounded text-amber-200 hover:border-amber-400 hover:text-white"
                  >
                    <b.icon className="h-4 w-4" />
                  </button>
                ))}
                <button title="Guardar y salir" onClick={exit} className="wow-slot flex h-9 w-9 items-center justify-center rounded text-red-300 hover:border-red-400 hover:text-white">
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="w-full">
              <div className="relative h-3.5 w-full border border-black bg-black/80">
                <div className="absolute inset-y-0 left-0 bg-gradient-to-b from-[#c04ad8] to-[#5a1a6a]" style={{ width: `${(snap.xp / snap.xpNext) * 100}%` }} />
                {Array.from({ length: 19 }).map((_, i) => <span key={i} className="absolute inset-y-0 w-px bg-black/60" style={{ left: `${((i + 1) / 20) * 100}%` }} />)}
                <span className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold text-white [text-shadow:0_1px_1px_#000]">PE {Math.round(snap.xp)} / {snap.xpNext}</span>
              </div>
            </div>
          </div>

          {saving && <div className="absolute bottom-24 right-4 z-20 font-display text-xs text-amber-300/70">Guardando…</div>}

          {/* Loot window */}
          {snap.loot && (
            <div className="wow-frame absolute left-[30%] top-[30%] z-40 w-64 rounded-lg p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="font-display text-amber-200">{snap.loot.name}</p>
                <button onClick={() => eng?.closeLoot()} className="text-stone-400 hover:text-white"><X className="h-4 w-4" /></button>
              </div>
              {snap.loot.gold > 0 && <div className="mb-1 flex items-center gap-2 rounded bg-black/40 p-1.5 text-amber-300"><span className="wow-slot flex h-9 w-9 items-center justify-center rounded text-xl">🪙</span>{snap.loot.gold} de oro</div>}
              {snap.loot.items.map((it, i) => {
                const d = ITEMS[it.id];
                return (
                  <button key={i} onClick={() => eng?.lootItem(i)} onMouseMove={(e) => showTip(e, it.id, "Clic para recoger")} onMouseLeave={() => setTip(null)} className="mb-1 flex w-full items-center gap-2 rounded bg-black/40 p-1.5 text-left hover:bg-white/5">
                    <span className="wow-slot flex h-9 w-9 items-center justify-center rounded text-xl" style={{ borderColor: RARITY_COLOR[d.rarity] }}>{d.icon}</span>
                    <span className="font-display text-sm" style={{ color: RARITY_COLOR[d.rarity] }}>{d.name}</span>
                  </button>
                );
              })}
              {snap.loot.items.length === 0 && snap.loot.gold === 0 && <p className="text-sm text-stone-500">Vacío</p>}
              <button onClick={() => { eng?.lootAll(); setTip(null); }} className="mt-2 w-full rounded bg-gradient-to-b from-amber-500 to-amber-700 py-1.5 font-display text-sm font-bold text-black hover:brightness-110">Recoger todo</button>
            </div>
          )}

          {/* Vendor */}
          {snap.vendor !== null && (
            <div className="wow-frame absolute left-4 top-28 z-40 w-80 rounded-lg p-3">
              <div className="mb-1 flex items-center justify-between">
                <p className="font-display text-lg text-amber-200">Mercader Aldric</p>
                <button onClick={() => eng?.closeVendor()} className="text-stone-400 hover:text-white"><X className="h-4 w-4" /></button>
              </div>
              <p className="mb-3 text-xs italic text-stone-400">&quot;¡Pociones frescas y buen acero, aventurero!&quot; — Clic derecho en tu inventario para vender.</p>
              <div className="grid grid-cols-1 gap-1">
                {ZONES[snap.vendor].vendorItems.map((id) => {
                  const d = ITEMS[id];
                  const price = d.value * 4;
                  return (
                    <button key={id} onClick={() => eng?.buy(id)} onMouseMove={(e) => showTip(e, id, "Clic para comprar", price)} onMouseLeave={() => setTip(null)} className={`flex items-center gap-2 rounded bg-black/40 p-1.5 text-left hover:bg-white/5 ${snap.gold < price ? "opacity-50" : ""}`}>
                      <span className="wow-slot flex h-9 w-9 items-center justify-center rounded text-xl">{d.icon}</span>
                      <span className="flex-1 font-display text-sm" style={{ color: RARITY_COLOR[d.rarity] }}>{d.name}</span>
                      <span className="text-sm text-amber-300">{price} 🪙</span>
                    </button>
                  );
                })}
              </div>
              <button onClick={() => eng?.sellJunk()} className="mt-3 w-full rounded border border-amber-700 py-1.5 font-display text-sm text-amber-200 hover:bg-amber-500/10">Vender toda la chatarra</button>
            </div>
          )}

          {/* Inventory */}
          {win.inv && (
            <div className="wow-frame absolute bottom-28 right-4 z-40 w-[330px] rounded-lg p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="flex items-center gap-2 font-display text-amber-200"><Backpack className="h-4 w-4" /> Bolsas</p>
                <button onClick={() => setWin((w) => ({ ...w, inv: false }))} className="text-stone-400 hover:text-white"><X className="h-4 w-4" /></button>
              </div>
              <div className="grid grid-cols-8 gap-1">
                {snap.inventory.map((s, i) => {
                  const d = s ? ITEMS[s.id] : null;
                  const hint = !d ? undefined : snap.vendor !== null ? "Clic derecho: vender" : d.type === "consumable" ? "Clic: usar" : d.type === "junk" ? "Véndelo a un mercader" : "Clic: equipar";
                  return (
                    <button
                      key={i}
                      onClick={() => { if (s) { eng?.useItem(i); setTip(null); } }}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        if (!s) return;
                        if (snap.vendor !== null) eng?.sell(i);
                        else eng?.useItem(i);
                        setTip(null);
                      }}
                      onMouseMove={(e) => d && showTip(e, d.id, hint)}
                      onMouseLeave={() => setTip(null)}
                      className="wow-slot relative flex aspect-square items-center justify-center rounded text-xl hover:brightness-125"
                      style={d ? { borderColor: RARITY_COLOR[d.rarity] + "aa", boxShadow: d.rarity !== "common" ? `inset 0 0 8px ${RARITY_COLOR[d.rarity]}66` : undefined } : undefined}
                    >
                      {d?.icon}
                      {s && s.qty > 1 && <span className="absolute bottom-0 right-0.5 text-[10px] font-bold text-white [text-shadow:0_0_2px_#000]">{s.qty}</span>}
                    </button>
                  );
                })}
              </div>
              <div className="mt-3 flex items-center justify-between text-sm">
                <span className="text-stone-400">{snap.inventory.filter(Boolean).length}/{snap.inventory.length} huecos</span>
                <span className="font-display text-amber-300">{snap.gold} 🪙</span>
              </div>
            </div>
          )}

          {/* Character */}
          {win.char && (
            <div className="wow-frame absolute left-4 top-28 z-40 w-[360px] rounded-lg p-4">
              <div className="mb-2 flex items-center justify-between">
                <div>
                  <p className="font-display text-lg" style={{ color: cls.color }}>{snap.name}</p>
                  <p className="text-xs text-stone-400">Nivel {snap.level} · {race.name} {cls.name}</p>
                </div>
                <button onClick={() => setWin((w) => ({ ...w, char: false }))} className="text-stone-400 hover:text-white"><X className="h-4 w-4" /></button>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {EQUIP_SLOTS.map((e) => {
                  const id = snap.equipment[e.slot];
                  const d = id ? ITEMS[id] : null;
                  return (
                    <button
                      key={e.slot}
                      onClick={() => { if (id) { eng?.unequip(e.slot); setTip(null); } }}
                      onMouseMove={(ev) => d && showTip(ev, d.id, "Clic: desequipar")}
                      onMouseLeave={() => setTip(null)}
                      className="flex items-center gap-2 rounded bg-black/40 p-1.5 text-left hover:bg-white/5"
                    >
                      <span className="wow-slot flex h-10 w-10 items-center justify-center rounded text-xl" style={d ? { borderColor: RARITY_COLOR[d.rarity] } : { opacity: 0.4 }}>{d ? d.icon : e.icon}</span>
                      <span className="min-w-0">
                        <span className="block text-[10px] uppercase tracking-wider text-stone-500">{e.label}</span>
                        <span className="block truncate font-display text-xs" style={{ color: d ? RARITY_COLOR[d.rarity] : "#666" }}>{d ? d.name : "Vacío"}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1 rounded border border-stone-800 bg-black/40 p-3 text-sm">
                {[
                  ["Fuerza", snap.stats.str], ["Agilidad", snap.stats.agi], ["Intelecto", snap.stats.int], ["Aguante", snap.stats.sta],
                  ["Armadura", snap.stats.armor], ["Poder de ataque", Math.round(snap.stats.attack)],
                  ["Mitigación", `${Math.round(snap.stats.mitigation * 100)}%`], ["Enemigos derrotados", snap.kills],
                ].map(([k, v]) => (
                  <div key={k as string} className="flex justify-between"><span className="text-stone-400">{k}</span><span className="text-white">{v}</span></div>
                ))}
              </div>
            </div>
          )}

          {/* World map */}
          {win.map && (
            <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/70" onClick={() => setWin((w) => ({ ...w, map: false }))}>
              <div className="wow-frame w-[min(1200px,94vw)] rounded-lg p-4" onClick={(e) => e.stopPropagation()}>
                <div className="mb-3 flex items-center justify-between">
                  <p className="flex items-center gap-2 font-display text-xl text-amber-200"><MapIcon className="h-5 w-5" /> Mapa del mundo</p>
                  <button onClick={() => setWin((w) => ({ ...w, map: false }))} className="text-stone-400 hover:text-white"><X className="h-5 w-5" /></button>
                </div>
                <div className="relative w-full overflow-hidden rounded border border-amber-900/60" style={{ aspectRatio: "3 / 1" }}>
                  {mapUrl && <img src={mapUrl} alt="Mapa" className="absolute inset-0 h-full w-full" />}
                  {ZONES.map((z) => (
                    <div key={z.id} className="absolute top-3 text-center" style={{ left: `${((z.x0 + z.x1) / 2 + 1200) / 24}%`, transform: "translateX(-50%)" }}>
                      <p className="font-display text-lg font-bold text-amber-100 [text-shadow:0_2px_4px_#000]">{z.name}</p>
                      <p className="text-xs text-amber-300 [text-shadow:0_1px_2px_#000]">Niveles {z.levels}</p>
                    </div>
                  ))}
                  {ZONES.map((z) => (
                    <span key={`v${z.id}`} className="absolute -translate-x-1/2 -translate-y-1/2 text-lg" style={{ left: `${(z.spawn[0] + 1200) / 24}%`, top: `${(z.spawn[1] + 400) / 8}%` }} title="Aldea">🏰</span>
                  ))}
                  <span className="absolute -translate-x-1/2 -translate-y-1/2 text-xl" style={{ left: `${(-1060 + 1200) / 24}%`, top: `${(250 + 400) / 8}%` }} title="Jefe">☠️</span>
                  <span className="absolute -translate-x-1/2 -translate-y-1/2 text-xl" style={{ left: `${(260 + 1200) / 24}%`, top: `${(220 + 400) / 8}%` }} title="Jefe">☠️</span>
                  <span className="absolute -translate-x-1/2 -translate-y-1/2 text-xl" style={{ left: `${(930 + 1200) / 24}%`, top: `${(-120 + 400) / 8}%` }} title="Jefe">☠️</span>
                  <span
                    className="absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-amber-400 shadow-[0_0_12px_4px_rgba(251,191,36,0.8)]"
                    style={{ left: `${(snap.pos[0] + 1200) / 24}%`, top: `${(snap.pos[1] + 400) / 8}%` }}
                  />
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="text-sm text-stone-400">Viaje rápido a la aldea:</span>
                  {ZONES.map((z) => (
                    <button key={z.id} onClick={() => { eng?.teleportToZone(z.id); setWin((w) => ({ ...w, map: false })); }} className="rounded border border-amber-700/70 px-3 py-1 font-display text-sm text-amber-200 hover:bg-amber-500/10">
                      {z.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Help */}
          {win.help && (
            <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/60" onClick={() => setWin((w) => ({ ...w, help: false }))}>
              <div className="wow-frame w-[min(620px,92vw)] rounded-lg p-6" onClick={(e) => e.stopPropagation()}>
                <p className="flex items-center gap-2 font-display text-2xl text-amber-200"><BookOpen className="h-6 w-6" /> Guía del aventurero</p>
                <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                  {[
                    ["W A S D", "Moverse"], ["Espacio", "Saltar"], ["Arrastrar ratón", "Girar cámara"], ["Rueda", "Zoom"],
                    ["Clic / TAB", "Seleccionar enemigo"], ["Clic derecho", "Atacar objetivo"], ["1 - 5", "Habilidades"], ["6 - 9", "Consumibles"],
                    ["F", "Saquear / comerciar"], ["B / I", "Inventario"], ["C", "Personaje"], ["M", "Mapa"],
                  ].map(([k, v]) => (
                    <div key={k} className="flex items-center justify-between border-b border-stone-800 py-1">
                      <span className="rounded border border-amber-700/60 bg-black/50 px-2 py-0.5 font-display text-xs text-amber-200">{k}</span>
                      <span className="text-stone-300">{v}</span>
                    </div>
                  ))}
                </div>
                <p className="mt-4 text-sm italic text-stone-400">Derrota criaturas para ganar experiencia, oro y botín. Equipa el mejor equipo, vende la chatarra al mercader de cada aldea y enfréntate a los jefes de élite de cada reino.</p>
                <button onClick={() => setWin((w) => ({ ...w, help: false }))} className="mt-5 w-full rounded bg-gradient-to-b from-amber-500 to-amber-700 py-2 font-display font-bold text-black">¡A la aventura!</button>
              </div>
            </div>
          )}

          {/* Death */}
          {snap.dead && (
            <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-[radial-gradient(ellipse_at_center,rgba(80,0,0,0.25),rgba(0,0,0,0.75))] backdrop-grayscale">
              <Skull className="h-16 w-16 text-stone-300" />
              <p className="mt-3 font-display text-5xl font-black text-red-200">HAS MUERTO</p>
              <button onClick={() => eng?.releaseSpirit()} className="mt-6 rounded bg-gradient-to-b from-stone-300 to-stone-500 px-8 py-3 font-display font-bold tracking-widest text-black hover:brightness-110">LIBERAR ESPÍRITU</button>
            </div>
          )}
        </>
      )}

      {tip && <ItemTooltip {...tip} />}
    </div>
  );
}
