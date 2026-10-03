"use client";

import { useEffect, useRef, type ComponentProps, type RefObject } from "react";

/**
 * Wrapper for an animated illustration. Its CSS animations pause while it is
 * off screen (`data-paused`), and the scene CSS shows a still frame under
 * prefers-reduced-motion.
 */
export function Scene({ children, ...props }: ComponentProps<"div">) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) delete el.dataset.paused;
      else el.dataset.paused = "";
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} {...props}>
      {children}
    </div>
  );
}

/**
 * Writes scroll progress through `ref` (0 as its top reaches the top of the
 * viewport, 1 as its bottom reaches the bottom) to the CSS variable `--p`,
 * and to `onProgress` for anything CSS can't do, such as counting numbers.
 * Under reduced motion it pins `--p` to 1, the finished state.
 */
export function useScrollProgress(ref: RefObject<HTMLElement | null>, onProgress?: (p: number) => void) {
  const cb = useRef(onProgress);
  useEffect(() => {
    cb.current = onProgress;
  });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const set = (p: number) => {
      el.style.setProperty("--p", p.toFixed(4));
      cb.current?.(p);
    };
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      set(1);
      return;
    }
    let frame = 0;
    const update = () => {
      frame = 0;
      const r = el.getBoundingClientRect();
      const travel = r.height - innerHeight;
      set(travel > 0 ? Math.min(1, Math.max(0, -r.top / travel)) : r.top < innerHeight ? 1 : 0);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    addEventListener("scroll", onScroll, { passive: true });
    addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(frame);
      removeEventListener("scroll", onScroll);
      removeEventListener("resize", onScroll);
    };
  }, [ref]);
}
