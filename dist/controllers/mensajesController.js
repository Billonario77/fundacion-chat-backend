"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMensajesNoLeidos = exports.marcarComoLeidos = exports.getMensajesPorTurno = exports.enviarMensaje = void 0;
const connection_1 = require("../database/connection");
const socketService_1 = require("../services/socketService");
const enviarMensaje = async (req, res) => {
    try {
        const emisorId = req.user?.id;
        const emisorTipo = req.user?.tipo;
        const { turnoId, contenido } = req.body;
        if (!emisorId || !emisorTipo) {
            res.status(401).json({ error: 'No autenticado' });
            return;
        }
        if (!contenido || contenido.trim() === '') {
            res.status(400).json({ error: 'El mensaje no puede estar vacío' });
            return;
        }
        let turnoQuery = '';
        let turnoParams = [];
        if (emisorTipo === 'usuario') {
            turnoQuery = 'SELECT id, usuario_id, guia_id FROM turnos WHERE id = $1 AND usuario_id = $2';
            turnoParams = [turnoId, emisorId];
        }
        else if (emisorTipo === 'guia') {
            turnoQuery = 'SELECT id, usuario_id, guia_id FROM turnos WHERE id = $1 AND guia_id = $2';
            turnoParams = [turnoId, emisorId];
        }
        else {
            res.status(403).json({ error: 'Tipo de usuario no autorizado para enviar mensajes' });
            return;
        }
        const turnoResult = await connection_1.pool.query(turnoQuery, turnoParams);
        if (turnoResult.rows.length === 0) {
            res.status(404).json({ error: 'Turno no encontrado o no tienes acceso' });
            return;
        }
        const turno = turnoResult.rows[0];
        const receptorId = emisorTipo === 'usuario' ? turno.guia_id : turno.usuario_id;
        if (!receptorId) {
            res.status(400).json({ error: 'El turno no tiene un guía asignado aún' });
            return;
        }
        const insertQuery = `
      INSERT INTO mensajes (turno_id, emisor_id, emisor_tipo, contenido)
      VALUES ($1, $2, $3, $4)
      RETURNING id, created_at
    `;
        const result = await connection_1.pool.query(insertQuery, [turnoId, emisorId, emisorTipo, contenido]);
        const mensajeId = result.rows[0].id;
        const mensajeQuery = `
      SELECT 
        id, turno_id, emisor_id, emisor_tipo, contenido, leido, created_at
      FROM mensajes
      WHERE id = $1
    `;
        const mensajeResult = await connection_1.pool.query(mensajeQuery, [mensajeId]);
        const mensaje = mensajeResult.rows[0];
        (0, socketService_1.notificarUsuario)(receptorId, 'nuevo-mensaje', {
            mensaje: mensaje,
            turnoId: turnoId
        });
        res.status(201).json(mensaje);
    }
    catch (error) {
        console.error('Error al enviar mensaje:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
};
exports.enviarMensaje = enviarMensaje;
const getMensajesPorTurno = async (req, res) => {
    try {
        const usuarioId = req.user?.id;
        const usuarioTipo = req.user?.tipo;
        const { turnoId } = req.params;
        if (!usuarioId || !usuarioTipo) {
            res.status(401).json({ error: 'No autenticado' });
            return;
        }
        let accesoQuery = '';
        let accesoParams = [];
        if (usuarioTipo === 'usuario') {
            accesoQuery = 'SELECT id FROM turnos WHERE id = $1 AND usuario_id = $2';
            accesoParams = [turnoId, usuarioId];
        }
        else if (usuarioTipo === 'guia') {
            accesoQuery = 'SELECT id FROM turnos WHERE id = $1 AND guia_id = $2';
            accesoParams = [turnoId, usuarioId];
        }
        else {
            res.status(403).json({ error: 'No autorizado' });
            return;
        }
        const accesoResult = await connection_1.pool.query(accesoQuery, accesoParams);
        if (accesoResult.rows.length === 0) {
            res.status(404).json({ error: 'Turno no encontrado o no tienes acceso' });
            return;
        }
        const mensajesQuery = `
      SELECT 
        id, turno_id, emisor_id, emisor_tipo, contenido, leido, created_at
      FROM mensajes
      WHERE turno_id = $1
      ORDER BY created_at ASC
    `;
        const mensajesResult = await connection_1.pool.query(mensajesQuery, [turnoId]);
        const updateQuery = `
      UPDATE mensajes
      SET leido = true
      WHERE turno_id = $1 AND emisor_id != $2 AND leido = false
    `;
        await connection_1.pool.query(updateQuery, [turnoId, usuarioId]);
        res.json(mensajesResult.rows);
    }
    catch (error) {
        console.error('Error al obtener mensajes:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
};
exports.getMensajesPorTurno = getMensajesPorTurno;
const marcarComoLeidos = async (req, res) => {
    try {
        const usuarioId = req.user?.id;
        const { turnoId } = req.params;
        if (!usuarioId) {
            res.status(401).json({ error: 'No autenticado' });
            return;
        }
        console.log('🔍 marcandoComoLeidos - Usuario:', usuarioId, 'Turno:', turnoId);
        const turnoQuery = await connection_1.pool.query('SELECT usuario_id, guia_id FROM turnos WHERE id = $1', [turnoId]);
        if (turnoQuery.rows.length === 0) {
            res.status(404).json({ error: 'Turno no encontrado' });
            return;
        }
        const turno = turnoQuery.rows[0];
        console.log('🔍 VERIFICACIÓN:');
        console.log('   - usuarioId (quien marcó):', usuarioId);
        console.log('   - turno.usuario_id:', turno.usuario_id);
        console.log('   - turno.guia_id:', turno.guia_id);
        const query = `
      UPDATE mensajes
      SET leido = true
      WHERE turno_id = $1 AND emisor_id != $2 AND leido = false
      RETURNING id
    `;
        const result = await connection_1.pool.query(query, [turnoId, usuarioId]);
        console.log('📊 Mensajes marcados como leídos:', result.rows.length);
        if (usuarioId === turno.usuario_id) {
            if (turno.guia_id) {
                console.log(`📢 Usuario leyó - notificando a guía ${turno.guia_id} para turno ${turnoId}`);
                (0, socketService_1.notificarUsuario)(turno.guia_id, 'mensajes-leidos', {
                    turnoId: turnoId,
                    leidosPor: usuarioId,
                    cantidad: result.rows.length
                });
            }
            else {
                console.log('❌ El turno no tiene guía asignado');
            }
        }
        else {
            console.log('👤 Guía leyó - NO se notifica al usuario');
        }
        res.json({
            marcados: result.rows.length,
            mensaje: 'Mensajes marcados como leídos'
        });
    }
    catch (error) {
        console.error('Error al marcar mensajes:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
};
exports.marcarComoLeidos = marcarComoLeidos;
const getMensajesNoLeidos = async (req, res) => {
    try {
        const usuarioId = req.user?.id;
        const rol = req.user?.tipo;
        if (!usuarioId) {
            res.status(401).json({ error: 'No autenticado' });
            return;
        }
        let query = '';
        if (rol === 'guia') {
            query = `
        SELECT 
          m.turno_id,
          COUNT(m.id) as cantidad
        FROM mensajes m
        INNER JOIN turnos t ON m.turno_id = t.id
        WHERE t.guia_id = $1 
          AND m.leido = false 
          AND m.emisor_id != $1
          AND t.estado IN ('aceptado', 'iniciado')
        GROUP BY m.turno_id
      `;
        }
        else if (rol === 'usuario') {
            query = `
        SELECT 
          m.turno_id,
          COUNT(m.id) as cantidad
        FROM mensajes m
        INNER JOIN turnos t ON m.turno_id = t.id
        WHERE t.usuario_id = $1 
          AND m.leido = false 
          AND m.emisor_id != $1
          AND t.estado IN ('aceptado', 'iniciado')
        GROUP BY m.turno_id
      `;
        }
        else {
            res.status(403).json({ error: 'Rol no autorizado' });
            return;
        }
        const result = await connection_1.pool.query(query, [usuarioId]);
        const noLeidos = result.rows.reduce((acc, row) => {
            acc[row.turno_id] = parseInt(row.cantidad);
            return acc;
        }, {});
        res.json({ noLeidos });
    }
    catch (error) {
        console.error('Error al obtener mensajes no leídos:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
};
exports.getMensajesNoLeidos = getMensajesNoLeidos;
//# sourceMappingURL=mensajesController.js.map