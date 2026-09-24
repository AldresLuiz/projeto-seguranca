import r from "redis"
import crypto from "crypto" // gerar UUIDS
import { Router } from "express"
import { hash, compare } from "bcrypt" // hash e compare de senhas
import pool from "../service/databaseService.js" //pool de DB do postgress
import { createAccessToken, createRefreshToken, verifyRefreshToken } from "../service/authService.js" // Criação dos tokens de acesso
import { authLoginDTO, authRegisterDTO } from "../datamodel/authDTO.js" // Datamodels

const redis = r.createClient({
    url: process.env.REDIS_URL
})
await redis.connect()
const router = Router();

// Rota para criar usuario
router.post("/auth/register", async (req, res)=>{
    // Validação do body
    const body = authRegisterDTO.safeParse(req.body)
    if(!body.success) return res.status(400).json({
        error: "body invalido ou incompleto"
    })

    // Extração de dados
    let { name, email, password, number } = body.data

    // Request ao banco de dados
    const dbrequest = await pool.query(
        `
        INSERT INTO users (
        name,
        email,
        password,
        role,
        "userId"
        ) VALUES ($1, $2, $3, 0, $4)
        ON CONFLICT (email) DO NOTHING
        RETURNING *
        `,[
            name,
            email,
            await hash(password, Number(process.env.PASSWORD_SALT)),
            await crypto.randomUUID()
        ]
    )

    // Retorna STATUS 409 caso um email for encontrado
    if(dbrequest.rowCount == 0) return res.status(409).json({
        error: "Email já cadastrado"
    });

    return res.status(201).json({
        message: "Usuario criado com sucesso"
    });
})

// Rota para logar usuario
router.post("/auth/login", async (req, res)=>{
    // Validação do body
    const body = authLoginDTO.safeParse(req.body)
    if(!body.success) return res.status(400).json({
        error: "body invalido ou incompleto"
    })
    
    // Request ao banco de dados
    const dbrequest = await pool.query(
        `
        SELECT
            "userId",
            "email",
            "password",
            "role"
        FROM "users"
        WHERE "email" = $1
        LIMIT 1
        `,
        [body.data.email]
    )

    // Retorna STATUS 401 caso usuario não for encontrado
    if(dbrequest.rowCount == 0){
        return res.status(401).json({
            error: "Email ou senha incorretos"
        })
    }

    // Retorna STATUS 401 caso senha for incorreta
    const user = dbrequest.rows[0]
    if(!(await compare(body.data.password, user.password))) return res.status(401).json({
            error: "Email ou senha incorretos"
    })

    // Obtem a versão de sessão caso não exista seta 1 no redis
    let version = await redis.get(`auth:user:${user.userId}:version`)
    if(version==null) version = 1; await redis.set(`auth:user:${user.userId}:version`, version)
    
    // Cria o ID de sessão
    const sessionId = await crypto.randomUUID()
    await redis.set(`auth:session:${sessionId}`, user.userId)

    // Retorna os Tokens de acesso
    const refresh = createRefreshToken(user, sessionId, version)
    const access = createAccessToken(user)

    res.cookie("REFRESH", refresh, {
        httpOnly: true,
        maxAge: 1000 * 60 * 60 * 24 * 3,
        secure: false,
        sameSite: "strict"
    })

    res.cookie("ACCESS", access, {
        httpOnly: true,
        maxAge: 1000 * 60 * 15,
        secure: false,
        sameSite: "strict"
    })

    // Se tudo deu certo você deveria parar aqui
    res.status(200).json({
        message: "Login efetuado com sucesso"
    })
})

// Rota para renovação de sessão
router.get("/auth/refresh", async (req, res) => {
    try {
        // Obtem REFRESH TOKEN
        const refreshToken = req.cookies.REFRESH
        if (!refreshToken) return res.status(401).json({ error: "Refresh token não encontrado" })

        // Valida o REFRESH TOKEN
        let payload
        try {
            payload = verifyRefreshToken(refreshToken)
        } catch {
            return res.status(401).json({
                error: "Refresh token inválido ou expirado"
            })
        }

        // Verifica os campos presentes no TOKEN
        const userId = payload.sub
        const sessionId = payload.jti
        const tokenVersion = payload.version
        if (!userId || !sessionId || tokenVersion == null) return res.status(401).json({ error: "Refresh token inválido" })

        // Faz validação da sessão atual e cria uma nova sessão atomicamente
        const newSessionId = await crypto.randomUUID()
        const result = await redis.eval(
            `
            local sessionUserId = redis.call("GET", KEYS[1])

            if not sessionUserId then
                return 0
            end

            if sessionUserId ~= ARGV[1] then
                return 0
            end

            local currentVersion = redis.call("GET", KEYS[2])

            if not currentVersion then
                return 0
            end

            if currentVersion ~= ARGV[2] then
                return 0
            end

            redis.call("DEL", KEYS[1])

            redis.call(
                "SET",
                KEYS[3],
                ARGV[1]
            )

            return 1
            `,
            {
                keys: [
                    `auth:session:${sessionId}`,
                    `auth:user:${userId}:version`,
                    `auth:session:${newSessionId}`
                ],
                arguments: [
                    userId,
                    String(tokenVersion)
                ]
            }
        )

        // Caso a sessão do token não for valida ou versão de sessão não for a atual retorna STATUS 401 sessão invalida
        if(result != 1) return res.status(401).json({ error: "Sessão inválida ou expirada" })

        // Pega os dados mais recentes do usuario para o ACCESS TOKEN
        const dbrequest = await pool.query(
            `
            SELECT
                "userId",
                "role"
            FROM users
            WHERE "userId" = $1
            LIMIT 1
            `,
            [userId]
        )

        // Se o usuario não existir mais, retorna STATUS 401 usuario não encontrado
        if (dbrequest.rowCount === 0) {await redis.del(`auth:session:${newSessionId}`) ;return res.status(401).json({error: "Usuário não encontrado"})}
        
        // Retorna os Tokens de acesso
        const refresh = createRefreshToken(dbrequest.rows[0], newSessionId, tokenVersion)
        const access = createAccessToken(dbrequest.rows[0])

        res.cookie("REFRESH", refresh, {
            httpOnly: true,
            maxAge: 1000 * 60 * 60 * 24 * 3,
            secure: false,
            sameSite: "strict"
        })

        res.cookie("ACCESS", access, {
            httpOnly: true,
            maxAge: 1000 * 60 * 15,
            secure: false,
            sameSite: "strict"
        })

        return res.status(200).json({
            message: "Token renovado com sucesso"
        })

    } catch (error) {
        console.error(error)

        return res.status(500).json({
            error: "Erro interno do servidor"
        })
    }
})

