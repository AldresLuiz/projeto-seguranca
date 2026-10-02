import pool from "./databaseService.js"

const pageSize = 20

async function getTransactionWithItems(transactionId, userId) {
    const params = [transactionId]
    const ownershipCondition = userId ? `AND t."userId" = $2` : ""
    if(userId) params.push(userId)

    const result = await pool.query(`
        SELECT t."transactionId", t."externalId", t."userId", t."amount", t."status",
            t."createdAt", t."finishedAt",
            ti."productId", ti."name", ti."price", ti."type", ti."item", ti."quantity"
        FROM "transactions" t
        LEFT JOIN "transaction_items" ti ON ti."transactionId" = t."transactionId"
        WHERE t."transactionId" = $1 ${ownershipCondition}
        ORDER BY ti."createdAt" ASC, ti."id" ASC
    `, params)

    if(result.rowCount === 0) return null

    const first = result.rows[0]
    return {
        transaction: {
            transactionId: first.transactionId,
            externalId: first.externalId,
            userId: first.userId,
            amount: first.amount,
            status: first.status,
            createdAt: first.createdAt,
            finishedAt: first.finishedAt
        },
        items: result.rows.filter(row => row.productId !== null).map(row => ({
            productId: row.productId,
            name: row.name,
            price: row.price,
            type: row.type,
            item: row.item,
            quantity: row.quantity
        }))
    }
}

export async function listUserTransactions(res, userId, transactionId) {
    try {
        if(transactionId) {
            const result = await getTransactionWithItems(transactionId, userId)
            if(!result) return res.status(404).json({error: "Transação não encontrada"})
            return res.status(200).json(result)
        }

        const result = await pool.query(`
            SELECT "transactionId", "externalId", "userId", "amount", "status", "createdAt", "finishedAt"
            FROM "transactions"
            WHERE "userId" = $1
            ORDER BY "createdAt" DESC, "id" DESC
            LIMIT $2
        `, [userId, pageSize])

        return res.status(200).json(result.rows)
    } catch (error) {
        return res.status(500).json({error: error.message})
    }
}

export async function listAllTransactions(res, transactionId, page) {
    try {
        if(transactionId) {
            const result = await getTransactionWithItems(transactionId)
            if(!result) return res.status(404).json({error: "Transação não encontrada"})
            return res.status(200).json(result)
        }

        const offset = (page - 1) * pageSize
        const [transactions, count] = await Promise.all([
            pool.query(`
                SELECT "transactionId", "externalId", "userId", "amount", "status", "createdAt", "finishedAt"
                FROM "transactions"
                ORDER BY "createdAt" DESC, "id" DESC
                LIMIT $1 OFFSET $2
            `, [pageSize, offset]),
            pool.query(`SELECT COUNT(*)::INTEGER AS total FROM "transactions"`)
        ])

        const total = count.rows[0].total
        return res.status(200).json({
            page,
            pageSize,
            total,
            totalPages: Math.ceil(total / pageSize),
            transactions: transactions.rows
        })
    } catch (error) {
        return res.status(500).json({error: error.message})
    }
}