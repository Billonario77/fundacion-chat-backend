import { Router } from 'express';
import { 
  getMisReprogramaciones,
  getReprogramacionById,
  cancelarReprogramacion,
  solicitarCambioGuia
} from '../controllers/reprogramacionController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Todas las rutas requieren autenticación
router.use(authenticateToken);

// Rutas para usuarios
router.get('/mis-reprogramaciones', getMisReprogramaciones);
router.get('/:reprogramacionId', getReprogramacionById);
router.patch('/:reprogramacionId/cancelar', cancelarReprogramacion);


// ============================================
// NUEVA RUTA: Solicitar cambio de guía
// ============================================
router.post('/solicitar-cambio-guia', solicitarCambioGuia);

export default router;