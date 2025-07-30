import { os } from '@orpc/server';
import { requiredAuthMiddleware } from './orpc/middlewares/auth';
import { dbProviderMiddleware } from './orpc/middlewares/db';

export const pub = os.use(dbProviderMiddleware);

export const authed = pub.use(requiredAuthMiddleware);
