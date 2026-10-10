"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Swords, Trees, Mountain, Flame, Crown } from "lucide-react";
import { api } from "@/lib/api";
import { CLASSES, RACES, ZONES, type PlayerRecord } from "@/lib/game/data";
import { getSession, setSession, clearSession, type LocalSession } from "@/lib/game/session";

const ZONE_ICONS = [Trees, Mountain, Flame];
const ZONE_BG = [
  "radial-gradient(circle at 30% 20%, #2f8f8a55, transparent 60%), linear-gradient(160deg, #0b2a30, #06151a)",
  "radial-gradient(circle at 70% 20%, #f3d38a55, transparent 60%), linear-gradient(160deg, #3d5a26, #172410)",
  "radial-gradient(circle at 50% 90%, #ff5a0066, transparent 60%), linear-gradient(160deg, #3a160c, #120605)",
];

export default function Home() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [session, setSess] = useState<LocalSession | null>(null);
  const [top, setTop] = useState<PlayerRecord[]>([]);

  useEffect(() => {
    setSess(getSession());
    api.get<PlayerRecord[]>("/api/players/top").then((r) => {
      if (r.ok && r.data) setTop(r.data);
      else console.error("[Home] leaderboard error", r.error);
    });
  }, []);

  const enter = async (name: string) => {
    setLoading(true);
    setError(null);
    console.log("[Home] login", name);
    const r = await api.post<PlayerRecord>("/api/player/login", { username: name });
    if (!r.ok || !r.data) {
      setError(typeof r.error === "string" ? r.error : "No se pudo entrar al reino.");
      setLoading(false);
      return;
    }
    setSession({ id: r.data._id, username: r.data.username });
    router.push(r.data.race && r.data.class_name ? "/play" : "/create");
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#05070a] text-stone-200">
      {/* Atmospheric background */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_-10%,#1c4b5a_0%,transparent_55%),radial-gradient(ellipse_at_80%_110%,#5a1e0a_0%,transparent_50%),radial-gradient(ellipse_at_10%_100%,#123a2a_0%,transparent_50%)]" />
        <svg className="absolute bottom-0 left-0 w-full opacity-90" viewBox="0 0 1440 420" preserveAspectRatio="none" style={{ height: "55vh" }}>
          <path d="M0 300 L120 190 L210 260 L330 120 L450 240 L560 160 L700 280 L820 110 L960 250 L1080 150 L1200 260 L1320 170 L1440 240 L1440 420 L0 420Z" fill="#0b1418" />
          <path d="M0 350 L150 270 L260 330 L400 230 L520 320 L660 250 L800 340 L940 240 L1100 330 L1240 260 L1440 330 L1440 420 L0 420Z" fill="#070d10" />
          <path d="M0 400 L200 350 L380 390 L600 340 L820 395 L1050 345 L1260 390 L1440 360 L1440 420 L0 420Z" fill="#040709" />
        </svg>
        {Array.from({ length: 28 }).map((_, i) => (
          <span
            key={i}
            className="absolute bottom-0 h-1 w-1 rounded-full bg-amber-400 shadow-[0_0_8px_2px_rgba(251,191,36,0.7)]"
            style={{ left: `${(i * 37) % 100}%`, animation: `ember ${7 + (i % 6)}s linear ${i * 0.45}s infinite` }}
          />
        ))}
      </div>

      <main className="relative z-10 mx-auto flex max-w-6xl flex-col items-center px-6 pb-32 pt-16">
        <p className="fade-rise font-display text-xs tracking-[0.6em] text-amber-300/70">UN MMORPG DE MUNDO ABIERTO</p>
        <h1 className="fade-rise mt-4 text-center font-display text-6xl font-black leading-none tracking-wide text-gold-gradient drop-shadow-[0_4px_30px_rgba(240,192,80,0.35)] md:text-8xl" style={{ animationDelay: "0.1s" }}>
          FANTASY<br />REALMS
        </h1>
        <p className="fade-rise mt-6 max-w-xl text-center text-lg italic text-stone-300/80" style={{ animationDelay: "0.25s" }}>
          Cinco razas. Seis clases. Tres reinos inmensos esperando a ser conquistados. Forja tu leyenda.
        </p>

        {/* Login */}
        <div className="fade-rise wow-frame mt-12 w-full max-w-md rounded-lg p-7" style={{ animationDelay: "0.4s" }}>
          <div className="mb-5 flex items-center justify-center gap-3">
            <span className="h-px flex-1 bg-gradient-to-r from-transparent to-amber-500/60" />
            <Swords className="h-5 w-5 text-amber-400" />
            <span className="h-px flex-1 bg-gradient-to-l from-transparent to-amber-500/60" />
          </div>
          {session && (
            <div className="mb-5 rounded border border-amber-500/30 bg-amber-500/5 p-3 text-center">
              <p className="text-sm text-stone-400">Bienvenido de nuevo,</p>
              <p className="font-display text-xl text-amber-200">{session.username}</p>
              <div className="mt-3 flex gap-2">
                <button onClick={() => enter(session.username)} disabled={loading} className="flex-1 rounded bg-gradient-to-b from-amber-500 to-amber-700 px-4 py-2 font-display text-sm font-bold text-black transition hover:brightness-110 disabled:opacity-60">
                  Continuar
                </button>
                <button onClick={() => { clearSession(); setSess(null); }} className="rounded border border-stone-600 px-3 py-2 text-sm text-stone-400 hover:text-stone-200">
                  Cambiar
                </button>
              </div>
            </div>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (username.trim()) enter(username.trim());
            }}
          >
            <label className="mb-2 block font-display text-xs tracking-[0.3em] text-amber-300/80">NOMBRE DE HÉROE</label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              maxLength={16}
              placeholder="Escribe tu nombre…"
              autoFocus
              className="w-full rounded border border-amber-700/50 bg-black/60 px-4 py-3 font-display text-lg tracking-wider text-amber-100 placeholder:text-stone-600 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
            />
            {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
            <button
              type="submit"
              disabled={loading || username.trim().length < 3}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded bg-gradient-to-b from-[#b81d1d] to-[#5e0b0b] px-6 py-3.5 font-display text-lg font-bold tracking-widest text-amber-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_0_25px_rgba(184,29,29,0.35)] transition hover:brightness-125 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
              ENTRAR AL REINO
            </button>
            <p className="mt-3 text-center text-xs text-stone-500">Sin contraseña: tu nombre es tu llave. Si no existe, lo crearemos.</p>
          </form>
        </div>

        {/* Zones */}
        <section className="mt-24 w-full">
          <h2 className="text-center font-display text-3xl text-amber-100">Tres reinos colosales</h2>
          <p className="mt-2 text-center text-stone-400">Un mundo abierto continuo de 2.400 × 800 metros, sin pantallas de carga.</p>
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {ZONES.map((z, i) => {
              const Icon = ZONE_ICONS[i];
              return (
                <div key={z.id} className="group relative overflow-hidden rounded-lg border border-amber-900/40 p-6 transition hover:-translate-y-1 hover:border-amber-500/60" style={{ background: ZONE_BG[i] }}>
                  <Icon className="h-8 w-8 text-amber-300/80" />
                  <h3 className="mt-4 font-display text-xl text-amber-100">{z.name}</h3>
                  <p className="mt-1 text-sm italic text-stone-300/80">{z.subtitle}</p>
                  <p className="mt-4 font-display text-xs tracking-[0.3em] text-amber-400/80">NIVELES {z.levels}</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* Races & classes */}
        <section className="mt-20 grid w-full gap-8 md:grid-cols-2">
          <div className="wow-frame rounded-lg p-6">
            <h3 className="font-display text-lg text-amber-200">Razas</h3>
            <div className="mt-4 flex flex-wrap gap-2">
              {RACES.map((r) => (
                <span key={r.id} className={`rounded border px-3 py-1.5 font-display text-sm ${r.faction === "Alianza" ? "border-sky-700/60 text-sky-200" : "border-red-800/60 text-red-200"}`}>
                  {r.name}
                </span>
              ))}
            </div>
          </div>
          <div className="wow-frame rounded-lg p-6">
            <h3 className="font-display text-lg text-amber-200">Clases</h3>
            <div className="mt-4 flex flex-wrap gap-2">
              {CLASSES.map((c) => (
                <span key={c.id} className="rounded border border-stone-700 px-3 py-1.5 font-display text-sm" style={{ color: c.color }}>
                  {c.name}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* Leaderboard */}
        {top.length > 0 && (
          <section className="wow-frame mt-12 w-full rounded-lg p-6">
            <h3 className="flex items-center gap-2 font-display text-lg text-amber-200"><Crown className="h-5 w-5" /> Héroes legendarios</h3>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {top.map((p, i) => {
                const c = CLASSES.find((x) => x.id === p.class_name);
                const r = RACES.find((x) => x.id === p.race);
                return (
                  <div key={p._id} className="flex items-center justify-between rounded border border-stone-800 bg-black/40 px-4 py-2">
                    <span className="flex items-center gap-3">
                      <span className="w-5 font-display text-amber-500">{i + 1}</span>
                      <span className="font-display" style={{ color: c?.color }}>{p.username}</span>
                      <span className="text-xs text-stone-500">{r?.name} · {c?.name}</span>
                    </span>
                    <span className="font-display text-sm text-amber-200">Nv {p.level ?? 1}</span>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
