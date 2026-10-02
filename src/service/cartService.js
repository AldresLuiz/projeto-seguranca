import crypto from "crypto"
import { transaction } from "./databaseService.js"

function serviceError(status, message) {
    const error = new Error(message)
    error.status = status
    return error
}

function sendError(res, error) {
    return res.status(error.status ?? 500).json({error: error.message})
}

export async function getCart(res, userId) {
    try {
        const result = await transaction(async (client)=>{
            const cart = await client.query(`
                SELECT p."productId", p."ownerId", p."name", p."price", p."type", p."item",
                    p."quantity" AS "availableQuantity", cp."quantity" AS "cartQuantity"
                FROM "cart" c
                JOIN "cartProducts" cp ON cp."cartId" = c."id"
                JOIN "products" p ON p."productId" = cp."productId"
                WHERE c."ownerId" = $1
                ORDER BY p."createdAt" DESC
            `, [userId])

            const total = cart.rows.reduce((sum, item)=>
                sum + BigInt(item.price) * BigInt(item.cartQuantity), 0n)

            return {items: cart.rows, total: total.toString()}
        })

        return res.status(200).json(result)
    } catch (error) {
        return sendError(res, error)
    }
}

export async function addProductToCart(res, userId, productId, quantity) {
    try {
        const item = await transaction(async (client)=>{
            await client.query(`
                INSERT INTO "cart" ("ownerId") VALUES ($1)
                ON CONFLICT ("ownerId") DO NOTHING
            `, [userId])

            const cart = await client.query(`
                SELECT "id" FROM "cart" WHERE "ownerId" = $1 FOR UPDATE
            `, [userId])

            const product = await client.query(`
                SELECT "productId", "quantity"
                FROM "products"
                WHERE "productId" = $1
                FOR UPDATE
            `, [productId])

            if(product.rowCount === 0) throw serviceError(404, "Produto não encontrado")

            const currentItem = await client.query(`
                SELECT "quantity" FROM "cartProducts"
                WHERE "cartId" = $1 AND "productId" = $2
            `, [cart.rows[0].id, productId])

            const cartQuantity = Number(currentItem.rows[0]?.quantity ?? 0)
            if(cartQuantity + quantity > Number(product.rows[0].quantity)) {
                throw serviceError(409, "Quantidade solicitada maior que o estoque disponível")
            }

            const result = await client.query(`
                INSERT INTO "cartProducts" ("cartId", "productId", "quantity")
                VALUES ($1, $2, $3)
                ON CONFLICT ("cartId", "productId")
                DO UPDATE SET "quantity" = "cartProducts"."quantity" + EXCLUDED."quantity"
                RETURNING "productId", "quantity"
            `, [cart.rows[0].id, productId, quantity])

            return result.rows[0]
        })

        return res.status(200).json(item)
    } catch (error) {
        return sendError(res, error)
    }
}

export async function removeProductFromCart(res, userId, productId) {
    try {
        const result = await transaction(async (client)=> client.query(`
            DELETE FROM "cartProducts" cp
            USING "cart" c
            WHERE cp."cartId" = c."id"
            AND c."ownerId" = $1
            AND cp."productId" = $2
            RETURNING cp."productId", cp."quantity"
        `, [userId, productId]))

        if(result.rowCount === 0) throw serviceError(404, "Produto não encontrado no carrinho")
        return res.status(200).json(result.rows[0])
    } catch (error) {
        return sendError(res, error)
    }
}

export async function checkoutCart(res, userId) {
    try {
        const checkout = await transaction(async (client)=>{
            const cart = await client.query(`
                SELECT "id" FROM "cart" WHERE "ownerId" = $1 FOR UPDATE
            `, [userId])

            if(cart.rowCount === 0) throw serviceError(409, "O carrinho está vazio")

            const items = await client.query(`
                SELECT p."productId", p."name", p."price", p."type", p."item",
                    p."quantity" AS "availableQuantity", cp."quantity" AS "cartQuantity"
                FROM "cartProducts" cp
                JOIN "products" p ON p."productId" = cp."productId"
                WHERE cp."cartId" = $1
                ORDER BY p."productId"
                FOR UPDATE OF cp, p
            `, [cart.rows[0].id])

            if(items.rowCount === 0) throw serviceError(409, "O carrinho está vazio")

            for(const item of items.rows) {
                if(Number(item.cartQuantity) > Number(item.availableQuantity)) {
                    throw serviceError(409, `Estoque insuficiente para ${item.name}`)
                }
            }

            const amount = items.rows.reduce((sum, item)=>
                sum + BigInt(item.price) * BigInt(item.cartQuantity), 0n)
            const transactionId = crypto.randomUUID()
            const createdTransaction = await client.query(`
                INSERT INTO "transactions" ("transactionId", "userId", "amount", "status", "finishedAt")
                VALUES ($1, $2, $3, 'completed', CURRENT_TIMESTAMP)
                RETURNING "transactionId", "userId", "amount", "status", "createdAt", "finishedAt"
            `, [transactionId, userId, amount.toString()])

            const transactionItems = []
            for(const item of items.rows) {
                const createdItem = await client.query(`
                    INSERT INTO "transaction_items" (
                        "productId", "transactionId", "name", "price", "type", "item", "quantity"
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7)
                    RETURNING "productId", "name", "price", "type", "item", "quantity"
                `, [item.productId, transactionId, item.name, item.price, item.type, item.item, item.cartQuantity])
                transactionItems.push(createdItem.rows[0])

                const updatedProduct = await client.query(`
                    UPDATE "products"
                    SET "quantity" = "quantity" - $1
                    WHERE "productId" = $2 AND "quantity" >= $1
                `, [item.cartQuantity, item.productId])
                if(updatedProduct.rowCount === 0) throw serviceError(409, `Estoque insuficiente para ${item.name}`)
            }

            await client.query(`DELETE FROM "cartProducts" WHERE "cartId" = $1`, [cart.rows[0].id])

            return {transaction: createdTransaction.rows[0], items: transactionItems}
        })

        return res.status(201).json(checkout)
    } catch (error) {
        return sendError(res, error)
    }
}