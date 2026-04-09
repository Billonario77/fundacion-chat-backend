import { Router } from 'express';
import { 
  getSolicitudesPendientes,
  getGuiasDisponibles,
  crearTurnoReprogramado,
  asignarGuia,
  getTurnosPendientesAsignacion,
  asignarGuiaATurno,
  getGuiasConUsuarios,
  buscarUsuarioConGuia,
  getTodosGuias,
  getTodosUsuarios,
  getTodosUsuariosConGuia,
  contarReprogramacionesPendientes
} from '../controllers/adminController';
import { authenticateToken } from '../middleware/auth';

const router = Router();
console.log('✅ adminRoutes.ts cargado - rutas disponibles:');
console.log('   POST /reprogramaciones/:solicitudId/crear-turno');

// Todas las rutas requieren autenticación
router.use(authenticateToken);

// Rutas de reprogramaciones
router.get('/reprogramaciones/pendientes', getSolicitudesPendientes);
router.post('/reprogramaciones/:solicitudId/asignar', asignarGuia);
router.post('/reprogramaciones/:solicitudId/crear-turno', crearTurnoReprogramado);
router.get('/reprogramaciones/pendientes/count', authenticateToken, contarReprogramacionesPendientes);

// Rutas de guías
router.get('/guias/disponibles', getGuiasDisponibles);

// Rutas de turnos pendientes
router.get('/turnos/pendientes-asignacion', getTurnosPendientesAsignacion);
router.post('/turnos/:turnoId/asignar-guia', asignarGuiaATurno);

// Nuevas rutas para asignaciones
router.get('/asignaciones/guias-con-usuarios', getGuiasConUsuarios);
router.get('/asignaciones/buscar-usuario', buscarUsuarioConGuia);

// Rutas para listas (filtros)
router.get('/guias', getTodosGuias);
router.get('/usuarios', getTodosUsuarios);

router.get('/usuarios-con-guia', getTodosUsuariosConGuia);

export default router;