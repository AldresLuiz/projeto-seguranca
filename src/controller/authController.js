import { Router } from "express";
import { authLoginDTO } from "../datamodel/authDTO";
import pool from "../service/databaseService";

const router = Router();

// Rota para criar usuario
router.post("/auth/register", (req, res)=>{
    const body = authLoginDTO.safeParse(req.body)

    
})