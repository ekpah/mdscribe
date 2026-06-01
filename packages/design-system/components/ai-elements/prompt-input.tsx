"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { DropdownMenuItem } from "@repo/design-system/components/ui/dropdown-menu";
import {
	InputGroup,
	InputGroupAddon,
	InputGroupButton,
	InputGroupTextarea,
} from "@repo/design-system/components/ui/input-group";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@repo/design-system/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@repo/design-system/components/ui/tooltip";
import { cn } from "@repo/design-system/lib/utils";
import type { ChatStatus, FileUIPart } from "ai";
import {
	ImageIcon,
	Loader2Icon,
	MicIcon,
	PaperclipIcon,
	SendIcon,
	SquareIcon,
	XIcon,
} from "lucide-react";
import { nanoid } from "nanoid";
import Image from "next/image";
import {
	Children,
	createContext,
	Fragment,
	useCallback,
	useContext,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import type {
	ChangeEvent,
	ChangeEventHandler,
	ClipboardEventHandler,
	ComponentProps,
	FormEvent,
	FormEventHandler,
	HTMLAttributes,
	KeyboardEventHandler,
	PropsWithChildren,
	ReactNode,
	RefObject,
} from "react";
// ============================================================================
// Provider Context & Types
// ============================================================================

interface AttachmentsContext {
	files: (FileUIPart & { id: string })[];
	add: (files: File[] | FileList) => void;
	remove: (id: string) => void;
	clear: () => void;
	openFileDialog: () => void;
	fileInputRef: RefObject<HTMLInputElement | null>;
}

interface TextInputContext {
	value: string;
	setInput: (v: string) => void;
	clear: () => void;
}

interface PromptInputController {
	textInput: TextInputContext;
	attachments: AttachmentsContext;
	/** INTERNAL: Allows PromptInput to register its file textInput + "open" callback */
	__registerFileInput: (ref: RefObject<HTMLInputElement | null>, open: () => void) => void;
}

const PromptInputContext = createContext<PromptInputController | null>(null);
const ProviderAttachmentsContext = createContext<AttachmentsContext | null>(null);

export const usePromptInputController = () => {
	const ctx = useContext(PromptInputContext);
	if (!ctx) {
		throw new Error(
			"Wrap your component inside <PromptInputProvider> to use usePromptInputController().",
		);
	}
	return ctx;
};

// Optional variants (do NOT throw). Useful for dual-mode components.
const useOptionalPromptInputController = () => useContext(PromptInputContext);

export const useProviderAttachments = () => {
	const ctx = useContext(ProviderAttachmentsContext);
	if (!ctx) {
		throw new Error(
			"Wrap your component inside <PromptInputProvider> to use useProviderAttachments().",
		);
	}
	return ctx;
};

const useOptionalProviderAttachments = () => useContext(ProviderAttachmentsContext);

type PromptInputProviderProps = PropsWithChildren<{
	initialInput?: string;
}>;

/**
 * Optional global provider that lifts PromptInput state outside of PromptInput.
 * If you don't use it, PromptInput stays fully self-managed.
 */
export const PromptInputProvider = ({
	initialInput: initialTextInput = "",
	children,
}: PromptInputProviderProps) => {
	// ----- textInput state
	const [textInput, setTextInput] = useState(initialTextInput);
	const clearInput = useCallback(() => setTextInput(""), []);

	// ----- attachments state (global when wrapped)
	const [attachements, setAttachements] = useState<(FileUIPart & { id: string })[]>([]);
	const fileInputRef = useRef<HTMLInputElement | null>(null);
	const openRef = useRef<(() => void) | null>(null);

	const add = useCallback((files: File[] | FileList) => {
		const incoming = [...files];
		if (incoming.length === 0) {
			return;
		}

		setAttachements((prev) => [
			...prev,
			...incoming.map((file) => ({
				filename: file.name,
				id: nanoid(),
				mediaType: file.type,
				type: "file" as const,
				url: URL.createObjectURL(file),
			})),
		]);
	}, []);

	const remove = useCallback((id: string) => {
		setAttachements((prev) => {
			const found = prev.find((f) => f.id === id);
			if (found?.url) {
				URL.revokeObjectURL(found.url);
			}
			return prev.filter((f) => f.id !== id);
		});
	}, []);

	const clear = useCallback(() => {
		setAttachements((prev) => {
			for (const f of prev) {
				if (f.url) {
					URL.revokeObjectURL(f.url);
				}
			}
			return [];
		});
	}, []);

	const openFileDialog = useCallback(() => {
		openRef.current?.();
	}, []);

	const attachments = useMemo<AttachmentsContext>(
		() => ({
			add,
			clear,
			fileInputRef,
			files: attachements,
			openFileDialog,
			remove,
		}),
		[attachements, add, remove, clear, openFileDialog],
	);

	const __registerFileInput = useCallback(
		(ref: RefObject<HTMLInputElement | null>, open: () => void) => {
			fileInputRef.current = ref.current;
			openRef.current = open;
		},
		[],
	);

	const controller = useMemo<PromptInputController>(
		() => ({
			__registerFileInput,
			attachments,
			textInput: {
				clear: clearInput,
				setInput: setTextInput,
				value: textInput,
			},
		}),
		[textInput, clearInput, attachments, __registerFileInput],
	);

	return (
		<PromptInputContext.Provider value={controller}>
			<ProviderAttachmentsContext.Provider value={attachments}>
				{children}
			</ProviderAttachmentsContext.Provider>
		</PromptInputContext.Provider>
	);
};

// ============================================================================
// Component Context & Hooks
// ============================================================================

const LocalAttachmentsContext = createContext<AttachmentsContext | null>(null);

const usePromptInputAttachments = () => {
	// Dual-mode: prefer provider if present, otherwise use local
	const provider = useOptionalProviderAttachments();
	const local = useContext(LocalAttachmentsContext);
	const context = provider ?? local;
	if (!context) {
		throw new Error(
			"usePromptInputAttachments must be used within a PromptInput or PromptInputProvider",
		);
	}
	return context;
};

type PromptInputAttachmentProps = HTMLAttributes<HTMLDivElement> & {
	data: FileUIPart & { id: string };
	className?: string;
};

export const PromptInputAttachment = ({
	data,
	className,
	...props
}: PromptInputAttachmentProps) => {
	const attachments = usePromptInputAttachments();
	const handleRemoveAttachment = useCallback(() => {
		attachments.remove(data.id);
	}, [attachments, data.id]);

	const mediaType = data.mediaType?.startsWith("image/") && data.url ? "image" : "file";

	return (
		<div
			className={cn(
				"group relative h-14 w-14 rounded-md border",
				className,
				mediaType === "image" ? "h-14 w-14" : "h-8 w-auto max-w-full",
			)}
			key={data.id}
			{...props}
		>
			{mediaType === "image" ? (
				<Image
					alt={data.filename || "attachment"}
					className="size-full rounded-md object-cover"
					height={56}
					src={data.url}
					width={56}
				/>
			) : (
				<div className="flex size-full max-w-full cursor-pointer items-center justify-start gap-2 overflow-hidden px-2 text-muted-foreground">
					<PaperclipIcon className="size-4 shrink-0" />
					<Tooltip delayDuration={400}>
						<TooltipTrigger className="min-w-0 flex-1">
							<h4 className="w-full truncate text-left font-medium text-sm">
								{data.filename || "Unknown file"}
							</h4>
						</TooltipTrigger>
						<TooltipContent>
							<div className="text-muted-foreground text-xs">
								<h4 className="max-w-[240px] overflow-hidden whitespace-normal break-words text-left font-semibold text-sm">
									{data.filename || "Unknown file"}
								</h4>
								{data.mediaType && <div>{data.mediaType}</div>}
							</div>
						</TooltipContent>
					</Tooltip>
				</div>
			)}
			<Button
				aria-label="Remove attachment"
				className="-right-1.5 -top-1.5 absolute h-6 w-6 rounded-full opacity-0 group-hover:opacity-100"
				onClick={handleRemoveAttachment}
				size="icon"
				type="button"
				variant="outline"
			>
				<XIcon className="h-3 w-3" />
			</Button>
		</div>
	);
};

type PromptInputAttachmentsProps = Omit<HTMLAttributes<HTMLDivElement>, "children"> & {
	children: (attachment: FileUIPart & { id: string }) => ReactNode;
};

export const PromptInputAttachments = ({
	className,
	children,
	...props
}: PromptInputAttachmentsProps) => {
	const attachments = usePromptInputAttachments();
	const [height, setHeight] = useState(0);
	const contentRef = useRef<HTMLDivElement>(null);

	useLayoutEffect(() => {
		const el = contentRef.current;
		if (!el) {
			return;
		}
		const ro = new ResizeObserver(() => {
			setHeight(el.getBoundingClientRect().height);
		});
		ro.observe(el);
		setHeight(el.getBoundingClientRect().height);
		return () => ro.disconnect();
	}, []);

	// biome-ignore lint/correctness/useExhaustiveDependencies: Force height measurement when attachments change
	useLayoutEffect(() => {
		const el = contentRef.current;
		if (!el) {
			return;
		}
		setHeight(el.getBoundingClientRect().height);
	}, [attachments.files.length]);

	if (attachments.files.length === 0) {
		return null;
	}

	return (
		<InputGroupAddon
			align="block-start"
			aria-live="polite"
			className={cn("overflow-hidden transition-[height] duration-200 ease-out", className)}
			style={{ height: attachments.files.length ? height : 0 }}
			{...props}
		>
			<div className="space-y-2 py-1" ref={contentRef}>
				<div className="flex flex-wrap gap-2">
					{attachments.files
						.filter((f) => !(f.mediaType?.startsWith("image/") && f.url))
						.map((file) => (
							<Fragment key={file.id}>{children(file)}</Fragment>
						))}
				</div>
				<div className="flex flex-wrap gap-2">
					{attachments.files
						.filter((f) => f.mediaType?.startsWith("image/") && f.url)
						.map((file) => (
							<Fragment key={file.id}>{children(file)}</Fragment>
						))}
				</div>
			</div>
		</InputGroupAddon>
	);
};

type PromptInputActionAddAttachmentsProps = ComponentProps<typeof DropdownMenuItem> & {
	label?: string;
};

export const PromptInputActionAddAttachments = ({
	label = "Add photos or files",
	...props
}: PromptInputActionAddAttachmentsProps) => {
	const attachments = usePromptInputAttachments();
	const handleSelect = useCallback(
		(event: Event) => {
			event.preventDefault();
			attachments.openFileDialog();
		},
		[attachments],
	);

	return (
		<DropdownMenuItem {...props} onSelect={handleSelect}>
			<ImageIcon className="mr-2 size-4" /> {label}
		</DropdownMenuItem>
	);
};

interface PromptInputMessage {
	text?: string;
	files?: FileUIPart[];
}

type PromptInputProps = Omit<HTMLAttributes<HTMLFormElement>, "onSubmit"> & {
	// e.g., "image/*" or leave undefined for any
	accept?: string;
	multiple?: boolean;
	// When true, accepts drops anywhere on document. Default false (opt-in).
	globalDrop?: boolean;
	// Render a hidden input with given name and keep it in sync for native form posts. Default false.
	syncHiddenInput?: boolean;
	// Minimal constraints
	maxFiles?: number;
	// bytes
	maxFileSize?: number;
	onError?: (err: { code: "max_files" | "max_file_size" | "accept"; message: string }) => void;
	onSubmit: (
		message: PromptInputMessage,
		event: FormEvent<HTMLFormElement>,
	) => void | Promise<void>;
};

export const PromptInput = ({
	className,
	accept,
	multiple,
	globalDrop,
	syncHiddenInput,
	maxFiles,
	maxFileSize,
	onError,
	onSubmit,
	children,
	...props
}: PromptInputProps) => {
	// Try to use a provider controller if present
	const controller = useOptionalPromptInputController();
	const usingProvider = !!controller;

	// Refs
	const inputRef = useRef<HTMLInputElement | null>(null);
	const anchorRef = useRef<HTMLSpanElement>(null);
	const formRef = useRef<HTMLFormElement | null>(null);

	// Find nearest form to scope drag & drop
	useEffect(() => {
		const root = anchorRef.current?.closest("form");
		if (root instanceof HTMLFormElement) {
			formRef.current = root;
		}
	}, []);

	// ----- Local attachments (only used when no provider)
	const [items, setItems] = useState<(FileUIPart & { id: string })[]>([]);
	const files = usingProvider ? controller.attachments.files : items;

	const openFileDialogLocal = useCallback(() => {
		inputRef.current?.click();
	}, []);

	const matchesAccept = useCallback(
		(f: File) => {
			if (!accept || accept.trim() === "") {
				return true;
			}
			if (accept.includes("image/*")) {
				return f.type.startsWith("image/");
			}
			// NOTE: keep simple; expand as needed
			return true;
		},
		[accept],
	);

	const addLocal = useCallback(
		(fileList: File[] | FileList) => {
			const incoming = [...fileList];
			const accepted = incoming.filter((f) => matchesAccept(f));
			if (incoming.length && accepted.length === 0) {
				onError?.({
					code: "accept",
					message: "No files match the accepted types.",
				});
				return;
			}
			const withinSize = (f: File) => (maxFileSize ? f.size <= maxFileSize : true);
			const sized = accepted.filter(withinSize);
			if (accepted.length > 0 && sized.length === 0) {
				onError?.({
					code: "max_file_size",
					message: "All files exceed the maximum size.",
				});
				return;
			}

			setItems((prev) => {
				const capacity =
					typeof maxFiles === "number" ? Math.max(0, maxFiles - prev.length) : undefined;
				const capped = typeof capacity === "number" ? sized.slice(0, capacity) : sized;
				if (typeof capacity === "number" && sized.length > capacity) {
					onError?.({
						code: "max_files",
						message: "Too many files. Some were not added.",
					});
				}
				const next: (FileUIPart & { id: string })[] = [];
				for (const file of capped) {
					next.push({
						filename: file.name,
						id: nanoid(),
						mediaType: file.type,
						type: "file",
						url: URL.createObjectURL(file),
					});
				}
				return [...prev, ...next];
			});
		},
		[matchesAccept, maxFiles, maxFileSize, onError],
	);

	const removeLocal = useCallback((id: string) => {
		setItems((prev) => {
			const found = prev.find((file) => file.id === id);
			if (found?.url) {
				URL.revokeObjectURL(found.url);
			}
			return prev.filter((file) => file.id !== id);
		});
	}, []);

	const clearLocal = useCallback(() => {
		setItems((prev) => {
			for (const file of prev) {
				if (file.url) {
					URL.revokeObjectURL(file.url);
				}
			}
			return [];
		});
	}, []);

	const add = useCallback(
		(incomingFiles: File[] | FileList) => {
			if (usingProvider && controller) {
				controller.attachments.add(incomingFiles);
				return;
			}
			addLocal(incomingFiles);
		},
		[addLocal, controller, usingProvider],
	);

	const remove = useCallback(
		(id: string) => {
			if (usingProvider && controller) {
				controller.attachments.remove(id);
				return;
			}
			removeLocal(id);
		},
		[controller, removeLocal, usingProvider],
	);

	const clear = useCallback(() => {
		if (usingProvider && controller) {
			controller.attachments.clear();
			return;
		}
		clearLocal();
	}, [clearLocal, controller, usingProvider]);

	const openFileDialog = useCallback(() => {
		if (usingProvider && controller) {
			controller.attachments.openFileDialog();
			return;
		}
		openFileDialogLocal();
	}, [controller, openFileDialogLocal, usingProvider]);

	// Let provider know about our hidden file input so external menus can call openFileDialog()
	useEffect(() => {
		if (!usingProvider) {
			return;
		}
		controller.__registerFileInput(inputRef, () => inputRef.current?.click());
	}, [usingProvider, controller]);

	// Note: File input cannot be programmatically set for security reasons
	// The syncHiddenInput prop is no longer functional
	useEffect(() => {
		if (syncHiddenInput && inputRef.current && files.length === 0) {
			inputRef.current.value = "";
		}
	}, [files, syncHiddenInput]);

	// Attach drop handlers on nearest form and document (opt-in)
	useEffect(() => {
		const form = formRef.current;
		if (!form) {
			return;
		}

		const onDragOver = (e: DragEvent) => {
			if (e.dataTransfer?.types?.includes("Files")) {
				e.preventDefault();
			}
		};
		const onDrop = (e: DragEvent) => {
			if (e.dataTransfer?.types?.includes("Files")) {
				e.preventDefault();
			}
			if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
				add(e.dataTransfer.files);
			}
		};
		form.addEventListener("dragover", onDragOver);
		form.addEventListener("drop", onDrop);
		return () => {
			form.removeEventListener("dragover", onDragOver);
			form.removeEventListener("drop", onDrop);
		};
	}, [add]);

	useEffect(() => {
		if (!globalDrop) {
			return;
		}

		const onDragOver = (e: DragEvent) => {
			if (e.dataTransfer?.types?.includes("Files")) {
				e.preventDefault();
			}
		};
		const onDrop = (e: DragEvent) => {
			if (e.dataTransfer?.types?.includes("Files")) {
				e.preventDefault();
			}
			if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
				add(e.dataTransfer.files);
			}
		};
		document.addEventListener("dragover", onDragOver);
		document.addEventListener("drop", onDrop);
		return () => {
			document.removeEventListener("dragover", onDragOver);
			document.removeEventListener("drop", onDrop);
		};
	}, [add, globalDrop]);

	useEffect(
		() => () => {
			if (!usingProvider) {
				for (const f of files) {
					if (f.url) {
						URL.revokeObjectURL(f.url);
					}
				}
			}
		},
		[usingProvider, files],
	);

	const handleChange: ChangeEventHandler<HTMLInputElement> = useCallback(
		(event) => {
			if (event.currentTarget.files) {
				add(event.currentTarget.files);
			}
		},
		[add],
	);

	const convertBlobUrlToDataUrl = useCallback(async (url: string): Promise<string> => {
		const response = await fetch(url);
		const blob = await response.blob();
		const bytes = new Uint8Array(await blob.arrayBuffer());
		let binary = "";
		for (const byte of bytes) {
			binary += String.fromCodePoint(byte);
		}
		const base64 = btoa(binary);
		return `data:${blob.type || "application/octet-stream"};base64,${base64}`;
	}, []);

	const ctx = useMemo<AttachmentsContext>(
		() => ({
			add,
			clear,
			fileInputRef: inputRef,
			files: files.map((item) => ({ ...item, id: item.id })),
			openFileDialog,
			remove,
		}),
		[files, add, remove, clear, openFileDialog],
	);

	const handleSubmit: FormEventHandler<HTMLFormElement> = useCallback(
		(event) => {
			event.preventDefault();

			const form = event.currentTarget;
			const text = usingProvider
				? controller.textInput.value
				: (() => {
						const formData = new FormData(form);
						return (formData.get("message") as string) || "";
					})();

			// Reset form immediately after capturing text to avoid race condition
			// where user input during async blob conversion would be lost
			if (!usingProvider) {
				form.reset();
			}

			const run = async () => {
				try {
					const convertedFiles: FileUIPart[] = await Promise.all(
						files.map(async ({ id: _id, ...item }) => {
							if (!item.url?.startsWith("blob:")) {
								return item;
							}

							return {
								...item,
								url: await convertBlobUrlToDataUrl(item.url),
							};
						}),
					);

					await onSubmit({ files: convertedFiles, text }, event);
					clear();
					if (usingProvider) {
						controller.textInput.clear();
					}
				} catch {
					// Don't clear on error - user may want to retry
				}
			};
			run();
		},
		[clear, controller, convertBlobUrlToDataUrl, files, onSubmit, usingProvider],
	);

	// Render with or without local provider
	const inner = (
		<>
			<span aria-hidden="true" className="hidden" ref={anchorRef} />
			<input
				accept={accept}
				aria-label="Upload files"
				className="hidden"
				multiple={multiple}
				onChange={handleChange}
				ref={inputRef}
				title="Upload files"
				type="file"
			/>
			<form className={cn("w-full", className)} onSubmit={handleSubmit} {...props}>
				<InputGroup>{children}</InputGroup>
			</form>
		</>
	);

	return usingProvider ? (
		inner
	) : (
		<LocalAttachmentsContext.Provider value={ctx}>{inner}</LocalAttachmentsContext.Provider>
	);
};

