import z from "zod"

export const cartAddItemDTO = z.object({
    productId: z.uuid(),
    quantity: z.int().positive().default(1)
})

export const cartProductIdDTO = z.object({
    productId: z.uuid()
})