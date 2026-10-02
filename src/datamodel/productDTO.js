import z from "zod"

export const productsSearchDTO = z.object({
    name: z.string().min(3).max(255).optional(),
    ownerId: z.uuid().optional(),
    productId: z.uuid().optional()
}).refine((data)=> data.name || data.ownerId || data.productId,
{
    error: "Informe um dos campos de pesquisa"
})

export const productsCreateDTO = z.object({
    name: z.string().min(3).max(255),
    price: z.coerce.bigint(),
    type: z.string().min(3).max(255),
    item: z.string().min(3).max(255).optional(),
    quantity: z.int().nonnegative().default(1)
})

export const productsUpdateDTO = z.object({
    productId: z.uuid(),
    name: z.string().min(3).max(255).optional(),
    price: z.coerce.bigint().optional(),
    type: z.string().min(3).max(255).optional(),
    item: z.string().min(3).max(255).optional(),
    quantity: z.int().optional()
}).refine((data)=> data.name || data.price || data.type || data.item || data.quantity,
{
    error: "Informe um dos campos para alteração"
})

export const productsDeleteDTO = z.object({
    productId: z.uuid()
})