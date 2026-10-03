"use client";

import { useCallback, useState } from "react";
import { cn } from "@/lib/utils";

interface Props {
  src: string;
  alt: string;
  className?: string;
  /** Initial box shape before the image reports its own ratio. */
  placeholderClassName?: string;
}

/** Plain img: retailer images come from arbitrary hosts and keep their own aspect ratio. */
export function ProductImage({ src, alt, className, placeholderClassName = "aspect-[4/3]" }: Props) {
  const [state, setState] = useState<"loading" | "ready" | "failed">(src ? "loading" : "failed");
  // An image that finished loading before hydration never fires onLoad, so check it on attach.
  const attach = useCallback((el: HTMLImageElement | null) => {
    if (el?.complete) setState(el.naturalWidth > 0 ? "ready" : "failed");
  }, []);
  return (
    <div
      className={cn(
        "relative w-full overflow-hidden rounded-image bg-surface-sunk",
        state !== "ready" && placeholderClassName,
        className,
      )}
    >
      {state !== "failed" && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          ref={attach}
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onLoad={() => setState("ready")}
          onError={() => setState("failed")}
          className={cn("block h-auto w-full transition-opacity duration-300", state === "ready" ? "opacity-100" : "opacity-0")}
        />
      )}
    </div>
  );
}
