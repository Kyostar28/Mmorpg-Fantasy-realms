"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { ArrowLeft, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { CLASSES, RACES, ZONES, type ClassId, type PlayerRecord, type RaceId } from "@/lib/game/data";
import { getSession, type LocalSession } from "@/lib/game/session";

const CharacterPreview = dynamic(() => import("@/components/game/CharacterPreview").then((m) => m.CharacterPreview), { ssr: false });

const RACE_EMBLEM: Record<RaceId, string> = { human: "🦁", elf: "🌙", orc: "🪓", undead: "💀", tauren: "🐂" };

export default function CreatePage() {
  const router = useRouter();
  const [session, setSess] = useState<LocalSession | null>(null);
  const [step, setStep] = useState<1 | 2>(1);
  const [race, setRace] = useState<RaceId>("human");
  const [cls, setCls] = useState<ClassId>("warrior");
  const [graphics, setGraphics] = useState<"low" | "normal" | "high">("normal");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const s = getSession();
    if (!s) { router.replace("/"); return; }
    setSess(s);
  }, [router]);

  const r = RACES.find((x) => x.id === race)!;
  const c = CLASSES.find((x) => x.id === cls)!;

  const create = async () => {
    if (!session) return;
    setSaving(true);
    setError(null);
    const zone = ZONES[r.startZone];
    console.log("[Create] saving character", race, cls, graphics);
    const res = await api.put<PlayerRecord>(`/api/player/${session.id}`, {
      race, class_name: cls, level: 1, xp: 0, gold: 10, zone: zone.name, pos_x: zone.spawn[0], pos_z: zone.spawn[1] + 8, graphics,
    });
    if (!res.ok) {
      setError(typeof res.error === "string" ? res.error : "No se pudo crear el personaje.");
      setSaving(false);
      return;
    }
    router.push("/play");
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#06080b] text-stone-200">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_40%,#2a1f10_0%,transparent_60%)]" />
      <div className="relative z-10 grid min-h-screen grid-cols-1 lg:grid-cols-[380px_1fr_380px]">
        {/* Left: selection */}
        <aside className="wow-frame m-4 flex flex-col rounded-lg p-5">
          <button onClick={() => (step === 2 ? setStep(1) : router.push("/"))} className="mb-4 flex items-center gap-2 text-sm text-stone-400 hover:text-amber-200">
            <ArrowLeft className="h-4 w-4" /> {step === 2 ? "Volver a razas" : "Salir"}
          </button>
          <p className="font-display text-xs tracking-[0.4em] text-amber-400/80">PASO {step} DE 2</p>
          <h1 className="mt-1 font-display text-2xl text-amber-100">{step === 1 ? "Elige tu raza" : "Elige tu clase"}</h1>
          <div className="mt-5 flex flex-col gap-2">
            {step === 1
              ? RACES.map((x) => (
                  <button
                    key={x.id}
                    onClick={() => setRace(x.id)}
                    className={`flex items-center gap-3 rounded border px-3 py-3 text-left transition ${race === x.id ? "border-amber-400 bg-amber-500/10 shadow-[0_0_20px_rgba(245,158,11,0.2)]" : "border-stone-800 bg-black/30 hover:border-stone-600"}`}
                  >
                    <span className="wow-slot flex h-11 w-11 items-center justify-center rounded text-2xl">{RACE_EMBLEM[x.id]}</span>
                    <span className="flex-1">
                      <span className="block font-display text-lg text-amber-50">{x.name}</span>
                      <span className={`text-xs ${x.faction === "Alianza" ? "text-sky-300" : "text-red-300"}`}>{x.faction}</span>
                    </span>
                  </button>
                ))
              : CLASSES.map((x) => (
                  <button
                    key={x.id}
                    onClick={() => setCls(x.id)}
                    className={`flex items-center gap-3 rounded border px-3 py-2.5 text-left transition ${cls === x.id ? "border-amber-400 bg-amber-500/10 shadow-[0_0_20px_rgba(245,158,11,0.2)]" : "border-stone-800 bg-black/30 hover:border-stone-600"}`}
                  >
                    <span className="wow-slot flex h-10 w-10 items-center justify-center rounded text-xl">{x.abilities[0].icon}</span>
                    <span className="flex-1">
                      <span className="block font-display text-lg" style={{ color: x.color }}>{x.name}</span>
                      <span className="text-xs text-stone-400">{x.role}</span>
                    </span>
                  </button>
                ))}
          </div>
        </aside>

        {/* Center: 3D preview */}
        <section className="relative flex min-h-[420px] flex-col items-center justify-end">
          <div className="absolute inset-0">
            <CharacterPreview race={race} cls={cls} />
          </div>
          <div className="relative z-10 mb-24 text-center">
            <p className="font-display text-sm tracking-[0.4em] text-amber-400/80">{session?.username?.toUpperCase()}</p>
            <h2 className="font-display text-4xl text-amber-50 drop-shadow-lg">
              {r.name} <span style={{ color: c.color }}>{c.name}</span>
            </h2>
          </div>
        </section>

        {/* Right: details */}
        <aside className="wow-frame m-4 flex flex-col rounded-lg p-5">
          {step === 1 ? (
            <>
              <h3 className="font-display text-xl text-amber-100">{r.name}</h3>
              <p className={`text-sm ${r.faction === "Alianza" ? "text-sky-300" : "text-red-300"}`}>{r.faction}</p>
              <p className="mt-4 italic leading-relaxed text-stone-300">{r.lore}</p>
              <div className="mt-5 rounded border border-stone-800 bg-black/40 p-3 text-sm">
                <p className="font-display text-xs tracking-widest text-amber-400/80">BONIFICACIÓN RACIAL</p>
                <p className="mt-1 text-emerald-300">
                  {Object.entries(r.bonus).map(([k, v]) => `+${v} ${({ str: "Fuerza", agi: "Agilidad", int: "Intelecto", sta: "Aguante" } as Record<string, string>)[k] ?? k}`).join(" · ")}
                </p>
                <p className="mt-3 font-display text-xs tracking-widest text-amber-400/80">ZONA INICIAL</p>
                <p className="mt-1 text-stone-200">{ZONES[r.startZone].name}</p>
              </div>
              <button onClick={() => setStep(2)} className="mt-auto rounded bg-gradient-to-b from-amber-500 to-amber-700 px-6 py-3 font-display text-lg font-bold tracking-widest text-black transition hover:brightness-110">
                SIGUIENTE
              </button>
            </>
          ) : (
            <>
              <h3 className="font-display text-xl" style={{ color: c.color }}>{c.name}</h3>
              <p className="text-sm text-stone-400">{c.role} · Recurso: <span style={{ color: c.resourceColor }}>{c.resource}</span></p>
              <p className="mt-3 italic leading-relaxed text-stone-300">{c.desc}</p>
              <p className="mt-4 font-display text-xs tracking-widest text-amber-400/80">HABILIDADES</p>
              <div className="mt-2 flex flex-col gap-1.5 overflow-y-auto">
                {c.abilities.map((a, i) => (
                  <div key={a.id} className="flex items-start gap-2 rounded border border-stone-800 bg-black/40 p-2">
                    <span className="wow-slot relative flex h-9 w-9 shrink-0 items-center justify-center rounded text-lg">
                      {a.icon}
                      <span className="absolute -right-1 -top-1 text-[10px] text-amber-300">{i + 1}</span>
                    </span>
                    <span>
                      <span className="block font-display text-sm text-amber-50">{a.name}</span>
                      <span className="block text-xs text-stone-400">{a.desc}</span>
                    </span>
                  </div>
                ))}
              </div>
              <p className="mt-4 font-display text-xs tracking-widest text-amber-400/80">CALIDAD GRÁFICA</p>
              <div className="mt-2 flex gap-2">
                {(["low", "normal", "high"] as const).map((g) => (
                  <button
                    key={g}
                    onClick={() => setGraphics(g)}
                    className={`flex-1 rounded border px-3 py-2 text-sm font-display transition ${
                      graphics === g
                        ? "border-amber-400 bg-amber-500/10 text-amber-100 shadow-[0_0_15px_rgba(245,158,11,0.15)]"
                        : "border-stone-800 bg-black/30 text-stone-400 hover:border-stone-600 hover:text-stone-200"
                    }`}
                  >
                    {g === "low" ? "Bajo" : g === "normal" ? "Normal" : "Alto"}
                  </button>
                ))}
              </div>
              <p className="mt-1 text-xs text-stone-500">
                {graphics === "low" ? "-70% rendimiento: ideal para dispositivos antiguos" : graphics === "normal" ? "Equilibrado: calidad y rendimiento" : "Máxima calidad: requiere GPU potente"}
              </p>
              {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
              <button onClick={create} disabled={saving} className="mt-4 flex items-center justify-center gap-2 rounded bg-gradient-to-b from-[#b81d1d] to-[#5e0b0b] px-6 py-3.5 font-display text-lg font-bold tracking-widest text-amber-100 shadow-[0_0_25px_rgba(184,29,29,0.35)] transition hover:brightness-125 disabled:opacity-60">
                {saving && <Loader2 className="h-5 w-5 animate-spin" />} CREAR Y JUGAR
              </button>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
