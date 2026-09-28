import z from "zod";

export const authRegisterDTO = z.object({
    name: z.string()
        .min(3, "O nome precisa ter pelo menos 3 caracteres"),
    email: z.email(),
    password: z.string()
        .min(8, "A senha deve conter no minimo 8 caracteres")
        .max(72, "A senha deve ser menor que 72 caracteres"),
    number: z.string()
        .min(11, "O numero de telefone deve conter 11 digitos")
        .max(11, "O numero de telefone deve conter 11 digitos")
        .optional()
})

export const authLoginDTO = z.object({
    email: z.email(),
    password: z.string()
        .min(8, "A senha deve conter no minimo 8 caracteres")
        .max(72, "A senha deve ser menor que 72 caracteres")
})

export const authUserMiddlewareDTO = z.object({
    userId: z.uuid(),
    role: z.int
})