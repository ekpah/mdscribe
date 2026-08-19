"use client";

import { Button } from "@repo/design-system/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@repo/design-system/components/ui/dialog";
import { Loader2, QrCode, TriangleAlert } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { createUploadedFilesFromTransferPayload } from "@/app/_components/context-transfer/hydrate";
import type { ContextTransferPayload } from "@/app/_components/context-transfer/types";
import {
	createTransferKey,
	createTransferToken,
	decryptTransferEnvelope,
	hashTransferToken,
} from "@/lib/context-transfer-crypto";
import { orpc } from "@/lib/orpc";

interface MobileUploadSession {
	key: string;
	launchUrl: string;
	token: string;
}

export const MobileFileUpload = ({
	disabled,
	onFilesReceived,
}: {
	disabled: boolean;
	onFilesReceived: (files: File[]) => boolean;
}) => {
	const [isCreating, setIsCreating] = useState(false);
	const [session, setSession] = useState<MobileUploadSession | null>(null);

	const startUpload = useCallback(async () => {
		setIsCreating(true);
		try {
			const token = createTransferToken();
			const key = createTransferKey();
			const tokenHash = await hashTransferToken(token);
			if (!tokenHash) {
				throw new Error("Token konnte nicht erzeugt werden");
			}

			await orpc.contextTransfers.createMobile.call({ tokenHash });
			const fragment = new URLSearchParams({ key, uploadToken: token });
			setSession({
				key,
				launchUrl: `${window.location.origin}/mobile-upload#${fragment.toString()}`,
				token,
			});
		} catch {
			toast.error("Der mobile Foto-Upload konnte nicht gestartet werden.");
		} finally {
			setIsCreating(false);
		}
	}, []);

	useEffect(() => {
		if (!session) {
			return;
		}

		let stopped = false;
		let timeout: ReturnType<typeof setTimeout> | undefined;
		const poll = async () => {
			try {
				const status = await orpc.contextTransfers.mobileStatus.call({
					token: session.token,
				});
				if (stopped) {
					return;
				}
				if (!status.ready) {
					timeout = setTimeout(poll, 1500);
					return;
				}

				const { ciphertext } = await orpc.contextTransfers.consumeMobile.call({
					token: session.token,
				});
				const payload = await decryptTransferEnvelope<ContextTransferPayload>(
					ciphertext,
					session.key,
				);
				if (payload.version !== 1 || !Array.isArray(payload.contextFiles)) {
					throw new Error("Ungültige Nutzdaten");
				}
				const files = createUploadedFilesFromTransferPayload(payload).map(({ file }) => file);
				if (onFilesReceived(files)) {
					toast.success(files.length === 1 ? "Foto hinzugefügt." : "Fotos hinzugefügt.");
				}
				setSession(null);
			} catch {
				if (!stopped) {
					toast.error("Das Foto konnte nicht vom Handy übernommen werden.");
					setSession(null);
				}
			}
		};

		timeout = setTimeout(poll, 1000);
		return () => {
			stopped = true;
			if (timeout) {
				clearTimeout(timeout);
			}
		};
	}, [onFilesReceived, session]);

	return (
		<>
			<Button
				className="w-full"
				disabled={disabled || isCreating}
				onClick={startUpload}
				type="button"
				variant="outline"
			>
				{isCreating ? <Loader2 className="animate-spin" /> : <QrCode />}
				Foto vom Handy hinzufügen
			</Button>
			<Dialog
				onOpenChange={(open) => {
					if (!open) {
						setSession(null);
					}
				}}
				open={session !== null}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Foto vom Handy hinzufügen</DialogTitle>
						<DialogDescription>
							Scanne den QR-Code. Du musst dich auf dem Handy nicht anmelden.
						</DialogDescription>
					</DialogHeader>
					{session ? (
						<div className="flex flex-col items-center gap-4">
							<div className="rounded-xl bg-white p-4">
								<QRCodeSVG
									aria-label="QR-Code für mobilen Foto-Upload"
									size={224}
									value={session.launchUrl}
								/>
							</div>
							<div className="flex items-center gap-2 text-muted-foreground text-sm">
								<Loader2 className="size-4 animate-spin" />
								Warte auf das Foto …
							</div>
							<div className="flex gap-2 rounded-md bg-muted p-3 text-muted-foreground text-xs">
								<TriangleAlert className="size-4 shrink-0" />
								Bitte füge der MDScribe-Web-App keine persönlichen Gesundheitsinformationen hinzu.
							</div>
						</div>
					) : null}
				</DialogContent>
			</Dialog>
		</>
	);
};
