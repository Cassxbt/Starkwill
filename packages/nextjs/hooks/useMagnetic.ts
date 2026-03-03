"use client";

import { useRef, useCallback } from "react";

const MAX_SHIFT = 20;

export function useMagnetic<T extends HTMLElement = HTMLElement>() {
  const ref = useRef<T>(null);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    const el = ref.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;

    const dx = ((e.clientX - cx) / (rect.width / 2)) * MAX_SHIFT;
    const dy = ((e.clientY - cy) / (rect.height / 2)) * MAX_SHIFT;

    el.style.transform = `translate(${dx}px, ${dy}px)`;
    el.style.transition = "transform 0.2s ease-out";
  }, []);

  const onMouseLeave = useCallback(() => {
    const el = ref.current;
    if (!el) return;

    el.style.transform = "translate(0, 0)";
    el.style.transition = "transform 0.4s ease-out";
  }, []);

  return { ref, onMouseMove, onMouseLeave };
}
