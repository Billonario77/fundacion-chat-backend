import { Router } from 'express';
import { activarEmergencia } from '../controllers/emergenciaController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

router.use(authenticateToken);
router.post('/activar', activarEmergencia);

export default router;