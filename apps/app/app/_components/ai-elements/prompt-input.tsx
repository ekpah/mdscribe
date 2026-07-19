"use client";

import {
	InputGroup,
	InputGroupButton,
	InputGroupTextarea,
} from "@repo/design-system/components/ui/input-group";
import { cn } from "@repo/design-system/lib/utils";
import type { ChatStatus, FileUIPart } from "ai";
import { Loader2Icon, SendIcon, SquareIcon, XIcon } from "lucide-react";
import { nanoid } from "nanoid";
import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import type {
	ChangeEventHandler,
	ClipboardEventHandler,
	ComponentProps,
	FormEvent,
	FormEventHandler,
	HTMLAttributes,
	KeyboardEventHandler,
	RefObject,
} from "react";
// ============================================================================
// Attachment Context & Types
// ============================================================================

interface AttachmentsContext {
	files: (FileUIPart & { id: string })[];
	add: (files: File[] | FileList) => void;
	remove: (id: string) => void;
	clear: () => void;
	openFileDialog: () => void;
	fileInputRef: RefObject<HTMLInputElement | null>;
}

const LocalAttachmentsContext = createContext<AttachmentsContext | null>(null);

const usePromptInputAttachments = () => {
	const context = useContext(LocalAttachmentsContext);
	if (!context) {
		throw new Error("usePromptInputAttachments must be used within a PromptInput");
	}
	return context;
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

	// ----- Attachments
	const [items, setItems] = useState<(FileUIPart & { id: string })[]>([]);
	const files = items;

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

	const add = addLocal;
	const remove = removeLocal;
	const clear = clearLocal;
	const openFileDialog = openFileDialogLocal;

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
			for (const f of files) {
				if (f.url) {
					URL.revokeObjectURL(f.url);
				}
			}
		},
		[files],
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
			const formData = new FormData(form);
			const text = (formData.get("message") as string) || "";

			// Reset form immediately after capturing text to avoid race condition
			// where user input during async blob conversion would be lost
			form.reset();

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
				} catch {
					// Don't clear on error - user may want to retry
				}
			};
			run();
		},
		[clear, convertBlobUrlToDataUrl, files, onSubmit],
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

	return <LocalAttachmentsContext.Provider value={ctx}>{inner}</LocalAttachmentsContext.Provider>;
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

	return (
		<InputGroupTextarea
			className={cn("field-sizing-content max-h-48 min-h-16", className)}
			name="message"
			onChange={onChange}
			onKeyDown={handleKeyDown}
			onPaste={handlePaste}
			placeholder={placeholder}
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
