"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global error:", error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "sans-serif", backgroundColor: "#fafaf9" }}>
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div style={{ maxWidth: 400, textAlign: "center" }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: "#44403c", marginBottom: 8 }}>
              Something went wrong
            </p>
            <p style={{ fontSize: 11, fontFamily: "monospace", color: "#a8a29e", wordBreak: "break-all", marginBottom: 4 }}>
              {error.message}
            </p>
            {error.digest && (
              <p style={{ fontSize: 11, fontFamily: "monospace", color: "#d6d3d1", marginBottom: 16 }}>
                digest: {error.digest}
              </p>
            )}
            <button
              onClick={reset}
              style={{
                padding: "8px 16px",
                backgroundColor: "#292524",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
