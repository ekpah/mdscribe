import { Langfuse } from 'langfuse';
import { NextResponse } from 'next/server';



export async function GET() {

    const langfuse = new Langfuse();

    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const usage = await langfuse.api.metricsMetrics({
        query: JSON.stringify({
            view: 'traces',
            metrics: [{ measure: 'totalCost', aggregation: 'count' }],
            fromTimestamp: firstDayOfMonth.toISOString(),
            toTimestamp: now.toISOString(),
        }),
    })
    return NextResponse.json({ count: usage.data[0].count_totalCost });
}