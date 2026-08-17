"use client";

import Inputs from "@repo/design-system/components/inputs/inputs";
import { Checkbox } from "@repo/design-system/components/ui/checkbox";
import { Input } from "@repo/design-system/components/ui/input";
import { Label } from "@repo/design-system/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@repo/design-system/components/ui/toggle-group";
import { Bot, Braces, Calculator, Check, FileCheck2, FileText, Sparkles } from "lucide-react";
import { parseMarkdocToInputs } from "markdoc-md/parse";
import { DynamicMarkdocRenderer } from "markdoc-md/react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ChangeEvent, ReactNode } from "react";

import { USER_MESSAGES } from "@/lib/user-messages";

const CONTENT = USER_MESSAGES.landing.features;
const FEATURE_IDS = ["markdown", "template", "score", "ai", "document"] as const;
const TEMPLATE_INPUTS = parseMarkdocToInputs(CONTENT.frame.template.content);
const INITIAL_SCORE_VALUES = Object.fromEntries(
	CONTENT.frame.score.factors.map((factor) => [factor.key, factor.initial]),
);

type FeatureId = (typeof FEATURE_IDS)[number];

const FEATURE_ICONS = {
	ai: Bot,
	document: FileCheck2,
	markdown: FileText,
	score: Calculator,
	template: Braces,
} as const;

interface DemoFrameProps {
	badge: string;
	children: ReactNode;
	title: string;
}

const DemoFrame = ({ badge, children, title }: DemoFrameProps) => (
	<div className="min-w-0 w-full overflow-hidden rounded-xl border bg-card shadow-2xl shadow-solarized-base03/10">
		<div className="flex h-11 items-center gap-3 border-b bg-muted/40 px-4">
			<div aria-hidden="true" className="flex gap-1.5">
				<span className="size-2.5 rounded-full bg-solarized-red/70" />
				<span className="size-2.5 rounded-full bg-solarized-yellow/70" />
				<span className="size-2.5 rounded-full bg-solarized-green/70" />
			</div>
			<span className="min-w-0 flex-1 truncate font-mono text-muted-foreground text-xs">
				{title}
			</span>
			<span className="shrink-0 rounded-full bg-solarized-blue/10 px-2 py-1 font-mono text-[0.62rem] text-solarized-blue uppercase tracking-wide whitespace-nowrap">
				{badge}
			</span>
		</div>
		{children}
	</div>
);

interface PaneLabelProps {
	children: ReactNode;
}

const PaneLabel = ({ children }: PaneLabelProps) => (
	<p className="mb-4 font-mono text-[0.66rem] text-muted-foreground uppercase tracking-[0.14em]">
		{children}
	</p>
);

const MarkdownDemo = () => {
	const content = CONTENT.frame.markdown;

	return (
		<DemoFrame badge={content.badge} title={content.title}>
			<div className="grid min-h-[25rem] md:h-[32rem] md:min-h-0 md:grid-cols-2 lg:h-[28rem]">
				<div
					className="min-w-0 overflow-y-auto border-b bg-foreground p-5 text-background md:border-r md:border-b-0 lg:p-6"
					data-markdown-source
				>
					<p className="mb-4 font-mono text-[0.66rem] uppercase tracking-[0.14em] opacity-55">
						{content.sourceLabel}
					</p>
					<pre className="overflow-x-auto whitespace-pre-wrap font-mono text-sm leading-7">
						<code>{content.source}</code>
					</pre>
				</div>
				<div className="min-w-0 overflow-y-auto p-5 lg:p-6" data-markdown-preview>
					<PaneLabel>{content.previewLabel}</PaneLabel>
					<div className="prose prose-sm max-w-none font-sans leading-relaxed">
						<DynamicMarkdocRenderer markdocContent={content.source} variables={{}} />
					</div>
				</div>
			</div>
		</DemoFrame>
	);
};

interface InteractiveDemoProps {
	onChange: (data: Record<string, unknown>) => void;
	values: Record<string, unknown>;
}

