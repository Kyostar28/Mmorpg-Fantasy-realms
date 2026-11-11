"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, Loader2, Sparkles } from "lucide-react";
import Link from "next/link";
import { CharacterPreview } from "@/components/game/CharacterPreview";
import { DEFAULT_PLAYER_APPEARANCE, type PlayerAppearance, type PlayerRecord } from "@/lib/game/data";
import { getSession, setSession } from "@/lib/game/session";

const COLOR_SWATCHES = ["#d9b857", "#a85135", "#5f7d42", "#557d9e", "#8462a2", "#302b2a", "#d7d2c5", "#e8c9a2"];
const COLOR_PARTS: { key: keyof PlayerAppearance; label: string; detail: string }[] = [
  { key: "hairColor", label: "Cabello", detail: "Elige el tono de tu cabello" },
  { key: "chestColor", label: "Pecho", detail: "Color de la túnica" },
  { key: "pantsColor", label: "Pantalón", detail: "Color de las prendas" },
  { key: "bootsColor", label: "Botas", detail: "Color del calzado" },
];

function ColorField({ label, detail, value, onChange }: { label: string; detail: string; value: string; onChange: (value: string) => void }) {
  return (
    <fieldset className="min-w-0">
      <legend className="font-display text-sm font-semibold text-stone-100">{label}</legend>
      <p className="mt-1 text-xs text-stone-500">{detail}</p>
      <div className="mt-3 flex items-center gap-2">
        <label className="relative h-10 w-10 shrink-0 cursor-pointer overflow-hidden rounded-lg border border-white/15 shadow-inner" style={{ backgroundColor: value }}>
          <span className="sr-only">Seleccionar color de {label.toLowerCase()}</span>
          <input type="color" value={value} onChange={(event) => onChange(event.target.value)} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" aria-label={`Seleccionar color de ${label.toLowerCase()}`} />
        </label>
        <div className="flex flex-wrap gap-1.5" aria-label={`Colores sugeridos para ${label.toLowerCase()}`}>
          {COLOR_SWATCHES.map((swatch) => (
            <button key={swatch} type="button" aria-label={`${label}: ${swatch}`} aria-pressed={value.toLowerCase() === swatch.toLowerCase()} onClick={() => onChange(swatch)} className="h-6 w-6 rounded-full border border-white/20 transition hover:scale-110 aria-pressed:ring-2 aria-pressed:ring-amber-300 aria-pressed:ring-offset-2 aria-pressed:ring-offset-[#151411]" style={{ backgroundColor: swatch }} />
          ))}
        </div>
      </div>
      <p className="mt-2 font-mono text-[10px] uppercase tracking-widest text-stone-600">{value}</p>
    </fieldset>
  );
}

