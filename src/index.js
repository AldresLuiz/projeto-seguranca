import e from "express"
import cp from "cookie-parser"
import authController from "./controller/authController.js"
import productsController from "./controller/productsController.js"
import cartController from "./controller/cartController.js"
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
app.use(productsController)
app.use(cartController)

app.listen(Number(process.env.BACKEND_PORT), ()=>{
    console.log(`Servidor iniciado: http://0.0.0.0:${Number(process.env.BACKEND_PORT)}`)
})