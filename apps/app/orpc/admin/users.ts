import { authed } from '@/orpc';
import { requiredAdminMiddleware } from '../middlewares/admin';

const adminUsersHandler = authed
	.use(requiredAdminMiddleware)
	.handler(async ({ context }) => {
		const users = await context.db.user.findMany({
			select: {
				id: true,
				name: true,
				email: true,
				emailVerified: true,
				image: true,
				createdAt: true,
				updatedAt: true,
				_count: {
					select: {
						templates: true,
						sessions: true,
						accounts: true,
						subscriptions: true,
					},
				},
			},
			orderBy: {
				createdAt: 'desc',
			},
		});

		return users;
	});

export const usersHandler = {
	list: adminUsersHandler,
};

