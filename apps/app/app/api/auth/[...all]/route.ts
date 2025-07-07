import { toNextJsHandler } from 'better-auth/next-js';
import type { NextRequest } from 'next/server';
import { auth } from '@/auth'; // path to your auth file

export const { GET } = toNextJsHandler(auth);

export const POST = async (req: NextRequest) => {
  const res = await auth.handler(req);
  return res;
};