// Rota para excluir sessão atual
router.get("/auth/logout", async(req, res) => {
    try{
        // Tenta obter o REFRESH TOKEN
        const refreshToken = req.cookies.REFRESH
        if (!refreshToken) return res.status(401).json({ error: "Refresh token não encontrado" })
        
        // Valida o REFRESH TOKEN
        let payload
        try {
            payload = verifyRefreshToken(refreshToken)
        } catch {
            return res.status(401).json({
                error: "Refresh token inválido ou expirado"
            })
        }
        
        // Verifica os campos presentes no TOKEN
        const userId = payload.sub
        const sessionId = payload.jti
        const tokenVersion = payload.version
        if (!userId || !sessionId || tokenVersion == null) return res.status(401).json({ error: "Refresh token inválido" })
        
        // Valida se a sessão do REFRESH TOKEN é valida caso VERDADEIRO ele apaga a sessão do redis
        const result = await redis.eval(
            `
            local sessionUserId = redis.call("GET", KEYS[1])

            if not sessionUserId then
                return 0
            end

            if sessionUserId ~= ARGV[1] then
                return 0
            end

            local currentVersion = redis.call("GET", KEYS[2])

            if not currentVersion then
                return 0
            end

            if currentVersion ~= ARGV[2] then
                return 0
            end

            redis.call("DEL", KEYS[1])

            return 1
            `,
            {
                keys: [
                    `auth:session:${sessionId}`,
                    `auth:user:${userId}:version`
                ],
                arguments: [
                    userId,
                    String(tokenVersion)
                ]
            }
        )

        // Retorna status 401 caso versão de sessão seja divergente ou id de sessão não exista
        if(result != 1) return res.status(401).json({ error: "Sessão inválida ou expirada" })

        res.clearCookie("REFRESH")
        res.clearCookie("ACCESS")

        // Logout efetuado
        res.status(200).json({
            message: "Logout efetuado com sucesso!"
        })
    } catch (error) {
        console.error(error)

        return res.status(500).json({
            error: "Erro interno do servidor"
        })
    }
})

// Rota para invalidar todas as sessões de um usuario
router.get("/auth/logoutall", async(req, res) => {
    try{
        // Tenta obter o REFRESH TOKEN
        const refreshToken = req.cookies.REFRESH
        if (!refreshToken) return res.status(401).json({ error: "Refresh token não encontrado" })
        
        // Valida o REFRESH TOKEN
        let payload
        try {
            payload = verifyRefreshToken(refreshToken)
        } catch {
            return res.status(401).json({
                error: "Refresh token inválido ou expirado"
            })
        }

        // Verifica os campos presentes no TOKEN
        const userId = payload.sub
        const sessionId = payload.jti
        const tokenVersion = payload.version
        if (!userId || !sessionId || tokenVersion == null) return res.status(401).json({ error: "Refresh token inválido" })

        // Valida se a sessão do REFRESH TOKEN é valida caso VERDADEIRO ele apaga a sessão do redis
        const result = await redis.eval(
            `
            local sessionUserId = redis.call("GET", KEYS[1])

            if not sessionUserId then
                return 0
            end

            if sessionUserId ~= ARGV[1] then
                return 0
            end

            local currentVersion = redis.call("GET", KEYS[2])

            if not currentVersion then
                return 0
            end

            if currentVersion ~= ARGV[2] then
                return 0
            end

            redis.call("INCR", KEYS[2])

            return 1
            `,
            {
                keys: [
                    `auth:session:${sessionId}`,
                    `auth:user:${userId}:version`
                ],
                arguments: [
                    userId,
                    String(tokenVersion)
                ]
            }
        )

        // Retorna status 401 caso versão de sessão seja divergente ou id de sessão não exista
        if(result != 1) return res.status(401).json({ error: "Sessão inválida ou expirada" })

        res.clearCookie("REFRESH")
        res.clearCookie("ACCESS")

        // Logout efetuado
        res.status(200).json({
            message: "Logout de todas as sessões efetuado."
        })
    } catch (error){
        console.error(error)

        return res.status(500).json({
            error: "Erro interno do servidor"
        })
    }
})

export default router