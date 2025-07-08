import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getUsage } from '../_lib/get-usage';

export async function GET() {
    const session = await auth.api.getSession({
        headers: await headers(),
    });
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const usage = await getUsage(session);
    return NextResponse.json(usage);
}
