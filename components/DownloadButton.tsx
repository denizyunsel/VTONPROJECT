"use client";

import { Download } from "lucide-react";

export function DownloadButton({ url, filename }: { url: string; filename: string }) {
  async function handleDownload() {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      window.open(url, "_blank");
    }
  }

  return (
    <button
      onClick={handleDownload}
      className="text-gray-400 hover:text-gray-700 transition-colors"
      title="İndir"
    >
      <Download className="w-4 h-4" />
    </button>
  );
}
