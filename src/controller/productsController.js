import { Router } from "express";
import { productsCreateDTO, productsDeleteDTO, productsSearchDTO, productsUpdateDTO } from "../datamodel/productDTO.js";
import { authMiddleware } from "../middleware/authMiddleware.js"
import { authUserMiddlewareDTO } from "../datamodel/authDTO.js";
import { createProduct, deleteProduct, listProduct, searchProduct, updateProduct } from "../service/productService.js";
import r from "redis"

const redis = r.createClient({
    url: process.env.REDIS_URL
})
await redis.connect()
const router = Router()

router.get("/product/list", async (req, res)=>{
    const cache = await redis.get("product:recent:list")
    if(cache!=null) return res.status(200).json(JSON.parse(cache))

    return await listProduct(res)
})

router.get("/product/search", authMiddleware , async (req, res)=>{
    const body = productsSearchDTO.safeParse(req.query)
    if(!body.success) return res.status(400).json({error: "body invalido ou incompleto"})
    
    return await searchProduct(res, body.data.name, body.data.ownerId, body.data.productId)
})

router.post("/product/create", authMiddleware, async (req, res)=>{
    const body = productsCreateDTO.safeParse(req.body)
    const userValidator = authUserMiddlewareDTO.safeParse(req.user)

    if(!body.success) return res.status(400).json({error: "body invalido ou incompleto"})
    
    return await createProduct(res, userValidator.data.userId, body.data.name, body.data.price, body.data.type, body.data.item, body.data.quantity)
})

router.post("/product/update", authMiddleware, async (req, res)=>{
    const body = productsUpdateDTO.safeParse(req.body)
    const userValidator = authUserMiddlewareDTO.safeParse(req.user)

    if(!body.success) return res.status(400).json({error: "body invalido ou incompleto"})

    return await updateProduct(res, userValidator.data.userId, body.data.productId, body.data.name, body.data.price, body.data.type, body.data.item, body.data.quantity)
})

router.delete("/product/delete/:productId", authMiddleware, async (req, res)=>{
    const body = productsDeleteDTO.safeParse(req.params)
    const userValidator = authUserMiddlewareDTO.safeParse(req.user)

    if(!body.success) return res.status(400).json({error: "productId invalido"})
    if(!userValidator.success) return res.status(401).json({error: "usuario invalido"})

    return await deleteProduct(res, userValidator.data.userId, userValidator.data.role, body.data.productId)
})

export default router
