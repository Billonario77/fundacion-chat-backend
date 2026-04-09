// backend/src/routes/authRoutes.ts
import { Router } from 'express';
import { 
    registro, 
    validateRegistro, 
    login, 
    validateLogin,
    perfil 
} from '../controllers/authController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Rutas públicas
router.post('/registro', validateRegistro, registro);
router.post('/login', validateLogin, login);

// Rutas protegidas
router.get('/perfil', authenticateToken, perfil);

export default router;