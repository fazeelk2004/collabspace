"use client";

import { useEffect, useRef } from "react";
import { animate, useMotionValue } from "framer-motion";

/** Animates a number from its previous value to `value` whenever it changes. */
export function CountUp({ value, suffix = "" }: { value: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const motionValue = useMotionValue(0);

  useEffect(() => {
    const controls = animate(motionValue, value, {
      duration: 1.2,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (latest) => {
        if (ref.current) ref.current.textContent = Math.round(latest) + suffix;
      },
    });
    return () => controls.stop();
  }, [value, suffix, motionValue]);

  return <span ref={ref}>0{suffix}</span>;
}
