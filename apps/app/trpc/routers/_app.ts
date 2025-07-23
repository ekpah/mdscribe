import { z } from 'zod';
import { baseProcedure, createTRPCRouter } from '../init';
export const appRouter = createTRPCRouter({
    session: baseProcedure
        .input(
            z.object({
                text: z.string(),
            }),
        )
        .query((opts) => {
            return {
                greeting: `hello ${opts.input.text}`,
            };
        }),
    aiscribe: {
        anamnese: baseProcedure.input(z.object({
            anamnese: z.string(),
        })).query((opts) => {
            return {
                anamnese: opts.input.anamnese,
            };
        }),
    }
});
// export type definition of API
export type AppRouter = typeof appRouter;
