import { Router } from 'express';
import { getEstadisticas } from '../controllers/estadisticasController';
import { authenticateToken, requireAdmin } from '../middleware/auth';

const router = Router();

// Todas las rutas requieren autenticación y ser admin
router.use(authenticateToken);
router.use(requireAdmin);

// Ruta para obtener estadísticas
router.get('/', getEstadisticas);

export default router;