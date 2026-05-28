"use client";

import { useEffect } from "react";

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    const isChunkError =
      error.name === "ChunkLoadError" ||
      error.message.includes("Loading chunk") ||
      error.message.includes("Failed to fetch dynamically imported module") ||
      error.message.includes("Importing a module script failed");

    if (isChunkError) {
      window.location.reload();
    }
  }, [error]);

  return (
    <html>
      <body>
        <div style={{ display: "flex", height: "100dvh", alignItems: "center", justifyContent: "center", background: "#0e1020", color: "#71717a", fontFamily: "sans-serif" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ marginBottom: 12, fontSize: 32 }}>⚠</div>
            <p>Something went wrong. Reloading…</p>
          </div>
        </div>
      </body>
    </html>
  );
}
