"use client";

import { cn } from "@repo/design-system/lib/utils";
import type { ComponentProps } from "react";
import { lazy, Suspense } from "react";

const InfoInput = lazy(() => import("./info-input"));

type InfoInputProps = ComponentProps<typeof InfoInput>;

// Lightweight placeholder sized to match a rendered InfoInput (label + input row)
// so the layout does not shift while react-aria-components / use-mask-input load.
const InfoInputFallback = ({ inputClassName }: { inputClassName?: string }) => (
	<div className="w-full max-w-full space-y-1">
		<div className="h-4 w-24 animate-pulse rounded bg-muted" />
		<div
			aria-hidden="true"
			className={cn(
				"h-9 w-full max-w-full animate-pulse rounded-md border border-input bg-muted/40",
				inputClassName,
			)}
		/>
	</div>
);

/**
 * Defers loading of `InfoInput` (and its heavy `react-aria-components` /
 * `use-mask-input` dependencies) until a date/info input is actually rendered,
 * keeping that bundle out of the initial paint.
 */
export const LazyInfoInput = (props: InfoInputProps) => (
	<Suspense fallback={<InfoInputFallback inputClassName={props.inputClassName} />}>
		<InfoInput {...props} />
	</Suspense>
);
