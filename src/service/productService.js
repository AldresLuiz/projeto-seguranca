import crypto from "crypto"
import pool, { transaction } from "./databaseService.js"
import r from "redis"

const redis = r.createClient({url: process.env.REDIS_URL})
redis.connect()

export async function createProduct(res, userId, name, price, type) {
    try{
        const dbRequest = await transaction(async (client)=>{
            const user = await client.query(`
            SELECT
            "name",
            "userId",
            "role"
            FROM "users"
            WHERE "userId" = $1
            LIMIT 1
            `, [userId])
    
            if(user.rowCount == 0) throw new Error("Usuario não existe")
    
            const produto = await client.query(`
            INSERT INTO products (
            "productId",
            "ownerId",
            "name",
            "price",
            "type"
            ) VALUES ($1, $2, $3, $4, $5)
            RETURNING *
            `, [
                await crypto.randomUUID(),
                user.rows[0].userId,
                name,
                price,
                type
            ])
    
            return produto.rows[0]
        })
        
        return res.status(200).json(dbRequest)
    } catch (error) {
        return res.status(500).json({error:error.message})
    }
}

export async function searchProduct(res, name, ownerId, productId) {
    const conditions = []
    const params = []

    if(name){params.push(`%${name}%`);conditions.push(`name ILIKE $${params.length}`)}
    if(ownerId){params.push(ownerId);conditions.push(`"ownerId" = $${params.length}`)}
    if(productId){params.push(productId);conditions.push(`"productId" = $${params.length}`)}

    const dbRequest = await pool.query(`
    SELECT
    "productId",
    "ownerId",
    "name",
    "price",
    "type",
    "item"
    FROM "products"
    WHERE ${conditions.join(" AND ")}
    ORDER BY "createdAt" DESC
    LIMIT 20
    `, params)

    return res.status(200).json(dbRequest.rows)
}

export async function listProduct(res) {
    const dbRequest = await pool.query(
    `
    SELECT
    "productId",
    "ownerId",
    "name",
    "price",
    "type",
    "item"
    FROM "products"
    ORDER BY "createdAt" DESC
    LIMIT 20
    `)
            
    await redis.set("product:recent:list",JSON.stringify(dbRequest.rows), {EX: 180})
    
    return res.status(200).json(dbRequest.rows)
}

export async function updateProduct(res, ownerId ,productId, name, price, type, item, quantity) { 
    try { 
        let quantityparam
        const fields = []
        const params = []

        if (name !== undefined) { params.push(name) ;fields.push(`"name" = $${params.length}`) } 
        if (price !== undefined) { params.push(price) ;fields.push(`"price" = $${params.length}`) } 
        if (type !== undefined) { params.push(type) ;fields.push(`"type" = $${params.length}`) } 
        if (item !== undefined) { params.push(item) ;fields.push(`"item" = $${params.length}`) }
        if (quantity !== undefined) { params.push(quantity) ;fields.push(`"quantity" = "quantity" + $${params.length}`) ;quantityparam = params.length}

        params.push(ownerId)
        params.push(productId)

        const dbRequest = await transaction(async (client) => { 
            const produto = await client.query(` 
                UPDATE products SET 
                ${fields.join(", ")}
                WHERE "productId" = $${params.length} AND "ownerId" = $${params.length-1} ${quantityparam ? `AND "quantity" + $${quantityParam} >= 0`: ""}
                RETURNING * `,
                params)

            if (produto.rowCount == 0) { throw new Error("Produto não existe") } 
            return produto.rows[0] 
        }) 
        return res.status(200).json(dbRequest)
    } catch (error) { 
        return res.status(500).json({ error: error.message }) 
    } 
}

export async function deleteProduct(res, ownerId, role, productId) {
    try {
        const deletedProduct = await transaction(async (client)=>{
            const result = await client.query(`
                DELETE
                FROM "products"
                WHERE "productId" = $1
                AND ("ownerId" = $2 OR $3 > 0)
                RETURNING *`,
            [productId, ownerId, role])

            return result.rows[0]
        })

        if(!deletedProduct) return res.status(404).json({error: "Produto não existe ou sem permissão para exclusão"})

        await redis.del("product:recent:list")
        return res.status(200).json(deletedProduct)
    } catch (error) {
        return res.status(500).json({error: error.message})
    }
}