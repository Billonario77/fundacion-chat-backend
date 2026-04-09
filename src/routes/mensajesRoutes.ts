import { Router } from 'express';
import { 
  enviarMensaje,
  getMensajesPorTurno,
  marcarComoLeidos,
  getMensajesNoLeidos
} from '../controllers/mensajesController';

import { authenticateToken } from '../middleware/auth';

const router = Router();

// Todas las rutas requieren autenticación
router.use(authenticateToken);

// Rutas de mensajes
router.post('/enviar', enviarMensaje);
router.get('/no-leidos', getMensajesNoLeidos);
router.get('/turno/:turnoId', getMensajesPorTurno);
router.patch('/turno/:turnoId/leer', marcarComoLeidos);

export default router;