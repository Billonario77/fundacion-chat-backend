import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { pool } from '../database/connection';

// Obtener reprogramaciones del usuario autenticado
export const getMisReprogramaciones = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const usuarioId = req.user?.id;

    if (!usuarioId) {
      res.status(401).json({ error: 'No autenticado' });
      return;
    }

    if (req.user?.tipo !== 'usuario') {
      res.status(403).json({ error: 'Acceso solo para usuarios' });
      return;
    }

    const query = `
      SELECT 
        r.id,
        r.turno_original_id,
        r.preferencia,
        r.fecha_preferida,
        r.comentarios,
        r.estado,
        r.created_at,
        r.updated_at,
        t.fecha_programada as turno_original_fecha,
        t.estado as turno_original_estado,
        g.nombre as guia_nombre
      FROM reprogramaciones r
      JOIN turnos t ON r.turno_original_id = t.id
      LEFT JOIN guias g ON t.guia_id = g.id
      WHERE r.usuario_id = $1
      ORDER BY r.created_at DESC
    `;

    const result = await pool.query(query, [usuarioId]);

    res.json(result.rows);

  } catch (error) {
    console.error('Error al obtener reprogramaciones:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// Obtener una reprogramación específica
export const getReprogramacionById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const usuarioId = req.user?.id;
    const { reprogramacionId } = req.params;

    if (!usuarioId) {
      res.status(401).json({ error: 'No autenticado' });
      return;
    }

    const query = `
      SELECT 
        r.*,
        t.fecha_programada as turno_original_fecha,
        t.estado as turno_original_estado,
        g.nombre as guia_nombre
      FROM reprogramaciones r
      JOIN turnos t ON r.turno_original_id = t.id
      LEFT JOIN guias g ON t.guia_id = g.id
      WHERE r.id = $1 AND r.usuario_id = $2
    `;

    const result = await pool.query(query, [reprogramacionId, usuarioId]);

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Reprogramación no encontrada' });
      return;
    }

    res.json(result.rows[0]);

  } catch (error) {
    console.error('Error al obtener reprogramación:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// Cancelar una solicitud de reprogramación (si el usuario cambia de opinión)
export const cancelarReprogramacion = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const usuarioId = req.user?.id;
    const { reprogramacionId } = req.params;

    if (!usuarioId) {
      res.status(401).json({ error: 'No autenticado' });
      return;
    }

    if (req.user?.tipo !== 'usuario') {
      res.status(403).json({ error: 'Acceso solo para usuarios' });
      return;
    }

    // Verificar que la reprogramación pertenece al usuario y está pendiente
    const checkQuery = `
      SELECT id FROM reprogramaciones 
      WHERE id = $1 AND usuario_id = $2 AND estado = 'pendiente'
    `;
    const checkResult = await pool.query(checkQuery, [reprogramacionId, usuarioId]);

    if (checkResult.rows.length === 0) {
      res.status(404).json({ error: 'Solicitud de reprogramación no encontrada o ya procesada' });
      return;
    }

    // Actualizar estado a cancelada
    const updateQuery = `
      UPDATE reprogramaciones 
      SET estado = 'cancelada', updated_at = NOW()
      WHERE id = $1
      RETURNING id
    `;
    await pool.query(updateQuery, [reprogramacionId]);

    res.json({ message: 'Solicitud de reprogramación cancelada' });

  } catch (error) {
    console.error('Error al cancelar reprogramación:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};



// ============================================
// NUEVA: Solicitar cambio de guía (preferencia general)
// ============================================
export const solicitarCambioGuia = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const usuarioId = req.user?.id;
    const { preferencia } = req.body; // 'mismo_guia' o 'otro_guia'

    if (!usuarioId) {
      res.status(401).json({ error: 'No autenticado' });
      return;
    }

    if (req.user?.tipo !== 'usuario') {
      res.status(403).json({ error: 'Acceso solo para usuarios' });
      return;
    }

    if (!preferencia || !['mismo_guia', 'otro_guia'].includes(preferencia)) {
      res.status(400).json({ error: 'Preferencia no válida' });
      return;
    }

    // Verificar si ya existe una preferencia pendiente
    const checkQuery = `
      SELECT id FROM preferencias_usuario 
      WHERE usuario_id = $1 AND estado = 'pendiente'
    `;
    const checkResult = await pool.query(checkQuery, [usuarioId]);

    if (checkResult.rows.length > 0) {
      // Actualizar la preferencia existente
      const updateQuery = `
        UPDATE preferencias_usuario 
        SET preferencia = $1, updated_at = NOW()
        WHERE usuario_id = $2 AND estado = 'pendiente'
        RETURNING id
      `;
      await pool.query(updateQuery, [preferencia, usuarioId]);
    } else {
      // Crear nueva preferencia
      const insertQuery = `
        INSERT INTO preferencias_usuario (usuario_id, preferencia, estado)
        VALUES ($1, $2, 'pendiente')
        RETURNING id
      `;
      await pool.query(insertQuery, [usuarioId, preferencia]);
    }

    // Notificar a admins (opcional)
    console.log(`📢 Usuario ${usuarioId} solicitó cambio de guía: ${preferencia}`);

    res.json({ 
      message: 'Preferencia guardada correctamente',
      preferencia 
    });

  } catch (error) {
    console.error('Error al guardar preferencia:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};