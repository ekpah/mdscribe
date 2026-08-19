"use client";

import { blobToBase64 } from "@repo/design-system/components/inputs/audio-submission";
import { Button } from "@repo/design-system/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@repo/design-system/components/ui/card";
import { Camera, CheckCircle2, Images, Loader2, TriangleAlert } from "lucide-react";
import Image from "next/image";
import type { ChangeEvent } from "react";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

import type { ContextTransferPayload } from "@/app/_components/context-transfer/types";
import { encryptTransferEnvelope } from "@/lib/context-transfer-crypto";
import { FILL_INPUT_PAYLOAD_LIMITS, formatPayloadBytes } from "@/lib/input-fill-limits";
import { orpc } from "@/lib/orpc";

interface UploadCredentials {
	key: string;
	uploadToken: string;
}

// useSyncExternalStore requires this callback-based subscription contract.
// oxlint-disable-next-line promise/prefer-await-to-callbacks
const subscribeToHash = (callback: () => void) => {
	window.addEventListener("hashchange", callback);
	return () => window.removeEventListener("hashchange", callback);
};

const readCredentials = (hash: string): UploadCredentials | null => {
	const fragment = new URLSearchParams(hash.slice(1));
	const key = fragment.get("key");
	const uploadToken = fragment.get("uploadToken");
	return key && uploadToken ? { key, uploadToken } : null;
};

export const MobileUploadPage = () => {
	const cameraInputRef = useRef<HTMLInputElement>(null);
	const galleryInputRef = useRef<HTMLInputElement>(null);
	const [file, setFile] = useState<File | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [isUploading, setIsUploading] = useState(false);
	const [uploaded, setUploaded] = useState(false);
	const hash = useSyncExternalStore(
		subscribeToHash,
		() => window.location.hash,
		() => "",
	);
	const credentials = useMemo(() => readCredentials(hash), [hash]);
	const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);

	useEffect(
		() => () => {
			if (previewUrl) {
				URL.revokeObjectURL(previewUrl);
			}
		},
		[previewUrl],
	);

	const selectFile = (event: ChangeEvent<HTMLInputElement>) => {
		const nextFile = event.target.files?.[0] ?? null;
		event.target.value = "";
		if (!nextFile) {
			return;
		}
		if (!nextFile.type.startsWith("image/")) {
			setError("Bitte wähle ein Foto aus.");
			return;
		}
		if (nextFile.size > FILL_INPUT_PAYLOAD_LIMITS.maxContextFileBytes) {
			setError(
				`Das Foto ist zu groß. Maximal ${formatPayloadBytes(FILL_INPUT_PAYLOAD_LIMITS.maxContextFileBytes)} sind möglich.`,
			);
			return;
		}
		setError(null);
		setFile(nextFile);
	};

	const upload = async () => {
		if (!(credentials && file)) {
			return;
		}
		setIsUploading(true);
		setError(null);
		try {
			const payload: ContextTransferPayload = {
				audioFiles: [],
				contextFiles: [
					{
						data: await blobToBase64(file),
						mimeType: file.type || "application/octet-stream",
						name: file.name || `foto-${Date.now()}.jpg`,
						size: file.size,
					},
				],
				textContext: {},
				version: 1,
			};
			const { envelope } = await encryptTransferEnvelope(payload, credentials.key);
			await orpc.contextTransfers.uploadMobile.call({
				ciphertext: envelope,
				uploadToken: credentials.uploadToken,
			});
			window.history.replaceState(null, "", window.location.pathname);
			setUploaded(true);
		} catch {
			setError(
				"Das Foto konnte nicht übertragen werden. Der QR-Code ist möglicherweise abgelaufen.",
			);
		} finally {
			setIsUploading(false);
		}
	};

	if (uploaded) {
		return (
			<Card className="mx-4 w-full max-w-md text-left">
				<CardContent className="flex flex-col items-center gap-4 pt-6 text-center">
					<CheckCircle2 className="size-14 text-solarized-green" />
					<div>
						<h1 className="font-semibold text-xl">Foto übertragen</h1>
						<p className="mt-2 text-muted-foreground text-sm">
							Das Foto wird jetzt im Input-Kontext auf deinem anderen Gerät angezeigt.
						</p>
					</div>
				</CardContent>
			</Card>
		);
	}

	return (
		<Card className="mx-4 w-full max-w-md text-left">
			<CardHeader>
				<CardTitle>Foto übertragen</CardTitle>
				<CardDescription>
					Nimm ein Foto auf oder wähle eines aus deiner Galerie. Eine Anmeldung ist nicht nötig.
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-4">
				{credentials ? (
					<>
						<input
							accept="image/*"
							capture="environment"
							className="hidden"
							onChange={selectFile}
							ref={cameraInputRef}
							type="file"
						/>
						<input
							accept="image/*"
							className="hidden"
							onChange={selectFile}
							ref={galleryInputRef}
							type="file"
						/>
						<div className="grid gap-3 sm:grid-cols-2">
							<Button
								className="text-center"
								onClick={() => cameraInputRef.current?.click()}
								type="button"
								variant="outline"
							>
								<Camera /> Foto aufnehmen
							</Button>
							<Button
								className="text-center"
								onClick={() => galleryInputRef.current?.click()}
								type="button"
								variant="outline"
							>
								<Images /> Galerie
							</Button>
						</div>
						{previewUrl && file ? (
							<div className="space-y-2">
								<Image
									alt="Ausgewähltes Foto"
									className="max-h-72 w-full rounded-lg object-contain"
									height={480}
									src={previewUrl}
									unoptimized
									width={640}
								/>
								<p className="truncate text-center text-muted-foreground text-xs">{file.name}</p>
							</div>
						) : null}
						{error ? <p className="text-destructive text-sm">{error}</p> : null}
						<Button
							className="w-full text-center"
							disabled={!file || isUploading}
							onClick={upload}
							type="button"
						>
							{isUploading ? <Loader2 className="animate-spin" /> : null}
							{isUploading ? "Wird übertragen …" : "Foto übertragen"}
						</Button>
						<div className="flex gap-2 rounded-md bg-muted p-3 text-muted-foreground text-xs">
							<TriangleAlert className="size-4 shrink-0" />
							Bitte füge der MDScribe-Web-App keine persönlichen Gesundheitsinformationen hinzu.
						</div>
					</>
				) : (
					<p className="text-destructive text-sm">
						Dieser Upload-Link ist unvollständig oder wurde bereits verwendet. Scanne einen neuen
						QR-Code.
					</p>
				)}
			</CardContent>
		</Card>
	);
};
