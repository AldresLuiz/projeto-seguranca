import z from "zod"

export const transactionQueryDTO = z.object({
    transactionId: z.uuid().optional(),
    page: z.coerce.number().int().min(1).default(1)
})