const TemplateDemo = ({ onChange, values }: InteractiveDemoProps) => {
	const content = CONTENT.frame.template;

	return (
		<DemoFrame badge={content.badge} title={content.title}>
			<div
				className="grid min-h-[25rem] md:h-[32rem] md:min-h-0 md:grid-cols-[0.8fr_1.2fr] lg:h-[28rem]"
				data-template-demo
			>
				<div
					className="overflow-y-auto border-b bg-muted/20 p-5 md:border-r md:border-b-0 lg:p-6"
					data-template-input
				>
					<PaneLabel>{content.inputLabel}</PaneLabel>
					<Inputs inputTags={TEMPLATE_INPUTS} onChange={onChange} />
				</div>
				<div className="overflow-y-auto p-5 lg:p-6">
					<PaneLabel>{content.outputLabel}</PaneLabel>
					<div className="prose prose-sm max-w-none font-sans leading-relaxed">
						<DynamicMarkdocRenderer markdocContent={content.content} variables={values} />
					</div>
				</div>
			</div>
		</DemoFrame>
	);
};

interface ScoreSwitchProps {
	label: string;
	onChange: (value: string) => void;
	options: readonly { label: string; value: string }[];
	value: string;
}

const ScoreSwitch = ({ label, onChange, options, value }: ScoreSwitchProps) => (
	<div className="space-y-1.5">
		<Label>{label}</Label>
		<ToggleGroup
			aria-label={label}
			className="w-full overflow-hidden bg-background"
			onValueChange={(values) => {
				const [nextValue] = values;
				if (nextValue) {
					onChange(nextValue);
				}
			}}
			value={[value]}
			variant="outline"
		>
			{options.map((option) => (
				<ToggleGroupItem
					className="h-9 flex-1 px-2 text-xs"
					key={option.value}
					value={option.value}
				>
					{option.label}
				</ToggleGroupItem>
			))}
		</ToggleGroup>
	</div>
);

const ScoreDemo = () => {
	const content = CONTENT.frame.score;
	const [factorValues, setFactorValues] = useState<Record<string, unknown>>(INITIAL_SCORE_VALUES);
	const [age, setAge] = useState(content.age.initial);
	const [gender, setGender] = useState(content.gender.initial);
	const selectedAge = content.age.options.find((option) => option.value === age);
	const selectedGender = content.gender.options.find((option) => option.value === gender);
	const variables = {
		...factorValues,
		Alter65: age === "65-to-74",
		Alter75: age === "at-least-75",
		Weiblich: gender === "female",
	};
	const score =
		content.factors.reduce(
			(total, factor) => total + (factorValues[factor.key] ? factor.points : 0),
			0,
		) +
		(selectedAge?.points ?? 0) +
		(selectedGender?.points ?? 0);

	const handleFactorChange = useCallback((key: string, checked: boolean) => {
		setFactorValues((currentValues) => ({ ...currentValues, [key]: checked }));
	}, []);

	return (
		<DemoFrame badge={content.badge} title={content.title}>
			<div className="grid min-h-[25rem] md:grid-cols-[0.95fr_1.05fr] lg:h-[28rem] lg:min-h-0">
				<div
					className="max-h-[32rem] overflow-y-auto border-b bg-muted/20 p-5 md:border-r md:border-b-0 lg:p-6"
					data-score-input
				>
					<PaneLabel>{content.inputLabel}</PaneLabel>
					<div className="space-y-3">
						<div className="space-y-1.5">
							<Label htmlFor="landing-cha2ds2-vasc">CHA₂DS₂-VASc-Score</Label>
							<Input
								className="h-9 cursor-default bg-muted font-medium"
								id="landing-cha2ds2-vasc"
								readOnly
								value={`${score} Punkte`}
							/>
						</div>
						<div className="grid gap-3">
							<ScoreSwitch
								label={content.age.label}
								onChange={setAge}
								options={content.age.options}
								value={age}
							/>
							<ScoreSwitch
								label={content.gender.label}
								onChange={setGender}
								options={content.gender.options}
								value={gender}
							/>
						</div>
						<div className="grid gap-2 border-muted border-l-2 pl-4 sm:grid-cols-2">
							{content.factors.map((factor) => (
								<Label
									className="flex min-h-9 cursor-pointer items-center gap-2 rounded-md border border-input bg-background px-3 py-2 transition-colors hover:bg-muted/40"
									htmlFor={`landing-score-${factor.key}`}
									key={factor.key}
									onClick={(event) => {
										event.preventDefault();
										if (
											event.target instanceof Element &&
											event.target.closest('[data-slot="checkbox"]')
										) {
											return;
										}
										handleFactorChange(factor.key, !factorValues[factor.key]);
									}}
								>
									<Checkbox
										aria-label={factor.label}
										checked={Boolean(factorValues[factor.key])}
										id={`landing-score-${factor.key}`}
										onCheckedChange={(checked) => handleFactorChange(factor.key, checked)}
									/>
									<span aria-hidden="true" className="flex gap-1 font-medium text-sm leading-none">
										{factor.label.split(" ").map((part) => (
											<span key={part}>{part}</span>
										))}
									</span>
								</Label>
							))}
						</div>
					</div>
				</div>
				<div className="overflow-y-auto p-5 lg:p-6">
					<PaneLabel>{content.outputLabel}</PaneLabel>
					<div className="prose prose-sm max-w-none font-sans leading-relaxed" data-score-output>
						<DynamicMarkdocRenderer markdocContent={content.content} variables={variables} />
					</div>
				</div>
			</div>
		</DemoFrame>
	);
};

