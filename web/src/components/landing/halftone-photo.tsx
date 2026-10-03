"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

const CELL = 4;
/** Above this many pixels the canvas is drawn smaller and scaled up, so wide screens stay cheap. */
const MAX_PIXELS = 1600 * 1000;

/**
 * A photo with a halftone filter, ported from monocode's session-background halftone
 * (github.com/hardbeat920/monocode). Each 4px cell gets a dot sized by its brightness, in the
 * colour under it, laid over the page colour and blended 40% into the photo.
 */
export function HalftonePhoto({
  src,
  className,
  overlayClassName,
  children,
}: {
  src: string;
  className?: string;
  /** Extra wash over the photo, e.g. a fade into the page. */
  overlayClassName?: string;
  children?: ReactNode;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const img = new Image();
    img.src = src;
    let frame = 0;

    const draw = () => {
      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height || !img.naturalWidth) return;
      const shrink = Math.min(1, Math.sqrt(MAX_PIXELS / (rect.width * rect.height)));
      const width = Math.max(1, Math.round(rect.width * shrink));
      const height = Math.max(1, Math.round(rect.height * shrink));
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;

      // Cover-crop the photo into the canvas, the way object-fit: cover would.
      const scale = Math.max(width / img.naturalWidth, height / img.naturalHeight);
      const sw = width / scale;
      const sh = height / scale;
      ctx.drawImage(img, (img.naturalWidth - sw) / 2, (img.naturalHeight - sh) / 2, sw, sh, 0, 0, width, height);
      const source = ctx.getImageData(0, 0, width, height);
      const pixels = source.data;

      // The "paper" under the dots is the page colour, so the texture belongs to the theme.
      const root = getComputedStyle(document.documentElement);
      const light = root.colorScheme !== "dark";
      ctx.fillStyle = root.getPropertyValue("--bg").trim() || (light ? "#ffffff" : "#000000");
      ctx.fillRect(0, 0, 1, 1);
      const [pr, pg, pb] = ctx.getImageData(0, 0, 1, 1).data;
      const paper = [pr, pg, pb];

      const output = ctx.createImageData(width, height);
      const out = output.data;
      for (let y = 0; y < height; y += CELL) {
        for (let x = 0; x < width; x += CELL) {
          const sx = Math.min(x + 2, width - 1);
          const sy = Math.min(y + 2, height - 1);
          const dot = (sy * width + sx) * 4;
          const sampled = 0.2126 * pixels[dot] + 0.7152 * pixels[dot + 1] + 0.0722 * pixels[dot + 2];
          const luma = light ? 255 - sampled : sampled;
          const radius = 2 * (0.3 + 0.7 * Math.sqrt(luma / 255));
          for (let dy = 0; dy < Math.min(CELL, height - y); dy++) {
            for (let dx = 0; dx < Math.min(CELL, width - x); dx++) {
              const coverage = Math.max(0, Math.min(1, radius + 0.5 - Math.hypot(dx - 1.5, dy - 1.5)));
              const p = ((y + dy) * width + x + dx) * 4;
              for (let c = 0; c < 3; c++) {
                const texture = pixels[dot + c] * coverage + paper[c] * (1 - coverage);
                out[p + c] = pixels[p + c] * 0.6 + texture * 0.4;
              }
              out[p + 3] = 255;
            }
          }
        }
      }
      ctx.putImageData(output, 0, 0);
    };

    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(draw);
    };

    img.addEventListener("load", schedule);
    const resize = new ResizeObserver(schedule);
    resize.observe(canvas);
    // Redraw when the theme flips, so the paper colour follows it.
    const theme = new MutationObserver(schedule);
    theme.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    media.addEventListener("change", schedule);
    if (img.complete) schedule();

    return () => {
      cancelAnimationFrame(frame);
      img.removeEventListener("load", schedule);
      resize.disconnect();
      theme.disconnect();
      media.removeEventListener("change", schedule);
    };
  }, [src]);

  return (
    <div className={cn("relative isolate overflow-hidden rounded-[var(--radius-frame)]", className)}>
      {/* The plain photo shows until the filtered canvas is drawn over it. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" aria-hidden decoding="async" className="absolute inset-0 -z-20 size-full object-cover" />
      <canvas ref={canvasRef} aria-hidden className="pointer-events-none absolute inset-0 -z-10 size-full" />
      {/* Dark mode keeps a light wash so the photo does not overpower what sits on it. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 dark:bg-[color-mix(in_oklab,var(--raise)_40%,transparent)]" />
      {overlayClassName ? <div aria-hidden className={cn("pointer-events-none absolute inset-0 -z-10", overlayClassName)} /> : null}
      {children}
    </div>
  );
}
