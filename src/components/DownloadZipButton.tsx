"use client";

import { Download } from "lucide-react";
import { files } from "@/lib/files";

// Fixed bottom-left button that downloads the full project source as a .zip
export function DownloadZipButton() {
  return (
    <a
      href={files.projectZip}
      download="fantasy-realms.zip"
      onClick={() => console.log("[DownloadZip] downloading project zip")}
      className="fixed bottom-4 left-4 z-[100] group flex items-center gap-2 rounded-md border border-amber-500/60 bg-gradient-to-b from-[#2a1d0e] to-[#120c05] px-4 py-2.5 font-display text-sm tracking-wider text-amber-200 shadow-[0_0_20px_rgba(245,158,11,0.25)] transition hover:border-amber-300 hover:text-amber-50 hover:shadow-[0_0_30px_rgba(245,158,11,0.5)]"
      title="Descargar los archivos del proyecto (.zip)"
    >
      <Download className="h-4 w-4 transition group-hover:translate-y-0.5" />
      Descargar proyecto .ZIP
    </a>
  );
}
