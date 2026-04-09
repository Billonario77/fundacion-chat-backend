import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { pool } from '../database/connection';
import { notificarUsuario } from '../services/socketService';

export const iniciarGrabacion = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const usuarioId = req.user?.id;
    const { turnoId } = req.body;

    if (!usuarioId) {
      res.status(401).json({ error: 'No autenticado' });
      return;
    }

    // Verificar que el usuario tiene acceso al turno
    const turnoQuery = `
      SELECT t.*, u.id as usuario_id, g.id as guia_id
      FROM turnos t
      LEFT JOIN usuarios u ON t.usuario_id = u.id
      LEFT JOIN guias g ON t.guia_id = g.id
      WHERE t.id = $1
    `;

    const turnoResult = await pool.query(turnoQuery, [turnoId]);
    
    if (turnoResult.rows.length === 0) {
      res.status(404).json({ error: 'Turno no encontrado' });
      return;
    }

    const turno = turnoResult.rows[0];

    // Registrar solicitud de grabación
    await pool.query(
      `INSERT INTO grabaciones (turno_id, solicitado_por, estado)
       VALUES ($1, $2, 'solicitado')`,
      [turnoId, usuarioId]
    );

    // Notificar al otro participante
    const otroParticipanteId = req.user?.tipo === 'usuario' ? turno.guia_id : turno.usuario_id;
    
    if (otroParticipanteId) {
      notificarUsuario(otroParticipanteId, 'solicitud-grabacion', {
        turnoId,
        solicitadoPor: req.user?.tipo,
        mensaje: 'Se solicita permiso para grabar la videollamada'
      });
    }

    res.json({ 
      message: 'Solicitud de grabación enviada',
      estado: 'pendiente'
    });

  } catch (error) {
    console.error('Error al iniciar grabación:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

export const responderGrabacion = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const usuarioId = req.user?.id;
    const { turnoId } = req.params;
    const { respuesta } = req.body; // 'aprobado' o 'rechazado'

    if (!usuarioId) {
      res.status(401).json({ error: 'No autenticado' });
      return;
    }

    if (!['aprobado', 'rechazado'].includes(respuesta)) {
      res.status(400).json({ error: 'Respuesta no válida' });
      return;
    }

    // Actualizar estado de la grabación
    const query = `
      UPDATE grabaciones 
      SET estado = $1
      WHERE turno_id = $2 AND estado = 'solicitado'
      RETURNING id, solicitado_por
    `;

    const result = await pool.query(query, [respuesta, turnoId]);

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'No hay solicitud pendiente' });
      return;
    }

    const solicitadoPor = result.rows[0].solicitado_por;

    // Notificar al solicitante
    notificarUsuario(solicitadoPor, 'respuesta-grabacion', {
      turnoId,
      respuesta,
      mensaje: respuesta === 'aprobado' 
        ? '✅ Grabación aprobada - La videollamada será grabada'
        : '❌ Grabación rechazada - No se grabará la videollamada'
    });

    res.json({ 
      message: `Solicitud ${respuesta}`,
      estado: respuesta
    });

  } catch (error) {
    console.error('Error al responder grabación:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

export const finalizarGrabacion = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { turnoId } = req.params;
    const { urlGrabacion } = req.body;

    const query = `
      UPDATE grabaciones 
      SET estado = 'completada', 
          url_grabacion = $1,
          fecha_fin = CURRENT_TIMESTAMP
      WHERE turno_id = $2 AND estado = 'activa'
      RETURNING id
    `;

    const result = await pool.query(query, [urlGrabacion, turnoId]);

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'No hay grabación activa' });
      return;
    }

    res.json({ message: 'Grabación finalizada' });

  } catch (error) {
    console.error('Error al finalizar grabación:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};