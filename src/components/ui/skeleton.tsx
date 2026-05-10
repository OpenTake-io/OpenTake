import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const skeletonVariants = cva(
	"relative overflow-hidden rounded-md transition-shadow",
	{
		variants: {
			variant: {
				default: "bg-muted/40",
				glass: "bg-white/5 backdrop-blur-sm border border-white/10",
				dark: "bg-black/20",
				subtle: "bg-foreground/[0.03]",
			},
			animation: {
				none: "",
				pulse: "animate-pulse",
				shimmer: "before:absolute before:inset-0 before:-translate-x-full before:animate-shimmer before:bg-gradient-to-r before:from-transparent before:via-foreground/[0.04] before:to-transparent",
				"shimmer-glass": "before:absolute before:inset-0 before:-translate-x-full before:animate-shimmer before:bg-gradient-to-r before:from-transparent before:via-white/[0.08] before:to-transparent",
			},
		},
		defaultVariants: {
			variant: "default",
			animation: "shimmer",
		},
	},
);

export interface SkeletonProps
	extends React.HTMLAttributes<HTMLDivElement>,
		VariantProps<typeof skeletonVariants> {}

/**
 * A magnificent Skeleton component designed with Apple-inspired aesthetics.
 * Supports shimmer animations, pulse effects, and glassmorphism.
 */
const Skeleton = React.forwardRef<HTMLDivElement, SkeletonProps>(
	({ className, variant, animation, ...props }, ref) => {
		return (
			<div
				ref={ref}
				className={cn(skeletonVariants({ variant, animation, className }))}
				{...props}
			/>
		);
	},
);

Skeleton.displayName = "Skeleton";

export { Skeleton, skeletonVariants };
