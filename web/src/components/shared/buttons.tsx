"use client";

import { Button, ButtonLink, type ButtonLinkProps, type ButtonProps } from "@/components/motion/button";
import { cn } from "@/lib/utils";

const shape = "rounded-[var(--radius-button)]";

/** beUI Button with the Toki button radius (a pill). */
export function TokiButton({ className, ...props }: ButtonProps) {
  return <Button {...props} className={cn(shape, className)} />;
}

export function TokiButtonLink({ className, ...props }: ButtonLinkProps) {
  return <ButtonLink {...props} className={cn(shape, className)} />;
}
