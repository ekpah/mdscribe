"use client";

import type { Subscription } from "@better-auth/stripe";
import {
	Avatar,
	AvatarFallback,
	AvatarImage,
} from "@repo/design-system/components/ui/avatar";
import { Button } from "@repo/design-system/components/ui/button";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@repo/design-system/components/ui/card";
import { cn } from "@repo/design-system/lib/utils";
import { LaptopIcon, Loader2, SmartphoneIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { UAParser } from "ua-parser-js";
import { authClient, useSession } from "@/lib/auth-client";
import type { Session } from "@/lib/auth-types";

export default function UserCard(props: {
	session: Session | null;
	activeSessions: Session["session"][];
	subscription?: Subscription;
}) {
	const router = useRouter();
	const { data: sessionData } = useSession();
	const session = sessionData || props.session;
	const [isLoading, setIsLoading] = useState<string>();

	const [activeSessions, setActiveSessions] = useState(props.activeSessions);
	const removeActiveSession = (id: string) =>
		setActiveSessions(activeSessions.filter((s) => s.id !== id));

	return (
		<Card>
			<CardHeader>
				<CardTitle>Benutzer</CardTitle>
			</CardHeader>
			<CardContent className="grid grid-cols-1 gap-8">
				<div className="flex flex-col gap-2">
					<div className="flex items-start justify-between">
						<div className="flex items-center gap-4">
							<Avatar className="hidden h-9 w-9 sm:flex ">
								<AvatarImage
									alt="Avatar"
									className="object-cover"
									src={session?.user.image || undefined}
								/>
								<AvatarFallback>{session?.user.name.charAt(0)}</AvatarFallback>
							</Avatar>
							<div className="grid">
								<div className="flex items-center gap-1">
									<p className="font-medium text-sm leading-none">
										{session?.user.name}
									</p>
								</div>
								<p className="text-sm">{session?.user.email}</p>
							</div>
						</div>
					</div>
				</div>

				<div className="flex flex-col gap-3">
					<p className="font-medium text-xs">Aktive Sitzungen</p>
					{activeSessions.map((activeSession) => {
						const isCurrentSession = activeSession.id === session?.session?.id;
						const parser = UAParser(activeSession.userAgent as string);
						const isMobile = parser.device.type === "mobile";

						const handleRevoke = async () => {
							setIsLoading(activeSession.id);

							if (isCurrentSession) {
								await authClient.signOut({
									fetchOptions: {
										onSuccess: () => {
											router.refresh();
											router.push("/");
										},
									},
								});
								return;
							}

							try {
								const res = await authClient.revokeSession({
									token: activeSession.token,
								});

								if (res.error) {
									toast.error(
										res.error.message || "Sitzung konnte nicht beendet werden",
									);
									setIsLoading(undefined);
								} else {
									toast.success("Sitzung erfolgreich beendet");
									removeActiveSession(activeSession.id);
								}
							} catch (error) {
								toast.error("Sitzung konnte nicht beendet werden");
								setIsLoading(undefined);
							}
						};

						return (
							<Card
								key={activeSession.id}
								className={cn("flex flex-row items-center gap-3 px-4 py-3")}
							>
								{isMobile ? (
									<SmartphoneIcon className="size-4" />
								) : (
									<LaptopIcon className="size-4" />
								)}

								<div className="flex flex-col">
									<span className="font-semibold text-sm">
										{isCurrentSession
											? "Aktuelle Sitzung"
											: activeSession.ipAddress || "Unbekannt"}
									</span>

									<span className="text-muted-foreground text-xs">
										{activeSession.userAgent?.includes("tauri-plugin-http")
											? "App"
											: parser.os.name && parser.browser.name
												? `${parser.os.name}, ${parser.browser.name}`
												: parser.os.name ||
													parser.browser.name ||
													activeSession.userAgent ||
													"Unbekannt"}
									</span>
								</div>

								<Button
									className="relative ms-auto"
									disabled={isLoading === activeSession.id}
									size="sm"
									variant="outline"
									onClick={handleRevoke}
								>
									{isLoading === activeSession.id && (
										<Loader2 className="animate-spin" />
									)}
									{isCurrentSession ? "Abmelden" : "Beenden"}
								</Button>
							</Card>
						);
					})}
				</div>
			</CardContent>
		</Card>
	);
}