const AiDemo = () => {
	const content = CONTENT.frame.ai;

	return (
		<DemoFrame badge={content.badge} title={content.title}>
			<div className="grid min-h-[25rem] md:grid-cols-3" data-ai-demo>
				<div className="border-b bg-foreground p-5 text-background md:border-r md:border-b-0 lg:p-6">
					<p className="mb-4 font-mono text-[0.66rem] uppercase tracking-[0.14em] opacity-55">
						{content.inputLabel}
					</p>
					<pre className="whitespace-pre-wrap font-mono text-xs leading-6">{content.inputText}</pre>
				</div>
				<div className="min-w-0 border-b bg-muted/20 p-5 md:border-r md:border-b-0 lg:p-6">
					<PaneLabel>{content.templateLabel}</PaneLabel>
					<div className="md:grid md:grid-rows-[8.75rem_auto]" data-ai-template>
						<pre className="overflow-x-auto whitespace-pre-wrap font-mono text-[0.68rem] leading-5 text-muted-foreground">
							{content.templateIntro}
						</pre>
						<pre
							className="mt-5 overflow-x-auto whitespace-pre-wrap font-mono text-[0.68rem] leading-5 text-muted-foreground md:mt-0"
							data-ai-template-vitals
						>
							{content.templateVitals}
						</pre>
					</div>
				</div>
				<div className="relative min-w-0 p-5 lg:p-6" data-ai-output>
					<PaneLabel>{content.outputLabel}</PaneLabel>
					<Sparkles className="absolute top-5 right-5 size-4 text-solarized-green" />
					<div className="md:grid md:grid-rows-[8.75rem_auto]">
						<p className="font-sans text-sm leading-7">{content.outputText}</p>
						<div className="mt-5 md:mt-0" data-ai-output-vitals>
							<p className="font-semibold text-xs leading-5">{content.vitalsLabel}:</p>
							<p className="mt-2 font-sans text-xs leading-5">{content.vitals.join(", ")}.</p>
						</div>
					</div>
				</div>
			</div>
		</DemoFrame>
	);
};

