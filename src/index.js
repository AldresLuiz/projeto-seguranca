import e from "express"
import cp from "cookie-parser"
import authController from "./controller/authController.js"
import { verifyAccessToken } from "./service/authService.js"
const app = e()

app.use(e.json())
app.use(cp())


app.use((req,res,next)=>{
  const agora = new Date();
  const data = agora.toLocaleDateString("pt-BR", { timeZone: "America/Recife" });
  const hora = agora.toLocaleTimeString("pt-BR", { timeZone: "America/Recife" });
  const ip = req.ip.replace(/^::ffff:/, "");

  console.log(`${data} ${hora} | ${ip} : ${req.method} ${req.originalUrl}`);
  next();
})

app.use(authController)

// Middleware de autenticação
app.use((req, res, next)=>{
  const access = req.cookies.ACCESS
  if (!access) return res.status(403).json({ error: "é necessario estar autenticado para acessar essa rota" })
  
  if(!verifyAccessToken(access)) return res.status(403).json({ error: "Acesso invalido/expirado" })
  next()
})



app.listen(Number(process.env.BACKEND_PORT), ()=>{
    console.log(`Servidor iniciado: http://0.0.0.0:${Number(process.env.BACKEND_PORT)}`)
})