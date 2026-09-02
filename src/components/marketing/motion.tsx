// Motion primitives for the public marketing site.
//
// Everything here degrades to a static, fully visible render when the visitor
// prefers reduced motion, and when JavaScript has not hydrated yet.

import { useEffect, useRef, useState, type ElementType, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(query.matches);
    const onChange = (event: MediaQueryListEvent) => setReduced(event.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

/** Fires once when the element first enters the viewport. */
export function useInView<T extends HTMLElement>(options?: { rootMargin?: string }) {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (typeof IntersectionObserver !== "function") {
      setInView(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setInView(true);
            observer.disconnect();
          }
        }
      },
      { rootMargin: options?.rootMargin ?? "0px 0px -12% 0px", threshold: 0.12 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [options?.rootMargin]);

  return { ref, inView };
}

export function Reveal({
  children,
  delay = 0,
  as: Tag = "div",
  className,
}: {
  children: ReactNode;
  delay?: number;
  as?: ElementType;
  className?: string;
}) {
  const { ref, inView } = useInView<HTMLDivElement>();
  return (
    <Tag
      ref={ref}
      className={cn("nsl-reveal", className)}
      data-visible={inView ? "true" : "false"}
      style={{ ["--nsl-reveal-delay" as string]: `${delay}ms` }}
    >
      {children}
    </Tag>
  );
}

/**
 * Animates a numeric value into place when it scrolls into view. Purely a
 * presentation effect: the final value is always the value passed in.
 */
export function CountUp({
  value,
  format,
  durationMs = 900,
  className,
}: {
  value: number;
  format?: (n: number) => string;
  durationMs?: number;
  className?: string;
}) {
  const reduced = usePrefersReducedMotion();
  const { ref, inView } = useInView<HTMLSpanElement>();
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!inView) return;
    if (reduced || value === 0) {
      setDisplay(value);
      return;
    }
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(value * eased);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [inView, reduced, value, durationMs]);

  const render = format ?? ((n: number) => String(Math.round(n)));
  return (
    <span ref={ref} className={className}>
      {render(display)}
    </span>
  );
}

/**
 * Steps an index forward on an interval while the element is on screen.
 * Returns a fixed index when reduced motion is requested.
 */
export function useSequence(length: number, intervalMs = 2200, restIndex = 0) {
  const reduced = usePrefersReducedMotion();
  const { ref, inView } = useInView<HTMLDivElement>();
  const [index, setIndex] = useState(restIndex);

  useEffect(() => {
    if (!inView || reduced || length <= 1) return;
    const id = window.setInterval(() => {
      setIndex((current) => (current + 1) % length);
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [inView, reduced, length, intervalMs]);

  return { ref, index: reduced ? restIndex : index, active: inView && !reduced };
}
