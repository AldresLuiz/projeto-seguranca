import { Router } from "express"
import { authUserMiddlewareDTO } from "../datamodel/authDTO.js"
import { cartAddItemDTO, cartProductIdDTO } from "../datamodel/cartDTO.js"
import { authMiddleware } from "../middleware/authMiddleware.js"
import { addProductToCart, checkoutCart, getCart, removeProductFromCart } from "../service/cartService.js"

const router = Router()

function getUserId(req, res) {
    const user = authUserMiddlewareDTO.safeParse(req.user)
    if(!user.success) {
        res.status(401).json({error: "usuario invalido"})
        return null
    }
    return user.data.userId
}

router.get("/cart/list", authMiddleware, async (req, res)=>{
    const userId = getUserId(req, res)
    if(!userId) return
    return await getCart(res, userId)
})

router.post("/cart/items", authMiddleware, async (req, res)=>{
    const body = cartAddItemDTO.safeParse(req.body)
    if(!body.success) return res.status(400).json({error: "productId ou quantity invalido"})

    const userId = getUserId(req, res)
    if(!userId) return
    return await addProductToCart(res, userId, body.data.productId, body.data.quantity)
})

router.delete("/cart/items/:productId", authMiddleware, async (req, res)=>{
    const body = cartProductIdDTO.safeParse(req.params)
    if(!body.success) return res.status(400).json({error: "productId invalido"})

    const userId = getUserId(req, res)
    if(!userId) return
    return await removeProductFromCart(res, userId, body.data.productId)
})

router.post("/cart/checkout", authMiddleware, async (req, res)=>{
    const userId = getUserId(req, res)
    if(!userId) return
    return await checkoutCart(res, userId)
})

export default router