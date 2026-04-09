"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.solicitarCambioGuia = exports.cancelarReprogramacion = exports.getReprogramacionById = exports.getMisReprogramaciones = void 0;
const connection_1 = require("../database/connection");
const getMisReprogramaciones = async (req, res) => {
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
        const result = await connection_1.pool.query(query, [usuarioId]);
        res.json(result.rows);
    }
    catch (error) {
        console.error('Error al obtener reprogramaciones:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
};
exports.getMisReprogramaciones = getMisReprogramaciones;
const getReprogramacionById = async (req, res) => {
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
        const result = await connection_1.pool.query(query, [reprogramacionId, usuarioId]);
        if (result.rows.length === 0) {
            res.status(404).json({ error: 'Reprogramación no encontrada' });
            return;
        }
        res.json(result.rows[0]);
    }
    catch (error) {
        console.error('Error al obtener reprogramación:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
};
exports.getReprogramacionById = getReprogramacionById;
const cancelarReprogramacion = async (req, res) => {
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
        const checkQuery = `
      SELECT id FROM reprogramaciones 
      WHERE id = $1 AND usuario_id = $2 AND estado = 'pendiente'
    `;
        const checkResult = await connection_1.pool.query(checkQuery, [reprogramacionId, usuarioId]);
        if (checkResult.rows.length === 0) {
            res.status(404).json({ error: 'Solicitud de reprogramación no encontrada o ya procesada' });
            return;
        }
        const updateQuery = `
      UPDATE reprogramaciones 
      SET estado = 'cancelada', updated_at = NOW()
      WHERE id = $1
      RETURNING id
    `;
        await connection_1.pool.query(updateQuery, [reprogramacionId]);
        res.json({ message: 'Solicitud de reprogramación cancelada' });
    }
    catch (error) {
        console.error('Error al cancelar reprogramación:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
};
exports.cancelarReprogramacion = cancelarReprogramacion;
const solicitarCambioGuia = async (req, res) => {
    try {
        const usuarioId = req.user?.id;
        const { preferencia } = req.body;
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
        const checkQuery = `
      SELECT id FROM preferencias_usuario 
      WHERE usuario_id = $1 AND estado = 'pendiente'
    `;
        const checkResult = await connection_1.pool.query(checkQuery, [usuarioId]);
        if (checkResult.rows.length > 0) {
            const updateQuery = `
        UPDATE preferencias_usuario 
        SET preferencia = $1, updated_at = NOW()
        WHERE usuario_id = $2 AND estado = 'pendiente'
        RETURNING id
      `;
            await connection_1.pool.query(updateQuery, [preferencia, usuarioId]);
        }
        else {
            const insertQuery = `
        INSERT INTO preferencias_usuario (usuario_id, preferencia, estado)
        VALUES ($1, $2, 'pendiente')
        RETURNING id
      `;
            await connection_1.pool.query(insertQuery, [usuarioId, preferencia]);
        }
        console.log(`📢 Usuario ${usuarioId} solicitó cambio de guía: ${preferencia}`);
        res.json({
            message: 'Preferencia guardada correctamente',
            preferencia
        });
    }
    catch (error) {
        console.error('Error al guardar preferencia:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
};
exports.solicitarCambioGuia = solicitarCambioGuia;
//# sourceMappingURL=reprogramacionController.js.map