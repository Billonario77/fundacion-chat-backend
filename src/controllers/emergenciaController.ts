import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { pool } from '../database/connection';
import { notificarUsuario, notificarAAdmins } from '../services/socketService';

export const activarEmergencia = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const usuarioId = req.user?.id;
    const usuarioTipo = req.user?.tipo;
    const { turnoId, motivo } = req.body;

    if (!usuarioId) {
      res.status(401).json({ error: 'No autenticado' });
      return;
    }

    // Obtener información del turno
    const turnoQuery = `
      SELECT 
        t.*,
        u.id as usuario_id,
        u.nombre as usuario_nombre,
        u.email as usuario_email,
        g.id as guia_id,
        g.nombre as guia_nombre,
        g.email as guia_email
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

    // Determinar a quién notificar según quién activa la emergencia
    if (usuarioTipo === 'usuario') {
      // Usuario activa emergencia → notificar al guía
      if (turno.guia_id) {
        notificarUsuario(turno.guia_id, 'emergencia-activada', {
          turnoId: turnoId,
          activadoPor: 'usuario',
          activadoPorNombre: turno.usuario_nombre,
          motivo: motivo || 'Emergencia durante la videollamada'
        });
      }
    } else if (usuarioTipo === 'guia') {
      // Guía activa emergencia → notificar al usuario
      if (turno.usuario_id) {
        notificarUsuario(turno.usuario_id, 'emergencia-activada', {
          turnoId: turnoId,
          activadoPor: 'guia',
          activadoPorNombre: turno.guia_nombre,
          motivo: motivo || 'Emergencia durante la videollamada'
        });
      }
    }

    // Siempre notificar a todos los admins
    notificarAAdmins('emergencia-activada', {
      turnoId: turnoId,
      activadoPor: usuarioTipo,
      activadoPorId: usuarioId,
      activadoPorNombre: usuarioTipo === 'usuario' ? turno.usuario_nombre : turno.guia_nombre,
      motivo: motivo || 'Emergencia durante la videollamada',
      timestamp: new Date().toISOString()
    });

    // Registrar en auditoría
    await pool.query(
      `INSERT INTO auditoria_logs (usuario_afectado_id, admin_id, accion, detalles)
       VALUES ($1, $2, $3, $4)`,
      [
        usuarioId,
        null,
        'emergencia_activada',
        JSON.stringify({ 
          turnoId, 
          motivo: motivo || 'Emergencia durante la videollamada',
          activadoPor: usuarioTipo
        })
      ]
    );

    res.json({ 
      message: 'Emergencia activada correctamente',
      notificado: true
    });

  } catch (error) {
    console.error('Error al activar emergencia:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};