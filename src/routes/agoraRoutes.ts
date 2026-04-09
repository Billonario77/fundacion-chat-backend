import { Router } from 'express';
import { generarToken } from '../controllers/agoraController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

router.use(authenticateToken);
router.post('/token', generarToken);

export default router;