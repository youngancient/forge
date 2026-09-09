"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Toaster as Sonner } from "sonner";

export function Toaster() {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // next-themes only resolves the real theme after mount — resolvedTheme is
  // undefined during SSR and the first client render. Using it directly in a
  // prop before then is exactly what causes a hydration mismatch here.
  useEffect(() => setMounted(true), []);

  return (
    <Sonner
      theme={mounted && resolvedTheme === "dark" ? "dark" : "light"}
      richColors
      position="top-right"
    />
  );
}