type PromptInputBodyProps = HTMLAttributes<HTMLDivElement>;

export const PromptInputBody = ({ className, ...props }: PromptInputBodyProps) => (
	<div className={cn("contents", className)} {...props} />
);

type PromptInputTextareaProps = ComponentProps<typeof InputGroupTextarea>;

export const PromptInputTextarea = ({
	onChange,
	className,
	placeholder = "What would you like to know?",
	...props
}: PromptInputTextareaProps) => {
	const controller = useOptionalPromptInputController();
	const attachments = usePromptInputAttachments();

	const handleKeyDown: KeyboardEventHandler<HTMLTextAreaElement> = useCallback((e) => {
		if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
			if (e.nativeEvent.isComposing) {
				return;
			}
			if (e.shiftKey) {
				return;
			}
			e.preventDefault();
			e.currentTarget.form?.requestSubmit();
		}
	}, []);

	const handlePaste: ClipboardEventHandler<HTMLTextAreaElement> = useCallback(
		(event) => {
			const items = event.clipboardData?.items;

			if (!items) {
				return;
			}

			const files: File[] = [];

			for (const item of items) {
				if (item.kind === "file") {
					const file = item.getAsFile();
					if (file) {
						files.push(file);
					}
				}
			}

			if (files.length > 0) {
				event.preventDefault();
				attachments.add(files);
			}
		},
		[attachments],
	);

	const controlledProps = controller
		? {
				onChange: (e: ChangeEvent<HTMLTextAreaElement>) => {
					controller.textInput.setInput(e.currentTarget.value);
					onChange?.(e);
				},
				value: controller.textInput.value,
			}
		: {
				onChange,
			};

	return (
		<InputGroupTextarea
			className={cn("field-sizing-content max-h-48 min-h-16", className)}
			name="message"
			onKeyDown={handleKeyDown}
			onPaste={handlePaste}
			placeholder={placeholder}
			{...props}
			{...controlledProps}
		/>
	);
};

