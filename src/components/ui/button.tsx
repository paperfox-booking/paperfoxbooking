import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

// Big, easy-to-tap buttons (at least 48px tall) for phones.
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-lg font-bold no-underline transition-colors disabled:pointer-events-none disabled:opacity-60 [&_svg]:size-5 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-coral text-ink hover:bg-coral-light",
        secondary: "border-2 border-ink bg-white text-ink hover:bg-cream-light",
        ghost: "text-ink hover:bg-cream-light",
        link: "text-coral-deep underline underline-offset-4 hover:text-ink",
      },
      size: {
        default: "min-h-12 px-5 text-base",
        large: "min-h-14 px-6 text-lg",
        small: "min-h-10 px-4 text-sm",
      },
      width: {
        auto: "",
        full: "w-full",
      },
    },
    defaultVariants: { variant: "primary", size: "default", width: "auto" },
  },
);

export interface ButtonProps
  extends ComponentProps<"button">, VariantProps<typeof buttonVariants> {
  /** Render the child element (for example a link) with button styling. */
  asChild?: boolean;
}

export function Button({
  className,
  variant,
  size,
  width,
  asChild = false,
  ...props
}: ButtonProps) {
  const Component = asChild ? Slot : "button";
  return (
    <Component
      className={cn(buttonVariants({ variant, size, width }), className)}
      {...props}
    />
  );
}

export { buttonVariants };