const DocumentDemo = () => {
	const content = CONTENT.frame.document;
	const [patient, setPatient] = useState(content.patientInitial);
	const [diagnosis, setDiagnosis] = useState(content.diagnosisInitial);
	const [hasConsent, setHasConsent] = useState(true);

	const handlePatientChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
		setPatient(event.target.value);
	}, []);

	const handleDiagnosisChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
		setDiagnosis(event.target.value);
	}, []);

	const handleConsentChange = useCallback((checked: boolean) => {
		setHasConsent(checked);
	}, []);

	return (
		<DemoFrame badge={content.badge} title={content.title}>
			<div className="grid min-h-[25rem] md:grid-cols-[0.8fr_1.2fr]">
				<div className="border-b bg-muted/20 p-5 md:border-r md:border-b-0 lg:p-6">
					<PaneLabel>{content.inputLabel}</PaneLabel>
					<div className="space-y-4">
						<div className="space-y-1.5">
							<Label htmlFor="document-patient">{content.patientLabel}</Label>
							<Input id="document-patient" onChange={handlePatientChange} value={patient} />
						</div>
						<div className="space-y-1.5">
							<Label htmlFor="document-diagnosis">{content.diagnosisLabel}</Label>
							<Input id="document-diagnosis" onChange={handleDiagnosisChange} value={diagnosis} />
						</div>
						<div className="flex items-center gap-2 rounded-md border bg-background p-3">
							<Checkbox
								checked={hasConsent}
								id="document-consent"
								onCheckedChange={handleConsentChange}
							/>
							<Label className="text-xs leading-tight" htmlFor="document-consent">
								{content.consentLabel}
							</Label>
						</div>
					</div>
				</div>
				<div className="bg-muted/10 p-5 lg:p-6">
					<PaneLabel>{content.previewLabel}</PaneLabel>
					<div
						className="mx-auto flex min-h-[19rem] max-w-[15rem] flex-col border bg-solarized-base3 p-5 text-solarized-base03 shadow-xl"
						data-document-preview
					>
						<div className="border-solarized-base1 border-b pb-3">
							<p className="font-bold text-sm tracking-tight">{content.documentTitle}</p>
							<p className="mt-1 font-mono text-[0.55rem] text-solarized-base01">
								{content.documentMeta}
							</p>
						</div>
						<div className="mt-5 space-y-4 text-xs">
							<div>
								<p className="font-mono text-[0.55rem] text-solarized-base01 uppercase tracking-wider">
									{content.patientLabel}
								</p>
								<p className="mt-1 min-h-5 border-solarized-base1 border-b font-medium">
									{patient || "—"}
								</p>
							</div>
							<div>
								<p className="font-mono text-[0.55rem] text-solarized-base01 uppercase tracking-wider">
									{content.diagnosisLabel}
								</p>
								<p className="mt-1 min-h-5 border-solarized-base1 border-b font-medium">
									{diagnosis || "—"}
								</p>
							</div>
							<div className="flex items-center gap-2">
								<span className="flex size-4 items-center justify-center border border-solarized-base01">
									{hasConsent && <Check className="size-3" />}
								</span>
								{content.consentLabel}
							</div>
						</div>
						<p className="mt-auto border-solarized-base1 border-t pt-3 font-mono text-[0.55rem] text-solarized-base01">
							{content.signatureLabel}
						</p>
					</div>
				</div>
			</div>
		</DemoFrame>
	);
};

interface FeatureVisualProps {
	featureId: FeatureId;
	onTemplateChange: (data: Record<string, unknown>) => void;
	templateValues: Record<string, unknown>;
}

const FeatureVisual = ({ featureId, onTemplateChange, templateValues }: FeatureVisualProps) => {
	if (featureId === "template") {
		return <TemplateDemo onChange={onTemplateChange} values={templateValues} />;
	}

	if (featureId === "score") {
		return <ScoreDemo />;
	}

	if (featureId === "ai") {
		return <AiDemo />;
	}

	if (featureId === "document") {
		return <DocumentDemo />;
	}

	return <MarkdownDemo />;
};