type PromptInputButtonProps = ComponentProps<typeof InputGroupButton>;

const PromptInputButton = ({
	variant = "ghost",
	className,
	size,
	...props
}: PromptInputButtonProps) => {
	const newSize = size ?? (Children.count(props.children) > 1 ? "sm" : "icon-sm");

	return (
		<InputGroupButton
			className={cn(className)}
			size={newSize}
			type="button"
			variant={variant}
			{...props}
		/>
	);
};

type PromptInputSubmitProps = ComponentProps<typeof InputGroupButton> & {
	status?: ChatStatus;
};

export const PromptInputSubmit = ({
	className,
	variant = "default",
	size = "icon-sm",
	status,
	children,
	...props
}: PromptInputSubmitProps) => {
	let Icon = <SendIcon className="size-4" />;

	if (status === "submitted") {
		Icon = <Loader2Icon className="size-4 animate-spin" />;
	} else if (status === "streaming") {
		Icon = <SquareIcon className="size-4" />;
	} else if (status === "error") {
		Icon = <XIcon className="size-4" />;
	}

	return (
		<InputGroupButton
			aria-label="Submit"
			className={cn(className)}
			size={size}
			type="submit"
			variant={variant}
			{...props}
		>
			{children ?? Icon}
		</InputGroupButton>
	);
};

