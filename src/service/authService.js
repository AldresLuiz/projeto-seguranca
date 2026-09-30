import jwt from "jsonwebtoken";
import crypto from "crypto"

const ACCESS_SECRET = process.env.ACCESS_TOKEN_SECRET;
const REFRESH_SECRET = process.env.REFRESH_TOKEN_SECRET;

const ACCESS_AGE = process.env.ACCESS_TOKEN_AGE
const REFRESH_AGE = process.env.REFRESH_TOKEN_AGE

if (!ACCESS_SECRET) {
    throw new Error("ACCESS_TOKEN_SECRET não configurado");
}
if (!REFRESH_SECRET) {
    throw new Error("REFRESH_TOKEN_SECRET não configurado");
}
if (!ACCESS_AGE) {
    throw new Error("ACCESS_AGE não configurado");
}
if (!REFRESH_AGE) {
    throw new Error("REFRESH_AGE não configurado");
}

export function createAccessToken(user) {
    return jwt.sign(
        {
            sub: user.userId,
            role: user.role
        },
        ACCESS_SECRET,
        {
            expiresIn: ACCESS_AGE
        }
    );
}

export function createRefreshToken(user, sessionId, version) {
    return jwt.sign(
        {
            sub: user.userId,
            version: version
        },
        REFRESH_SECRET,
        {
            expiresIn: REFRESH_AGE,
            jwtid: sessionId
        }
    );
}

export function verifyAccessToken(token) {
    return jwt.verify(
        token,
        ACCESS_SECRET
    );
}

export function verifyRefreshToken(token) {
    return jwt.verify(
        token,
        REFRESH_SECRET
    );
}