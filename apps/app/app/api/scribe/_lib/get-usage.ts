import { database } from '@repo/database';
import type { Session } from '@/lib/auth-types';

export async function getUsage(session: Session) {
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const usage = await database.usageEvent.findMany({
        where: {
            userId: session.user.id,
            timestamp: {
                gte: firstDayOfMonth,
                lte: now,
            },
            name: 'ai_scribe_generation',
        },
    });

    const totalTokens = usage.reduce(
        (acc: number, event: any) => acc + (event.totalTokens ?? 0),
        0
    );

    const usageCount = usage.length;

    return ({ usage: { count: usageCount, totalTokens } });
}