interface SpeechRecognition extends EventTarget {
	continuous: boolean;
	interimResults: boolean;
	lang: string;
	start(): void;
	stop(): void;
	onstart: ((this: SpeechRecognition, ev: Event) => void) | null;
	onend: ((this: SpeechRecognition, ev: Event) => void) | null;
	onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => void) | null;
	onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => void) | null;
}

interface SpeechRecognitionEvent extends Event {
	results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
	readonly length: number;
	item(index: number): SpeechRecognitionResult;
	[index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
	readonly length: number;
	item(index: number): SpeechRecognitionAlternative;
	[index: number]: SpeechRecognitionAlternative;
	isFinal: boolean;
}

interface SpeechRecognitionAlternative {
	transcript: string;
	confidence: number;
}

const toSpeechRecognitionResults = (
	results: SpeechRecognitionResultList,
): SpeechRecognitionResult[] => {
	const collectedResults: SpeechRecognitionResult[] = [];
	let index = 0;
	while (index < results.length) {
		collectedResults.push(results[index]);
		index += 1;
	}
	return collectedResults;
};

interface SpeechRecognitionErrorEvent extends Event {
	error: string;
}

declare global {
	interface Window {
		SpeechRecognition: new () => SpeechRecognition;
		webkitSpeechRecognition: new () => SpeechRecognition;
	}
}

type PromptInputSpeechButtonProps = ComponentProps<typeof PromptInputButton> & {
	textareaRef?: RefObject<HTMLTextAreaElement | null>;
	onTranscriptionChange?: (text: string) => void;
};

export const PromptInputSpeechButton = ({
	className,
	textareaRef,
	onTranscriptionChange,
	...props
}: PromptInputSpeechButtonProps) => {
	const [isListening, setIsListening] = useState(false);
	const [recognition, setRecognition] = useState<SpeechRecognition | null>(null);
	const recognitionRef = useRef<SpeechRecognition | null>(null);

	useEffect(() => {
		if (
			typeof window !== "undefined" &&
			("SpeechRecognition" in window || "webkitSpeechRecognition" in window)
		) {
			const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
			const speechRecognition = new SpeechRecognition();

			speechRecognition.continuous = true;
			speechRecognition.interimResults = true;
			speechRecognition.lang = "en-US";

			speechRecognition.onstart = () => {
				setIsListening(true);
			};

			speechRecognition.onend = () => {
				setIsListening(false);
			};

			speechRecognition.onresult = (event) => {
				let finalTranscript = "";

				for (const result of toSpeechRecognitionResults(event.results)) {
					if (result.isFinal) {
						finalTranscript += result[0].transcript;
					}
				}

				if (finalTranscript && textareaRef?.current) {
					const textarea = textareaRef.current;
					const currentValue = textarea.value;
					const newValue = currentValue + (currentValue ? " " : "") + finalTranscript;

					textarea.value = newValue;
					textarea.dispatchEvent(new Event("input", { bubbles: true }));
					onTranscriptionChange?.(newValue);
				}
			};

			speechRecognition.addEventListener("error", (event) => {
				const speechErrorEvent = event as Event & { error?: string };
				console.error("Speech recognition error:", speechErrorEvent.error);
				setIsListening(false);
			});

			recognitionRef.current = speechRecognition;
			setRecognition(speechRecognition);
		}

		return () => {
			if (recognitionRef.current) {
				recognitionRef.current.stop();
			}
		};
	}, [textareaRef, onTranscriptionChange]);

	const toggleListening = useCallback(() => {
		if (!recognition) {
			return;
		}

		if (isListening) {
			recognition.stop();
		} else {
			recognition.start();
		}
	}, [recognition, isListening]);

	return (
		<PromptInputButton
			className={cn(
				"relative transition-all duration-200",
				isListening && "animate-pulse bg-accent text-accent-foreground",
				className,
			)}
			disabled={!recognition}
			onClick={toggleListening}
			{...props}
		>
			<MicIcon className="size-4" />
		</PromptInputButton>
	);
};

type PromptInputModelSelectProps = ComponentProps<typeof Select>;

export const PromptInputModelSelect = (props: PromptInputModelSelectProps) => <Select {...props} />;

type PromptInputModelSelectTriggerProps = ComponentProps<typeof SelectTrigger>;

export const PromptInputModelSelectTrigger = ({
	className,
	...props
}: PromptInputModelSelectTriggerProps) => (
	<SelectTrigger
		className={cn(
			"border-none bg-transparent font-medium text-muted-foreground shadow-none transition-colors",
			'hover:bg-accent hover:text-foreground [&[aria-expanded="true"]]:bg-accent [&[aria-expanded="true"]]:text-foreground',
			className,
		)}
		{...props}
	/>
);

type PromptInputModelSelectContentProps = ComponentProps<typeof SelectContent>;

export const PromptInputModelSelectContent = ({
	className,
	...props
}: PromptInputModelSelectContentProps) => <SelectContent className={cn(className)} {...props} />;

type PromptInputModelSelectItemProps = ComponentProps<typeof SelectItem>;

export const PromptInputModelSelectItem = ({
	className,
	...props
}: PromptInputModelSelectItemProps) => <SelectItem className={cn(className)} {...props} />;

type PromptInputModelSelectValueProps = ComponentProps<typeof SelectValue>;

export const PromptInputModelSelectValue = ({
	className,
	...props
}: PromptInputModelSelectValueProps) => <SelectValue className={cn(className)} {...props} />;
