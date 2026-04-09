import { Router } from 'express';
import { 
  iniciarGrabacion,
  responderGrabacion,
  finalizarGrabacion 
} from '../controllers/grabacionController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

router.use(authenticateToken);

router.post('/iniciar', iniciarGrabacion);
router.post('/:turnoId/responder', responderGrabacion);
router.post('/:turnoId/finalizar', finalizarGrabacion);

export default router;