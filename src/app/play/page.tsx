"use client";

import dynamic from "next/dynamic";

const GameClient = dynamic(() => import("@/components/game/GameClient"), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-screen items-center justify-center bg-black font-display text-amber-200">Cargando el reino…</div>
  ),
});

export default function PlayPage() {
  return <GameClient />;
}
