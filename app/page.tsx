"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useConvexAuth } from "convex/react";

function HomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const wantsSignIn = searchParams.get("signin") === "1";

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace("/tracker");
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading) {
    return (
      <main className="min-h-[calc(100vh-48px)] flex items-center justify-center">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-stone-300 border-t-stone-700" />
      </main>
    );
  }

  if (isAuthenticated) {
    return (
      <main className="min-h-[calc(100vh-48px)] flex items-center justify-center">
        <p className="text-sm text-stone-400">Redirecting...</p>
      </main>
    );
  }

  return (
    <main className="min-h-[calc(100vh-48px)] flex items-center justify-center">
      <div className="text-center space-y-4">
        <h1 className="text-2xl font-semibold text-stone-800 tracking-tight">
          Mission Quality Control
        </h1>
        <p className="text-sm text-stone-500 max-w-sm mx-auto">
          Content review pipeline for EdutechPlus modules.
          {wantsSignIn ? " Sign in to continue." : ""}
        </p>
        <p className="text-xs text-stone-400">
          Click <span className="font-medium text-stone-600">Sign In</span> in the top-right corner to get started.
        </p>
      </div>
    </main>
  );
}

export default function Home() {
  return (
    <Suspense
      fallback={
        <main className="min-h-[calc(100vh-48px)] flex items-center justify-center">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-stone-300 border-t-stone-700" />
        </main>
      }
    >
      <HomeContent />
    </Suspense>
  );
}