export const Features = () => {
	const [activeFeature, setActiveFeature] = useState<FeatureId>("markdown");
	const [templateValues, setTemplateValues] = useState<Record<string, unknown>>({});
	const activeVisualRef = useRef<HTMLDivElement>(null);
	const featureGridRef = useRef<HTMLDivElement>(null);
	const showcaseRef = useRef<HTMLElement>(null);
	const stickyRailRef = useRef<HTMLDivElement>(null);

	const handleTemplateChange = useCallback((data: Record<string, unknown>) => {
		setTemplateValues(data);
	}, []);

	useEffect(() => {
		const steps = [
			...(showcaseRef.current?.querySelectorAll<HTMLElement>("[data-feature-step]") ?? []),
		];
		const [firstStep] = steps;
		if (!firstStep) {
			return;
		}

		let animationFrameId: number | null = null;

		const updateActiveFeature = () => {
			animationFrameId = null;
			const activationPoint = window.innerHeight * 0.56;
			let closestStep = firstStep;
			let closestDistance = Number.POSITIVE_INFINITY;

			for (const step of steps) {
				const rect = step.getBoundingClientRect();
				const distance = Math.abs(rect.top + rect.height / 2 - activationPoint);
				if (distance < closestDistance) {
					closestDistance = distance;
					closestStep = step;
				}
			}

			const featureId = closestStep?.dataset.featureStep;
			if (FEATURE_IDS.includes(featureId as FeatureId)) {
				setActiveFeature(featureId as FeatureId);
			}
		};

		const handleViewportChange = () => {
			if (animationFrameId !== null) {
				return;
			}
			animationFrameId = window.requestAnimationFrame(updateActiveFeature);
		};

		updateActiveFeature();
		window.addEventListener("resize", handleViewportChange);
		window.addEventListener("scroll", handleViewportChange, { passive: true });

		return () => {
			window.removeEventListener("resize", handleViewportChange);
			window.removeEventListener("scroll", handleViewportChange);
			if (animationFrameId !== null) {
				window.cancelAnimationFrame(animationFrameId);
			}
		};
	}, []);

	useEffect(() => {
		const featureGrid = featureGridRef.current;
		const stickyRail = stickyRailRef.current;
		const activeVisual = activeVisualRef.current;
		const preview = activeVisual?.firstElementChild;
		const progress = activeVisual?.nextElementSibling;
		const documentStep = featureGrid?.querySelector<HTMLElement>('[data-feature-step="document"]');
		const heading = documentStep?.querySelector<HTMLElement>("[data-feature-heading]");
		const copyEnd = documentStep?.querySelector<HTMLElement>("[data-feature-copy-end]");

		if (!(featureGrid && stickyRail && activeVisual && preview instanceof HTMLElement)) {
			return;
		}

		let animationFrameId: number | null = null;
		const updateReleaseRunway = () => {
			animationFrameId = null;
			if (!window.matchMedia("(min-width: 64rem)").matches) {
				featureGrid.style.removeProperty("--feature-release-runway");
				stickyRail.style.removeProperty("top");
				return;
			}

			const previewRect = preview.getBoundingClientRect();
			const progressTail =
				progress instanceof HTMLElement
					? progress.offsetTop + progress.offsetHeight - preview.offsetHeight
					: 0;
			const stickyTopInset = 6 * 16;
			const availableRailHeight = window.innerHeight - stickyTopInset - 16;
			const stickyTop =
				stickyTopInset + Math.max(0, (availableRailHeight - previewRect.height - progressTail) / 2);
			stickyRail.style.setProperty("top", `${stickyTop}px`);

			if (!(activeFeature === "document" && documentStep && heading && copyEnd)) {
				return;
			}

			const gridRect = featureGrid.getBoundingClientRect();
			const stickyRect = stickyRail.getBoundingClientRect();
			const headingRect = heading.getBoundingClientRect();
			const copyEndRect = copyEnd.getBoundingClientRect();
			const currentRunway =
				Number.parseFloat(featureGrid.style.getPropertyValue("--feature-release-runway")) || 0;

			const restingPreviewTop = stickyTop + previewRect.top - stickyRect.top;
			const restingPreviewBottom = restingPreviewTop + previewRect.height;
			const restingRailBottom = stickyTop + stickyRect.height;
			const gridBottomWithoutRunway = gridRect.bottom - currentRunway;
			const topAlignmentRunway =
				restingRailBottom - restingPreviewTop - (gridBottomWithoutRunway - headingRect.top);
			const bottomAlignmentRunway =
				restingRailBottom - restingPreviewBottom - (gridBottomWithoutRunway - copyEndRect.bottom);
			const releaseRunway = Math.max(0, topAlignmentRunway, bottomAlignmentRunway);

			featureGrid.style.setProperty("--feature-release-runway", `${releaseRunway}px`);
		};
		const scheduleReleaseRunwayUpdate = () => {
			if (animationFrameId === null) {
				animationFrameId = window.requestAnimationFrame(updateReleaseRunway);
			}
		};
		const resizeObserver = new ResizeObserver(scheduleReleaseRunwayUpdate);

		resizeObserver.observe(stickyRail);
		resizeObserver.observe(preview);
		if (progress instanceof HTMLElement) {
			resizeObserver.observe(progress);
		}
		if (documentStep) {
			resizeObserver.observe(documentStep);
		}
		activeVisual.addEventListener("animationend", scheduleReleaseRunwayUpdate);
		window.addEventListener("resize", scheduleReleaseRunwayUpdate);
		scheduleReleaseRunwayUpdate();

		return () => {
			resizeObserver.disconnect();
			activeVisual.removeEventListener("animationend", scheduleReleaseRunwayUpdate);
			window.removeEventListener("resize", scheduleReleaseRunwayUpdate);
			if (animationFrameId !== null) {
				window.cancelAnimationFrame(animationFrameId);
			}
		};
	}, [activeFeature]);

	const visualProps = {
		onTemplateChange: handleTemplateChange,
		templateValues,
	};

	return (
		<section
			className="relative scroll-mt-16 border-b px-5 py-24 sm:px-8 lg:px-10 lg:py-32"
			id="markdown"
			ref={showcaseRef}
		>
			<div className="mx-auto w-full max-w-7xl">
				<div className="max-w-3xl">
					<p className="font-mono text-solarized-orange text-xs tracking-[0.14em]">
						{CONTENT.eyebrow}
					</p>
					<h2 className="mt-4 text-balance font-bold text-4xl leading-tight tracking-[-0.035em] sm:text-5xl lg:text-6xl">
						{CONTENT.title}
					</h2>
					<p className="mt-5 max-w-2xl font-sans text-lg text-muted-foreground leading-relaxed sm:text-xl">
						{CONTENT.description}
					</p>
				</div>

				<div
					className="mt-16 grid gap-10 lg:grid-cols-[minmax(18rem,0.7fr)_minmax(0,1.3fr)] lg:gap-16"
					ref={featureGridRef}
				>
					<div className="min-w-0">
						{FEATURE_IDS.map((featureId) => {
							const step = CONTENT.steps[featureId];
							const Icon = FEATURE_ICONS[featureId];

							return (
								<article
									className={`flex min-h-[70svh] min-w-0 scroll-mt-24 flex-col justify-center py-12 lg:min-h-0 lg:justify-start lg:py-0 ${
										featureId === "document"
											? "lg:mb-[var(--feature-release-runway)]"
											: "lg:mb-[32vh]"
									}`}
									data-feature-step={featureId}
									id={`feature-${featureId}`}
									key={featureId}
								>
									<div className="mb-5 flex items-center gap-4">
										<span className="font-mono text-solarized-blue text-sm">{step.number}</span>
										<span className="h-px w-10 bg-border" />
										<Icon className="size-4 text-muted-foreground" />
										<span className="font-mono text-muted-foreground text-xs tracking-[0.12em]">
											{step.label}
										</span>
									</div>
									<h3
										className="max-w-lg font-semibold text-3xl leading-tight tracking-[-0.025em] sm:text-4xl"
										data-feature-heading
									>
										{step.title}
									</h3>
									<p
										className="mt-5 max-w-lg font-sans text-lg text-muted-foreground leading-relaxed"
										data-feature-copy-end={step.detail ? undefined : true}
									>
										{step.description}
									</p>
									{step.detail && (
										<p
											className="mt-5 border-l-2 border-solarized-blue pl-4 font-medium text-sm leading-relaxed"
											data-feature-copy-end
										>
											{step.detail}
										</p>
									)}

									<div className="mt-10 min-w-0 lg:hidden">
										<FeatureVisual featureId={featureId} {...visualProps} />
									</div>
								</article>
							);
						})}
					</div>

					<div className="hidden lg:block">
						<div className="sticky top-24 w-full" ref={stickyRailRef}>
							<div
								className="animate-in fade-in slide-in-from-bottom-2 duration-500 motion-reduce:animate-none"
								data-active-feature={activeFeature}
								key={activeFeature}
								ref={activeVisualRef}
							>
								<FeatureVisual featureId={activeFeature} {...visualProps} />
							</div>
							<div
								aria-hidden="true"
								className="absolute top-0 bottom-0 left-full ml-5 flex flex-col justify-center gap-2"
								data-feature-progress
							>
								{FEATURE_IDS.map((featureId) => (
									<span
										className={`w-1 rounded-full transition-all duration-300 motion-reduce:transition-none ${
											activeFeature === featureId ? "h-8 bg-solarized-blue" : "h-2 bg-border"
										}`}
										key={featureId}
									/>
								))}
							</div>
						</div>
					</div>
				</div>
			</div>
		</section>
	);
};
