import { Router } from "express"
import { authUserMiddlewareDTO } from "../datamodel/authDTO.js"
import { transactionQueryDTO } from "../datamodel/transactionDTO.js"
import { authMiddleware } from "../middleware/authMiddleware.js"
import { listAllTransactions, listUserTransactions } from "../service/transactionService.js"

const router = Router()

router.get("/transaction/list", authMiddleware, async (req, res)=>{
    const query = transactionQueryDTO.safeParse(req.query)
    const user = authUserMiddlewareDTO.safeParse(req.user)

    if(!query.success) return res.status(400).json({error: "transactionId ou page invalido"})
    if(!user.success) return res.status(401).json({error: "usuario invalido"})

    return await listUserTransactions(res, user.data.userId, query.data.transactionId)
})

router.get("/transaction/admin/list", authMiddleware, async (req, res)=>{
    const query = transactionQueryDTO.safeParse(req.query)
    const user = authUserMiddlewareDTO.safeParse(req.user)

    if(!query.success) return res.status(400).json({error: "transactionId ou page invalido"})
    if(!user.success) return res.status(401).json({error: "usuario invalido"})
    if(user.data.role <= 0) return res.status(403).json({error: "permissao insuficiente"})

    return await listAllTransactions(res, query.data.transactionId, query.data.page)
})

export default router