"use client";

import { useEffect } from "react";

export default function ModuleError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Module page error:", error);
  }, [error]);

  return (
    <div className="h-full flex items-center justify-center">
      <div className="max-w-md text-center space-y-4">
        <h2 className="text-sm font-semibold text-stone-700">Something went wrong loading this module</h2>
        <p className="text-xs text-stone-400 font-mono break-all">{error.message}</p>
        {error.digest && (
          <p className="text-xs text-stone-300 font-mono">digest: {error.digest}</p>
        )}
        <button
          onClick={reset}
          className="px-4 py-2 bg-stone-800 text-white rounded-lg text-sm font-medium hover:bg-stone-900 transition-all"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
