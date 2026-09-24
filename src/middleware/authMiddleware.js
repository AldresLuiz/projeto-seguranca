import { verifyAccessToken } from "../service/authService.js"

export function authMiddleware(req, res, next) {
    try {
        // Obtém o ACCESS TOKEN do cookie
        const accessToken = req.cookies.ACCESS

        if (!accessToken) {
            return res.status(401).json({
                error: "Access token não encontrado"
            })
        }

        // Valida assinatura, expiração e payload do JWT
        const payload = verifyAccessToken(accessToken)

        // Valida campos obrigatórios
        if (!payload?.sub || payload.role == null) {
            return res.status(401).json({
                error: "Access token inválido"
            })
        }

        // Disponibiliza os dados autenticados para as próximas rotas
        req.user = {
            userId: payload.sub,
            role: payload.role
        }

        next()

    } catch (error) {
        return res.status(401).json({
            error: "Access token inválido ou expirado"
        })
    }
}

