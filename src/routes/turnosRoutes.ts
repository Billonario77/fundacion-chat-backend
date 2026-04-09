import { Router } from 'express';
import { authenticateToken, requireGuia } from '../middleware/auth';
import { 
  solicitarApoyo, 
  misTurnos, 
  actualizarEstadoTurno, 
  obtenerTurnoPorId,
  misSolicitudes,
  getHistorialTurnos,
  cancelarTurno,
  reprogramarTurno,
  getMisReprogramaciones,
  marcarCancelacionesComoVistas,
  hayCancelacionesNoVistas,
  contarCancelacionesNoVistas,
  obtenerCancelacionesAdmin,
  obtenerMetricasCancelaciones,
  getHistorialAdmin
} from '../controllers/turnosController';

const router = Router();

// Todas las rutas requieren autenticación
router.use(authenticateToken);

// PRIMERO: Rutas específicas (que no tienen parámetro variable)
router.get('/mis-solicitudes', misSolicitudes);
router.get('/mis-turnos', requireGuia, misTurnos);
router.get('/historial', getHistorialTurnos);

// Marcar cancelaciones como vistas (van antes de las rutas con parámetro)
router.post('/marcar-cancelaciones-vistas', marcarCancelacionesComoVistas);
router.get('/cancelaciones-no-vistas', hayCancelacionesNoVistas);

// SEGUNDO: Rutas con acción (tienen parámetro :turnoId)
router.post('/solicitar', solicitarApoyo);
router.patch('/:turnoId/cancelar', cancelarTurno);
router.post('/:turnoId/reprogramar', reprogramarTurno);
router.patch('/:turnoId/estado', actualizarEstadoTurno);

// ÚLTIMO: Ruta genérica por ID (debe ir al final)
router.get('/:turnoId', obtenerTurnoPorId);

router.get('/cancelaciones-no-vistas/count', authenticateToken, contarCancelacionesNoVistas);

// Rutas para admin (cancelaciones)
router.get('/admin/cancelaciones', authenticateToken, obtenerCancelacionesAdmin);
router.get('/admin/cancelaciones/metricas', authenticateToken, obtenerMetricasCancelaciones);
router.get('/admin/historial', authenticateToken, getHistorialAdmin);

export default router;