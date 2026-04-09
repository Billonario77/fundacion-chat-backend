import { Router } from 'express';
import { 
  getUsuarios,
  getGuias,
  toggleUsuarioEstado,
  toggleGuiaDisponibilidad,
  actualizarRol
} from '../controllers/adminUsuariosController';
import { authenticateToken, requireAdmin } from '../middleware/auth';

const router = Router();

// Todas las rutas requieren autenticación y ser admin
router.use(authenticateToken);
router.use(requireAdmin);

// Rutas para gestión de usuarios
router.get('/usuarios', getUsuarios);
router.get('/guias', getGuias);
router.patch('/usuarios/:usuarioId/toggle', toggleUsuarioEstado);
router.patch('/guias/:guiaId/toggle', toggleGuiaDisponibilidad);
router.patch('/usuarios/:usuarioId/rol', actualizarRol);

export default router;