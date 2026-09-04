import e from "express"
import cp from "cookie-parser"
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

app.listen(Number(process.env.BACKEND_PORT), ()=>{
    console.log(`Servidor iniciado: http://0.0.0.0:${Number(process.env.BACKEND_PORT)}`)
})