export default function CreateCharacterPage() {
  const router = useRouter();
  const [player, setPlayer] = useState<PlayerRecord | null>(null);
  const [appearance, setAppearance] = useState<PlayerAppearance>(DEFAULT_PLAYER_APPEARANCE);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [previewIsLive, setPreviewIsLive] = useState(true);

  useEffect(() => {
    const local = getSession();
    if (!local) {
      router.replace("/");
      return;
    }
    let active = true;
    fetch(`/api/player/${local.id}`)
      .then((response) => response.json())
      .then((result) => {
        const payload = result as { ok?: boolean; data?: PlayerRecord };
        if (!active || !payload.ok || !payload.data) {
          if (active) router.replace("/");
          return;
        }
        const existing = payload.data;
        if (existing.class_name && existing.race) {
          router.replace("/play");
          return;
        }
        setPlayer(existing);
        setAppearance({
          hairColor: existing.hairColor ?? DEFAULT_PLAYER_APPEARANCE.hairColor,
          chestColor: existing.chestColor ?? DEFAULT_PLAYER_APPEARANCE.chestColor,
          pantsColor: existing.pantsColor ?? DEFAULT_PLAYER_APPEARANCE.pantsColor,
          bootsColor: existing.bootsColor ?? DEFAULT_PLAYER_APPEARANCE.bootsColor,
        });
      })
      .catch(() => { if (active) router.replace("/"); });
    return () => { active = false; };
  }, [router]);

  const updateColor = (key: keyof PlayerAppearance, value: string) => setAppearance((current) => ({ ...current, [key]: value }));

  const createCharacter = async () => {
    if (!player || saving) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/player/${player._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ race: "human", class_name: "warrior", ...appearance }),
      });
      const result = (await response.json()) as { ok?: boolean; data?: PlayerRecord; error?: string };
      if (!response.ok || !result.ok || !result.data) throw new Error(result.error ?? "No se pudo guardar el personaje.");
      setSession({ id: result.data._id, username: result.data.username });
      router.push("/play");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo guardar el personaje. Inténtalo de nuevo.");
      setSaving(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#0d0e0d] text-stone-100">
      <header className="flex h-16 items-center justify-between border-b border-white/10 px-5 md:px-9">
        <Link href="/" className="flex items-center gap-2 text-sm text-stone-400 transition hover:text-amber-200"><ArrowLeft className="h-4 w-4" /> Volver</Link>
        <p className="font-display text-xs uppercase tracking-[0.28em] text-amber-300">Fantasy Realms</p>
        <div className="w-16" />
      </header>

      <div className="mx-auto grid max-w-6xl gap-5 px-4 py-5 md:grid-cols-[minmax(290px,360px)_minmax(0,1fr)] md:gap-8 md:px-8 md:py-8">
        <section className="order-1 flex min-h-[44vh] flex-col overflow-hidden rounded-2xl border border-amber-100/10 bg-[radial-gradient(ellipse_at_50%_38%,#333127_0%,#1c1d19_38%,#111211_75%)] md:order-2 md:min-h-[680px]" aria-label="Vista previa del personaje">
          <div className="flex items-center justify-between px-5 pt-5">
            <div><p className="text-[10px] uppercase tracking-[0.3em] text-amber-300/75">Vista previa</p><p className="mt-1 font-display text-lg text-stone-100">{player?.username ?? "Tu aventurero"}</p></div>
            <span className="flex items-center gap-1.5 rounded-full border border-emerald-300/15 bg-emerald-300/5 px-2.5 py-1 text-[10px] uppercase tracking-wider text-emerald-200/70"><span className={`h-1.5 w-1.5 rounded-full ${previewIsLive ? "bg-emerald-300" : "bg-amber-300"}`} /> {previewIsLive ? "En vivo" : "Referencia"}</span>
          </div>
          <div className="relative min-h-[330px] flex-1">
            <CharacterPreview appearance={appearance} onAvailabilityChange={setPreviewIsLive} />
          </div>
          <p className="px-5 pb-5 text-center text-xs text-stone-500">{previewIsLive ? "Tu personaje aparecerá así durante la aventura." : "Referencia estática: el modelo 3D requiere compatibilidad WebGL."}</p>
        </section>

        <section className="order-2 md:order-1 md:py-4">
          <div className="mb-7">
            <p className="mb-3 flex items-center gap-2 text-[10px] uppercase tracking-[0.32em] text-amber-300"><Sparkles className="h-3.5 w-3.5" /> Un nuevo comienzo</p>
            <h1 className="font-display text-3xl font-semibold leading-tight text-stone-50 md:text-4xl">Crea tu personaje</h1>
            <p className="mt-3 max-w-sm text-sm leading-6 text-stone-400">Personaliza los colores de tu aventurero. Esta será su apariencia en todos los reinos.</p>
          </div>

          <div className="grid grid-cols-1 gap-x-5 gap-y-6 sm:grid-cols-2 md:grid-cols-1">
            {COLOR_PARTS.map((part) => <ColorField key={part.key} label={part.label} detail={part.detail} value={appearance[part.key]} onChange={(value) => updateColor(part.key, value)} />)}
          </div>

          {error && <p role="alert" className="mt-5 rounded-lg border border-red-400/20 bg-red-950/30 px-3 py-2 text-sm text-red-200">{error}</p>}
          <button type="button" onClick={createCharacter} disabled={!player || saving} className="mt-7 flex w-full items-center justify-center gap-2 rounded-xl border border-amber-200/30 bg-gradient-to-b from-amber-300 to-amber-500 px-5 py-3.5 font-display text-sm font-bold text-stone-950 shadow-[0_8px_28px_rgba(201,150,48,0.16)] transition hover:from-amber-200 hover:to-amber-400 disabled:cursor-not-allowed disabled:opacity-60">
            {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Guardando personaje...</> : <><Check className="h-4 w-4" /> Entrar al reino</>}
          </button>
          <p className="mt-3 text-center text-[11px] text-stone-600">Podrás cambiar estos colores más adelante.</p>
        </section>
      </div>
    </main>
  );
}
