"use client";

import { Calendar, Clock } from "lucide-react";
import { useEffect, useState } from "react";

export const LiveTime = () => {
	const [currentTime, setCurrentTime] = useState(new Date());

	useEffect(() => {
		const timer = setInterval(() => {
			setCurrentTime(new Date());
		}, 1000);

		return () => clearInterval(timer);
	}, []);

	return (
		<>
			<div className="flex items-center gap-1">
				<Calendar className="h-3 w-3 sm:h-4 sm:w-4" />
				{currentTime.toLocaleDateString("de-DE", {
					day: "numeric",
					month: "long",
					weekday: "long",
					year: "numeric",
				})}
			</div>
			<div className="flex items-center gap-1">
				<Clock className="h-3 w-3 sm:h-4 sm:w-4" />
				{currentTime.toLocaleTimeString("de-DE", {
					hour: "2-digit",
					minute: "2-digit",
				})}
			</div>
		</>
	);
};
