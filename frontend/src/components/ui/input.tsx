import * as React from "react";
import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      className={cn(
        "flex h-10 w-full rounded-lg border border-violet-800/40 bg-[#1d1533] px-3 py-2 text-sm text-violet-50 placeholder:text-violet-500/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500",
        className,
      )}
      ref={ref}
      {...props}
    />
  ),
);
Input.displayName = "Input";

export { Input };
