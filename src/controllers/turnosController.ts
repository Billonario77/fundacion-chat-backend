import { Request, Response } from 'express';
import apoyoQueue, { SolicitudApoyo } from '../queues/apoyoQueue';
import { AuthRequest } from '../middleware/auth';
import { pool } from '../database/connection';
import { notificarUsuario } from '../services/socketService';
import { notificarAAdmins } from '../services/socketService';


export const solicitarApoyo = async (req: Request, res: Response): Promise<void> => {
  try {
    const { tipo, mensajeInicial, fechaPreferida } = req.body;
    const usuarioId = (req as AuthRequest).user?.id;

    console.log('📥 solicitarApoyo - body recibido:', req.body);

    if (!usuarioId) {
      res.status(401).json({ error: 'Usuario no autenticado' });
      return;
    }

    if (!tipo || !['crisis', 'apoyo', 'seguimiento'].includes(tipo)) {
      res.status(400).json({ error: 'Tipo de apoyo inválido' });
      return;
    }

    // ============================================
    // VALIDACIONES DE DISPONIBILIDAD DEL USUARIO
    // ============================================
    let fechaProgramada: Date;
    if (fechaPreferida) {
      fechaProgramada = new Date(fechaPreferida);
      
      if (fechaProgramada <= new Date()) {
        res.status(400).json({ error: 'La fecha debe ser posterior a la fecha actual' });
        return;
      }

      const duracion = 60;
      const fechaInicio = new Date(fechaProgramada);
      const fechaFin = new Date(fechaProgramada);
      fechaFin.setMinutes(fechaFin.getMinutes() + duracion);

      const turnosUsuario = await pool.query(
        `SELECT id FROM turnos 
         WHERE usuario_id = $1 
         AND estado IN ('pendiente', 'aceptado', 'iniciado')
         AND (
           (fecha_programada < $2 AND (fecha_programada + (COALESCE(duracion_minutos, 60) * interval '1 minute')) > $3)
           OR
           (fecha_programada >= $3 AND fecha_programada < $2)
         )`,
        [usuarioId, fechaFin, fechaInicio]
      );

      if (turnosUsuario.rows.length > 0) {
        res.status(400).json({ 
          error: `Ya tienes un turno programado en ese horario (${fechaInicio.toLocaleString()} - ${fechaFin.toLocaleString()}). Por favor, elige otra fecha u hora.`
        });
        return;
      }
    } else {
      fechaProgramada = new Date();
    }

    // ============================================
    // DETERMINAR SI ES PRIMERA VEZ
    // ============================================
    const turnosPreviosQuery = await pool.query(
      'SELECT COUNT(*) as total FROM turnos WHERE usuario_id = $1',
      [usuarioId]
    );
    const totalTurnosPrevios = parseInt(turnosPreviosQuery.rows[0].total);
    const esPrimeraVez = totalTurnosPrevios === 0;

    console.log(`👤 Usuario ${usuarioId} - Total turnos previos: ${totalTurnosPrevios}`);
    console.log(`🎯 Es primera vez: ${esPrimeraVez ? 'SÍ' : 'NO'}`);

    // ============================================
    // DETERMINAR GUÍA ASIGNADO
    // ============================================
    let guiaAsignado = null;
    let estado = 'pendiente';

    if (esPrimeraVez) {
      estado = 'pendiente_admin';
      console.log('📋 Primera vez - Pendiente de asignación por admin');
    } else {
      // Verificar preferencia del usuario
      const preferenciaQuery = await pool.query(
        `SELECT preferencia FROM preferencias_usuario 
         WHERE usuario_id = $1 AND estado = 'pendiente'
         ORDER BY created_at DESC 
         LIMIT 1`,
        [usuarioId]
      );
      const ultimaPreferencia = preferenciaQuery.rows[0]?.preferencia;
      console.log(`📋 Última preferencia: ${ultimaPreferencia || 'ninguna'}`);

      if (ultimaPreferencia === 'otro_guia') {
        // Usar último guía asignado
        const ultimoGuiaQuery = await pool.query(
          `SELECT guia_id FROM turnos 
           WHERE usuario_id = $1 AND guia_id IS NOT NULL
           ORDER BY created_at DESC 
           LIMIT 1`,
          [usuarioId]
        );
        if (ultimoGuiaQuery.rows.length > 0) {
          guiaAsignado = ultimoGuiaQuery.rows[0].guia_id;
          console.log(`✅ Usando último guía (nuevo): ${guiaAsignado}`);
        }
      } else {
        // Usar primer guía (original)
        const primerGuiaQuery = await pool.query(
          `SELECT guia_id FROM turnos 
           WHERE usuario_id = $1 AND guia_id IS NOT NULL
           ORDER BY created_at ASC 
           LIMIT 1`,
          [usuarioId]
        );
        if (primerGuiaQuery.rows.length > 0) {
          guiaAsignado = primerGuiaQuery.rows[0].guia_id;
          console.log(`✅ Usando primer guía (original): ${guiaAsignado}`);
        }
      }

      // Buscar turno activo
      if (!guiaAsignado) {
        const turnoActivoQuery = await pool.query(
          `SELECT guia_id FROM turnos 
           WHERE usuario_id = $1 
           AND estado IN ('pendiente', 'aceptado', 'iniciado')
           AND guia_id IS NOT NULL
           ORDER BY created_at DESC 
           LIMIT 1`,
          [usuarioId]
        );
        if (turnoActivoQuery.rows.length > 0) {
          guiaAsignado = turnoActivoQuery.rows[0].guia_id;
          console.log(`✅ Usando guía de turno activo: ${guiaAsignado}`);
        }
      }

      // Asignar guía aleatorio
      if (!guiaAsignado) {
        const guiasDisponibles = await pool.query(
          'SELECT id FROM guias WHERE disponible = true ORDER BY random() LIMIT 1'
        );
        if (guiasDisponibles.rows.length > 0) {
          guiaAsignado = guiasDisponibles.rows[0].id;
          console.log(`✅ Asignando guía aleatorio: ${guiaAsignado}`);
        } else {
          estado = 'pendiente_admin';
          console.log('⚠️ No hay guías disponibles - pendiente de admin');
        }
      }
    }

    // ============================================
    // VALIDAR DISPONIBILIDAD DEL GUÍA (si hay fecha preferida y guía asignado)
    // ============================================
    if (fechaPreferida && guiaAsignado) {
      console.log('🔍 ENTRANDO A VALIDACIÓN DEL GUÍA');
      const duracion = 60;
      const fechaInicio = new Date(fechaProgramada);
      const fechaFin = new Date(fechaProgramada);
      fechaFin.setMinutes(fechaFin.getMinutes() + duracion);

      const turnosGuia = await pool.query(
        `SELECT id, usuario_id, estado, 
                (SELECT nombre FROM usuarios WHERE id = usuario_id) as usuario_nombre
         FROM turnos 
         WHERE guia_id = $1 
         AND estado IN ('pendiente', 'aceptado', 'iniciado')
         AND (
           (fecha_programada < $2 AND (fecha_programada + (COALESCE(duracion_minutos, 60) * interval '1 minute')) > $3)
           OR
           (fecha_programada >= $3 AND fecha_programada < $2)
         )`,
        [guiaAsignado, fechaFin, fechaInicio]
      );

       console.log('📊 Turnos encontrados:', turnosGuia.rows.length);

      if (turnosGuia.rows.length > 0) {
        const conflicto = turnosGuia.rows[0];
        res.status(400).json({ 
          error: `El guía ya tiene un turno programado en ese horario. Por favor, elige otra fecha u hora.`
        });
        return;
      }
    }

    // ============================================
    // CREAR TURNO
    // ============================================
    const query = `
      INSERT INTO turnos (
        usuario_id, 
        guia_id, 
        fecha_programada, 
        estado, 
        modalidad, 
        requiere_asignacion_admin,
        created_at
      )
      VALUES ($1, $2, $3, $4, 'chat', $5, NOW())
      RETURNING id, created_at
    `;
    
    const result = await pool.query(query, [
      usuarioId, 
      guiaAsignado, 
      fechaProgramada,
      estado,
      esPrimeraVez
    ]);
    
    const turnoId = result.rows[0].id;
    console.log(`✅ Turno guardado con ID: ${turnoId}`);

    // ============================================
    // NOTIFICACIONES
    // ============================================
    if (esPrimeraVez) {
      notificarUsuario(usuarioId, 'nuevo-turno-creado', {
        turnoId: turnoId,
        mensaje: 'Tu solicitud ha sido recibida. Un administrador asignará un guía para ti en breve.',
        tipo: tipo,
        requiereAsignacion: true
      });
      notificarAAdmins('nuevo-turno-para-asignar', {
        turnoId: turnoId,
        usuarioId: usuarioId,
        tipo: tipo,
        mensaje: 'Nuevo usuario requiere asignación de guía'
      });
    } else if (guiaAsignado) {
      const guiaNombreQuery = await pool.query(
        'SELECT nombre FROM guias WHERE id = $1',
        [guiaAsignado]
      );
      const guiaNombre = guiaNombreQuery.rows[0]?.nombre || 'tu guía';
      
      notificarUsuario(usuarioId, 'nuevo-turno-creado', {
        turnoId: turnoId,
        mensaje: `Tu solicitud ha sido recibida. Se notificará a ${guiaNombre}.`,
        tipo: tipo
      });
      
      notificarUsuario(guiaAsignado, 'nuevo-turno-disponible', {
        turnoId: turnoId,
        usuarioId: usuarioId,
        tipo: tipo,
        mensaje: `Tienes una nueva solicitud de ${tipo === 'crisis' ? '🆘 crisis' : tipo === 'apoyo' ? '🌱 apoyo' : '📋 seguimiento'}`
      });
    }

    // Marcar preferencia como completada
    if (!esPrimeraVez) {
      await pool.query(
        `UPDATE preferencias_usuario 
         SET estado = 'completada', updated_at = NOW()
         WHERE usuario_id = $1 AND estado = 'pendiente'`,
        [usuarioId]
      );
    }

    res.status(201).json({
      message: 'Solicitud procesada exitosamente',
      turnoId: turnoId,
      requiereAsignacion: esPrimeraVez || !guiaAsignado
    });

  } catch (error) {
    console.error('Error al solicitar apoyo:', error);
    res.status(500).json({ error: 'Error al procesar la solicitud' });
  }
};


export const misTurnos = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const guiaId = req.user?.id;

    if (!guiaId) {
      res.status(401).json({ error: 'No autenticado' });
      return;
    }

    if (req.user?.tipo !== 'guia') {
      res.status(403).json({ error: 'Acceso solo para guías' });
      return;
    }

    const query = `
      SELECT 
        t.id,
        t.fecha_programada,
        t.estado,
        t.modalidad,
        t.created_at,
        t.motivo_cancelacion,
        t.cancelado_por,        -- <-- AGREGAR ESTA LÍNEA
        u.nombre as usuario_nombre,
        u.email as usuario_email
      FROM turnos t
      JOIN usuarios u ON t.usuario_id = u.id
      WHERE t.guia_id = $1
      ORDER BY t.fecha_programada DESC
    `;

    const result = await pool.query(query, [guiaId]);

    res.json({
      total: result.rows.length,
      turnos: result.rows
    });

  } catch (error) {
    console.error('Error al obtener turnos:', error);
    res.status(500).json({ error: 'Error al obtener turnos' });
  }
};


export const actualizarEstadoTurno = async (req: AuthRequest, res: Response): Promise<void> => {
  try {

    console.log('📥 Request body:', req.body);
    console.log('📥 Request params:', req.params);
    console.log('👤 Usuario:', req.user);

    const guiaId = req.user?.id;
    const { turnoId } = req.params;
    const { estado, motivo } = req.body;

    if (!guiaId) {
      res.status(401).json({ error: 'No autenticado' });
      return;
    }

    // Validar estado
    const estadosValidos = ['pendiente', 'aceptado', 'iniciado', 'completado', 'cancelado'];
    if (!estadosValidos.includes(estado)) {
      res.status(400).json({ error: 'Estado no válido' });
      return;
    }

    // Si es cancelación, validar que hay motivo
    if (estado === 'cancelado' && !motivo) {
      res.status(400).json({ error: 'Debe proporcionar un motivo de cancelación' });
      return;
    }

    console.log('🔍 Usuario intentando cambiar estado:', { 
      userId: req.user?.id, 
      tipo: req.user?.tipo, 
      estado, 
      turnoId 
    });

    // ============================================
    // VALIDACIONES DE PERMISOS (AHORA DESPUÉS DE DECLARAR LAS VARIABLES)
    // ============================================
    
    // Si es usuario, solo puede completar turnos
    if (req.user?.tipo === 'usuario') {
      if (estado !== 'completado') {
        res.status(403).json({ error: 'Los usuarios solo pueden finalizar turnos' });
        return;
      }
      
      // Verificar que el turno le pertenece
      const verificarUsuario = await pool.query(
        'SELECT id FROM turnos WHERE id = $1 AND usuario_id = $2',
        [turnoId, req.user.id]
      );
      
      if (verificarUsuario.rows.length === 0) {
        res.status(403).json({ error: 'No puedes finalizar turnos de otros usuarios' });
        return;
      }
    } 
    // Si es guía, puede cambiar cualquier estado
    else if (req.user?.tipo === 'guia') {
      // Verificar que el turno pertenece al guía
      const verificarQuery = 'SELECT id, usuario_id FROM turnos WHERE id = $1 AND guia_id = $2';
      const verificar = await pool.query(verificarQuery, [turnoId, guiaId]);
      
      if (verificar.rows.length === 0) {
        res.status(404).json({ error: 'Turno no encontrado o no pertenece a este guía' });
        return;
      }
    } 
    else {
      res.status(403).json({ error: 'No autorizado' });
      return;
    }

          // Obtener el usuario_id (para notificaciones)
    const turnoData = await pool.query(
      'SELECT usuario_id FROM turnos WHERE id = $1',
      [turnoId]
    );
    const usuarioId = turnoData.rows[0]?.usuario_id;

    // Actualizar el turno y guardar el motivo si es cancelación
    let updateQuery = `
      UPDATE turnos 
      SET estado = $1,
          motivo_cancelacion = $2,
          cancelado_por = $3
    `;

    const params: any[] = [estado, estado === 'cancelado' ? motivo : null, estado === 'cancelado' ? req.user?.tipo : null];

    // Si el estado es 'iniciado', guardar hora_inicio
    if (estado === 'iniciado') {
      updateQuery += `, hora_inicio = COALESCE(hora_inicio, NOW())`;
    }

    // Si el estado es 'completado', guardar hora_fin y calcular duracion_real
    if (estado === 'completado') {
      updateQuery += `, hora_fin = NOW(), duracion_real = EXTRACT(EPOCH FROM (NOW() - COALESCE(hora_inicio, NOW())))/60`;
    }

    updateQuery += ` WHERE id = $${params.length + 1} RETURNING id, estado, fecha_programada`;

    params.push(turnoId);

    const updateResult = await pool.query(updateQuery, params);

    const result = await pool.query(updateQuery, [
      estado,
      estado === 'cancelado' ? motivo : null,
      estado === 'cancelado' ? req.user?.tipo : null,  // <-- Solo guardar si es cancelación
      turnoId
    ]);

    console.log('✅ Update ejecutado, filas afectadas:', result.rowCount);

    const mensajesPorEstado: Record<string, string> = {
      'aceptado': 'Tu turno ha sido aceptado por un guía',
      'iniciado': 'Tu turno ha comenzado',
      'completado': 'Tu turno ha sido completado',
      'cancelado': motivo ? `Tu turno ha sido cancelado. Motivo: ${motivo}` : 'Tu turno ha sido cancelado'
    };

    if (mensajesPorEstado[estado]) {
      console.log('📢 Intentando notificar al usuario:', usuarioId, 'estado:', estado);
      notificarUsuario(usuarioId, 'estado-turno-actualizado', {
        turnoId: turnoId,
        estado: estado,
        mensaje: mensajesPorEstado[estado]
      });
    }

    // También notificar al guía si él mismo realizó la acción
    if (req.user?.tipo === 'guia') {
      console.log('📢 Notificando al guía que canceló:', req.user.id);
      notificarUsuario(req.user.id, 'estado-turno-actualizado', {
        turnoId: turnoId,
        estado: estado,
        mensaje: `Has ${estado === 'cancelado' ? 'cancelado' : 'actualizado'} el turno`
      });
    }

    // También notificar al guía si el estado es 'completado' y quien finalizó fue el usuario
        if (estado === 'completado' && req.user?.tipo === 'usuario') {
          // Obtener el guía del turno
          const guiaData = await pool.query(
            'SELECT guia_id FROM turnos WHERE id = $1',
            [turnoId]
          );
          const guiaId = guiaData.rows[0]?.guia_id;
          
          if (guiaId) {
            console.log('📢 Notificando también al guía:', guiaId);
            notificarUsuario(guiaId, 'estado-turno-actualizado', {
              turnoId: turnoId,
              estado: estado,
              mensaje: 'El usuario ha finalizado la sesión'
            });
          }
        }
      

    // Registrar en auditoría
    await pool.query(
      `INSERT INTO auditoria_logs (usuario_afectado_id, guia_afectado_id, accion, detalles, created_at)
      VALUES ($1, $2, $3, $4, NOW())`,
      [
        usuarioId,
        req.user?.id,
        `turno_${estado}`,
        JSON.stringify({ 
          turno_id: turnoId,
          estado: estado,
          motivo: estado === 'cancelado' ? motivo : null
        })
      ]
    );

    res.json({
      message: 'Estado actualizado correctamente',
      turno: updateResult.rows[0]
    });

  } catch (error) {
    console.error('Error al actualizar estado:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};



// ============================================
// FUNCIÓN CORREGIDA - SIN VERIFICACIÓN DE PERMISOS
// ============================================
export const obtenerTurnoPorId = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const usuarioId = req.user?.id;
    let { turnoId } = req.params;

    if (!usuarioId) {
      res.status(401).json({ error: 'No autenticado' });
      return;
    }

    // Asegurar que turnoId sea un string
    if (Array.isArray(turnoId)) {
      turnoId = turnoId[0];
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(turnoId)) {
      res.status(400).json({ error: 'ID de turno inválido' });
      return;
    }

    const query = `
      SELECT 
        t.id,
        t.fecha_programada,
        t.duracion_minutos,
        t.modalidad,
        t.estado,
        t.hora_inicio,
        t.recordatorio_24h_enviado,
        t.recordatorio_1h_enviado,
        t.created_at,
        u.id as usuario_id,
        u.nombre as usuario_nombre,
        u.email as usuario_email,
        g.id as guia_id_actual,
        g.nombre as guia_nombre
      FROM turnos t
      JOIN usuarios u ON t.usuario_id = u.id
      LEFT JOIN guias g ON t.guia_id = g.id
      WHERE t.id = $1
    `;

    const result = await pool.query(query, [turnoId]);

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Turno no encontrado' });
      return;
    }

    const turno = result.rows[0];

    // SIN VERIFICACIÓN DE PERMISOS - ACCESO TEMPORAL
    console.log('✅ Acceso permitido temporalmente para usuario:', usuarioId);

    res.json({
      turno: {
        id: turno.id,
        fecha_programada: turno.fecha_programada,
        duracion_minutos: turno.duracion_minutos,
        modalidad: turno.modalidad,
        estado: turno.estado,
        hora_inicio: turno.hora_inicio,
        recordatorios: {
          enviado_24h: turno.recordatorio_24h_enviado,
          enviado_1h: turno.recordatorio_1h_enviado
        },
        creado_en: turno.created_at,
        usuario: {
          id: turno.usuario_id,
          nombre: turno.usuario_nombre,
          email: turno.usuario_email
        },
        guia: turno.guia_nombre ? {
          id: turno.guia_id_actual,
          nombre: turno.guia_nombre
        } : null
      }
    });

  } catch (error) {
    console.error('Error al obtener turno:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

export const misSolicitudes = async (req: AuthRequest, res: Response): Promise<void> => {
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
        t.id,
        t.fecha_programada,
        t.estado,
        t.modalidad,
        t.created_at,
        t.motivo_cancelacion,
        t.cancelado_por,
        g.nombre as guia_nombre,
        g.email as guia_email
      FROM turnos t
      LEFT JOIN guias g ON t.guia_id = g.id
      WHERE t.usuario_id = $1
      ORDER BY t.fecha_programada DESC
    `;

    const result = await pool.query(query, [usuarioId]);

    res.json({
      total: result.rows.length,
      turnos: result.rows
    });

  } catch (error) {
    console.error('Error al obtener solicitudes:', error);
    res.status(500).json({ error: 'Error al obtener solicitudes' });
  }
};




export const getHistorialTurnos = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const usuarioId = req.user?.id;
    const rol = req.user?.tipo;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = (page - 1) * limit;

    if (!usuarioId) {
      res.status(401).json({ error: 'No autenticado' });
      return;
    }

    let query = '';
    let countQuery = '';
    let queryParams: any[] = [];
    let countParams: any[] = [];

    if (rol === 'usuario') {
      query = `
        SELECT 
          t.id,
          t.fecha_programada,
          t.duracion_minutos,
          t.modalidad,
          t.estado,
          t.created_at,
          t.cancelado_por,
          t.es_reprogramacion,
          t.created_at,
          g.id as guia_id,
          g.nombre as guia_nombre,
          g.email as guia_email
        FROM turnos t
        LEFT JOIN guias g ON t.guia_id = g.id
        WHERE t.usuario_id = $1
        ORDER BY t.fecha_programada DESC
        LIMIT $2 OFFSET $3
      `;
      countQuery = 'SELECT COUNT(*) as total FROM turnos WHERE usuario_id = $1';
      queryParams = [usuarioId, limit, offset];
      countParams = [usuarioId];

    } else if (rol === 'guia') {
      query = `
        SELECT 
          t.id,
          t.fecha_programada,
          t.duracion_minutos,
          t.modalidad,
          t.estado,
          t.cancelado_por,
          t.es_reprogramacion,
          t.created_at,
          u.id as usuario_id,
          u.nombre as usuario_nombre,
          u.email as usuario_email
        FROM turnos t
        JOIN usuarios u ON t.usuario_id = u.id
        WHERE t.guia_id = $1
        ORDER BY t.fecha_programada DESC
        LIMIT $2 OFFSET $3
      `;
      countQuery = 'SELECT COUNT(*) as total FROM turnos WHERE guia_id = $1';
      queryParams = [usuarioId, limit, offset];
      countParams = [usuarioId];

    } else {
      res.status(403).json({ error: 'Rol no autorizado' });
      return;
    }

    const [result, countResult] = await Promise.all([
      pool.query(query, queryParams),
      pool.query(countQuery, countParams)
    ]);

    const totalItems = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(totalItems / limit);

    const pagination = {
      currentPage: page,
      totalPages: totalPages,
      totalItems: totalItems,
      itemsPerPage: limit,
      hasNext: page < totalPages,
      hasPrev: page > 1
    };

    res.json({
      data: result.rows,
      pagination: pagination
    });

  } catch (error) {
    console.error('Error al obtener historial:', error);
    res.status(500).json({ error: 'Error al obtener historial de turnos' });
  }
};



    // ============================================
    // CANCELAR TURNO
    // ============================================


export const cancelarTurno = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const usuarioLogueadoId = req.user?.id;
    const rol = req.user?.tipo;
    let { turnoId } = req.params;
    const { motivo } = req.body;

    console.log('🔍 Cancelando turno:', { turnoId, rol, motivo, usuarioLogueadoId });

    if (!usuarioLogueadoId) {
      res.status(401).json({ error: 'No autenticado' });
      return;
    }

    if (Array.isArray(turnoId)) {
      turnoId = turnoId[0];
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(turnoId)) {
      res.status(400).json({ error: 'ID de turno inválido' });
      return;
    }

    // Obtener información del turno
    const turnoQuery = `
      SELECT 
        t.*,
        u.id as usuario_id,
        g.id as guia_id_actual
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
    const usuarioId = turno.usuario_id;

    // Validar permisos
    if (rol === 'usuario') {
      if (turno.usuario_id !== usuarioLogueadoId) {
        res.status(403).json({ error: 'No puedes cancelar turnos de otros usuarios' });
        return;
      }
    } else if (rol === 'guia') {
      if (turno.guia_id_actual !== usuarioLogueadoId) {
        res.status(403).json({ error: 'No puedes cancelar turnos que no te pertenecen' });
        return;
      }
    } else if (rol === 'admin') {
      console.log('👤 Admin cancelando turno:', turnoId);
    } else {
      res.status(403).json({ error: 'Rol no autorizado para cancelar turnos' });
      return;
    }

    const estadosPermitidos = ['pendiente', 'aceptado'];
    if (!estadosPermitidos.includes(turno.estado)) {
      res.status(400).json({ 
        error: `No se puede cancelar un turno en estado "${turno.estado}". Solo se pueden cancelar turnos pendientes o aceptados.` 
      });
      return;
    }

    // Verificar penalización para usuarios
    let requierePenalizacion = false;
    if (rol === 'usuario') {
      const fechaActual = new Date();
      const fechaTurno = new Date(turno.fecha_programada);
      const diffHoras = (fechaTurno.getTime() - fechaActual.getTime()) / (1000 * 60 * 60);
      
      if (diffHoras < 48) {
        requierePenalizacion = true;
        console.log(`⚠️ Cancelación con menos de 48h de antelación. Diferencia: ${diffHoras.toFixed(2)}h`);
      }
    }

    // ============================================
    // UPDATE - SOLO COLUMNAS EXISTENTES
    // ============================================
    const updateQuery = `
      UPDATE turnos 
      SET estado = 'cancelado',
          motivo_cancelacion = $1,
          cancelado_por = $2
      WHERE id = $3 
      RETURNING id, estado, fecha_programada, cancelado_por
    `;

    const result = await pool.query(updateQuery, [
      motivo || `Cancelado por ${req.user?.tipo}`,  // <-- Usar req.user?.tipo
      req.user?.tipo,                               // <-- Usar req.user?.tipo
      turnoId
    ]);

    console.log('✅ Turno cancelado:', result.rows[0]);

    // Notificar al otro participante
    const otroParticipanteId = rol === 'usuario' ? turno.guia_id_actual : turno.usuario_id;
    if (otroParticipanteId) {
      notificarUsuario(otroParticipanteId, 'estado-turno-actualizado', {
        turnoId: turnoId,
        estado: 'cancelado',
        mensaje: `El turno ha sido cancelado por el ${rol === 'usuario' ? 'usuario' : 'guía'}`
      });
    }

    // También notificar al mismo usuario que canceló
      notificarUsuario(usuarioLogueadoId, 'estado-turno-actualizado', {
        turnoId: turnoId,
        estado: 'cancelado',
        mensaje: `Has cancelado el turno`
      });

    // Notificar específicamente para el badge de cancelaciones
    // Notificar al mismo usuario que canceló
    console.log('📢 Emitiendo evento nuevo-turno-cancelado para:', { 
      usuarioLogueadoId, 
      rol, 
      turnoId 
    });
    notificarUsuario(usuarioLogueadoId, 'nuevo-turno-cancelado', {
      turnoId: turnoId,
      usuarioId: usuarioLogueadoId,
      rol: rol
    });

    // Notificar al admin también
    notificarAAdmins('nuevo-turno-cancelado', {
      turnoId: turnoId,
      canceladoPor: rol,
      usuarioId: usuarioId
    });

    // Registrar en auditoría
    await pool.query(
      `INSERT INTO auditoria_logs (usuario_afectado_id, guia_afectado_id, accion, detalles, created_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [
        usuarioId,
        rol === 'guia' ? usuarioLogueadoId : null,
        'cancelar_turno',
        JSON.stringify({ 
          turno_id: turnoId,
          cancelado_por: rol,
          motivo: motivo,
          requiere_penalizacion: requierePenalizacion
        })
      ]
    );

    res.json({
      message: 'Turno cancelado exitosamente',
      turno: result.rows[0],
      requierePenalizacion: requierePenalizacion
    });

  } catch (error) {
    console.error('Error al cancelar turno:', error);
    res.status(500).json({ error: 'Error interno al cancelar el turno' });
  }
};


    // ============================================
    // REPROGRAMAR TURNO
    // ============================================


export const reprogramarTurno = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const usuarioId = req.user?.id;
    let { turnoId } = req.params;
    const { preferencia, fecha_preferida, comentarios } = req.body;

    if (!usuarioId) {
      res.status(401).json({ error: 'No autenticado' });
      return;
    }

    if (req.user?.tipo !== 'usuario') {
      res.status(403).json({ error: 'Solo los usuarios pueden reprogramar turnos' });
      return;
    }

    if (Array.isArray(turnoId)) {
      turnoId = turnoId[0];
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(turnoId)) {
      res.status(400).json({ error: 'ID de turno inválido' });
      return;
    }

    const preferenciasValidas = ['mismo_guia', 'otro_guia'];
    if (preferencia && !preferenciasValidas.includes(preferencia)) {
      res.status(400).json({ error: 'Preferencia no válida' });
      return;
    }

    const turnoQuery = `
      SELECT 
        t.*,
        u.id as usuario_id_verify
      FROM turnos t
      JOIN usuarios u ON t.usuario_id = u.id
      WHERE t.id = $1
    `;
    
    const turnoResult = await pool.query(turnoQuery, [turnoId]);
    
    if (turnoResult.rows.length === 0) {
      res.status(404).json({ error: 'Turno no encontrado' });
      return;
    }

    const turnoOriginal = turnoResult.rows[0];

    if (turnoOriginal.usuario_id_verify !== usuarioId) {
      res.status(403).json({ error: 'No puedes reprogramar turnos de otros usuarios' });
      return;
    }

    if (turnoOriginal.estado !== 'cancelado') {
      res.status(400).json({ 
        error: 'Solo se pueden reprogramar turnos cancelados',
        estado_actual: turnoOriginal.estado
      });
      return;
    }

    // ============================================
    // SI PREFIERE EL MISMO GUÍA, CREAR TURNO AUTOMÁTICAMENTE
    // ============================================
    if (preferencia === 'mismo_guia') {
      const guiaOriginalId = turnoOriginal.guia_id;

      if (!guiaOriginalId) {
        res.status(400).json({ error: 'No hay guía asignado al turno original' });
        return;
      }

      if (!fecha_preferida) {
        res.status(400).json({ error: 'Debes seleccionar una fecha y hora para reprogramar' });
        return;
      }

      const fechaTurno = new Date(fecha_preferida);

      if (fechaTurno <= new Date()) {
        res.status(400).json({ error: 'La fecha debe ser posterior a la fecha actual' });
        return;
      }

      // Verificar que el guía no tenga otro turno en el mismo horario
      const duracion = turnoOriginal.duracion_minutos || 60;
      const fechaInicio = new Date(fechaTurno);
      const fechaFin = new Date(fechaTurno);
      fechaFin.setMinutes(fechaFin.getMinutes() + duracion);

      console.log('🔍 Verificando disponibilidad para guía:', guiaOriginalId);
      console.log('📅 Fecha inicio:', fechaInicio);
      console.log('📅 Fecha fin:', fechaFin);

      const verificarDisponibilidad = await pool.query(
        `SELECT id, fecha_programada, duracion_minutos 
        FROM turnos 
        WHERE guia_id = $1 
        AND estado IN ('pendiente', 'aceptado', 'iniciado')
        AND (
          (fecha_programada < $2 AND (fecha_programada + (COALESCE(duracion_minutos, 60) * interval '1 minute')) > $3)
          OR
          (fecha_programada >= $3 AND fecha_programada < $2)
        )`,
        [guiaOriginalId, fechaFin, fechaInicio]
      );

      console.log('📊 Turnos conflictivos encontrados:', verificarDisponibilidad.rows.length);

      if (verificarDisponibilidad.rows.length > 0) {
        const conflicto = verificarDisponibilidad.rows[0];
        const fechaConflicto = new Date(conflicto.fecha_programada);
        const finConflicto = new Date(fechaConflicto);
        finConflicto.setMinutes(finConflicto.getMinutes() + (conflicto.duracion_minutos || 60));
        
        res.status(400).json({ 
          error: `El guía no está disponible en ese horario. Ya tiene un turno programado de ${fechaConflicto.toLocaleTimeString()} a ${finConflicto.toLocaleTimeString()}. Por favor, elige otro horario o selecciona "Quiero un guía diferente"`,
          conflicto: {
            fecha: conflicto.fecha_programada,
            inicio: fechaConflicto.toLocaleTimeString(),
            fin: finConflicto.toLocaleTimeString()
          }
        });
        return;
      }


      const insertTurnoQuery = `
        INSERT INTO turnos (
          usuario_id,
          guia_id,
          fecha_programada,
          duracion_minutos,
          modalidad,
          estado,
          es_reprogramacion,
          turno_original_id,
          created_at
        ) VALUES ($1, $2, $3, $4, $5, 'pendiente', true, $6, NOW())
        RETURNING id
      `;

      const turnoResultInsert = await pool.query(insertTurnoQuery, [
        usuarioId,
        guiaOriginalId,
        fechaTurno,
        duracion,
        turnoOriginal.modalidad || 'chat',
        turnoId
      ]);

      const nuevoTurnoId = turnoResultInsert.rows[0].id;

      // Registrar la reprogramación como completada
      await pool.query(
        `INSERT INTO reprogramaciones (
          turno_original_id,
          usuario_id,
          preferencia,
          fecha_preferida,
          comentarios,
          estado,
          nuevo_turno_id,
          created_at
        ) VALUES ($1, $2, $3, $4, $5, 'completada', $6, NOW())`,
        [turnoId, usuarioId, 'mismo_guia', fecha_preferida, comentarios || null, nuevoTurnoId]
      );

      notificarUsuario(guiaOriginalId, 'nuevo-turno-disponible', {
        turnoId: nuevoTurnoId,
        usuarioId: usuarioId,
        mensaje: 'El usuario ha reprogramado un turno contigo'
      });

      notificarUsuario(usuarioId, 'estado-turno-actualizado', {
        turnoId: nuevoTurnoId,
        estado: 'pendiente',
        mensaje: 'Tu turno ha sido reprogramado exitosamente'
      });

      await pool.query(
        `INSERT INTO auditoria_logs (usuario_afectado_id, guia_afectado_id, accion, detalles)
        VALUES ($1, $2, $3, $4)`,
        [
          usuarioId,
          guiaOriginalId,
          'reprogramar_turno_mismo_guia',
          JSON.stringify({ 
            turno_original: turnoId, 
            nuevo_turno: nuevoTurnoId,
            fecha: fechaTurno
          })
        ]
      );

      res.status(201).json({
        message: 'Turno reprogramado exitosamente con el mismo guía',
        nuevo_turno_id: nuevoTurnoId,
        preferencia: 'mismo_guia'
      });
      return;
    }

    // ============================================
    // SI NO ES MISMO GUÍA (otro_guia), CREAR REPROGRAMACIÓN PARA ADMIN
    // ============================================

    const reprogramacionQuery = `
      SELECT id FROM reprogramaciones 
      WHERE turno_original_id = $1 AND estado = 'pendiente'
    `;
    const reprogramacionResult = await pool.query(reprogramacionQuery, [turnoId]);
    
    if (reprogramacionResult.rows.length > 0) {
      res.status(400).json({ 
        error: 'Ya existe una solicitud de reprogramación pendiente para este turno'
      });
      return;
    }

    const insertQuery = `
      INSERT INTO reprogramaciones (
        turno_original_id,
        usuario_id,
        preferencia,
        fecha_preferida,
        comentarios,
        estado
      ) VALUES ($1, $2, $3, $4, $5, 'pendiente')
      RETURNING id, created_at
    `;

    const result = await pool.query(insertQuery, [
      turnoId,
      usuarioId,
      preferencia || null,
      fecha_preferida || null,
      comentarios || null
    ]);

    const reprogramacion = result.rows[0];

    notificarAAdmins('nueva-solicitud-reprogramacion', {
      message: 'Nueva solicitud de reprogramación',
      reprogramacionId: reprogramacion.id,
      turnoId: turnoId,
      timestamp: new Date().toISOString()
    });

    await pool.query(
      `INSERT INTO auditoria_logs (usuario_afectado_id, accion, detalles)
       VALUES ($1, $2, $3)`,
      [
        usuarioId,
        'solicitar_reprogramacion',
        JSON.stringify({ 
          turno_original: turnoId, 
          reprogramacion_id: reprogramacion.id,
          preferencia,
          fecha_preferida
        })
      ]
    );

    res.status(201).json({
      message: 'Solicitud de reprogramación creada exitosamente',
      reprogramacion: {
        id: reprogramacion.id,
        turno_original: turnoId,
        preferencia: preferencia || 'sin preferencia',
        fecha_preferida: fecha_preferida || null,
        estado: 'pendiente'
      }
    });

  } catch (error) {
    console.error('Error al reprogramar turno:', error);
    res.status(500).json({ error: 'Error interno al procesar la reprogramación' });
  }
};




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
        t.estado as turno_original_estado
      FROM reprogramaciones r
      JOIN turnos t ON r.turno_original_id = t.id
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

// ============================================
// MARCAR CANCELACIONES COMO VISTAS
// ============================================

export const marcarCancelacionesComoVistas = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const usuarioId = req.user?.id;
    const rol = req.user?.tipo;

    if (!usuarioId) {
      res.status(401).json({ error: 'No autenticado' });
      return;
    }

    if (rol === 'usuario') {
      // Primero intentar actualizar
      let result = await pool.query(
        `UPDATE ultima_visto_cancelaciones 
         SET ultima_visualizacion = NOW(), updated_at = NOW()
         WHERE usuario_id = $1`,
        [usuarioId]
      );
      
      // Si no se actualizó ningún registro, insertar
      if (result.rowCount === 0) {
        await pool.query(
          `INSERT INTO ultima_visto_cancelaciones (usuario_id, ultima_visualizacion)
           VALUES ($1, NOW())`,
          [usuarioId]
        );
      }
    } else if (rol === 'guia') {
      // Primero intentar actualizar
      let result = await pool.query(
        `UPDATE ultima_visto_cancelaciones 
         SET ultima_visualizacion = NOW(), updated_at = NOW()
         WHERE guia_id = $1`,
        [usuarioId]
      );
      
      // Si no se actualizó ningún registro, insertar
      if (result.rowCount === 0) {
        await pool.query(
          `INSERT INTO ultima_visto_cancelaciones (guia_id, ultima_visualizacion)
           VALUES ($1, NOW())`,
          [usuarioId]
        );
      }
    } else {
      res.status(403).json({ error: 'Rol no autorizado' });
      return;
    }

    res.json({ 
      message: 'Cancelaciones marcadas como vistas',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error al marcar cancelaciones como vistas:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// ============================================
// CONSULTAR SI HAY CANCELACIONES NO VISTAS
// ============================================

export const hayCancelacionesNoVistas = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const usuarioId = req.user?.id;
    const rol = req.user?.tipo;

    if (!usuarioId) {
      res.status(401).json({ error: 'No autenticado' });
      return;
    }

    let cancelacionQuery = '';
    let cancelacionParams: any[] = [];

    if (rol === 'usuario') {
      cancelacionQuery = `
        SELECT MAX(created_at) as ultima_cancelacion
        FROM turnos
        WHERE usuario_id = $1 
          AND estado = 'cancelado' 
          AND cancelado_por = 'usuario'
      `;
      cancelacionParams = [usuarioId];
    } else if (rol === 'guia') {
      cancelacionQuery = `
        SELECT MAX(created_at) as ultima_cancelacion
        FROM turnos
        WHERE guia_id = $1 
          AND estado = 'cancelado' 
          AND cancelado_por = 'guia'
      `;
      cancelacionParams = [usuarioId];
    } else {
      res.status(403).json({ error: 'Rol no autorizado' });
      return;
    }

    const cancelacionResult = await pool.query(cancelacionQuery, cancelacionParams);
    const ultimaCancelacion = cancelacionResult.rows[0]?.ultima_cancelacion;

    if (!ultimaCancelacion) {
      res.json({ hayNoVistas: false });
      return;
    }

    let vistaQuery = '';
    let vistaParams: any[] = [];

    if (rol === 'usuario') {
      vistaQuery = `
        SELECT ultima_visualizacion
        FROM ultima_visto_cancelaciones
        WHERE usuario_id = $1
      `;
      vistaParams = [usuarioId];
    } else {
      vistaQuery = `
        SELECT ultima_visualizacion
        FROM ultima_visto_cancelaciones
        WHERE guia_id = $1
      `;
      vistaParams = [usuarioId];
    }

    const vistaResult = await pool.query(vistaQuery, vistaParams);
    const ultimaVista = vistaResult.rows[0]?.ultima_visualizacion;

    if (!ultimaVista) {
      res.json({ hayNoVistas: true });
      return;
    }

    const hayNoVistas = new Date(ultimaCancelacion) > new Date(ultimaVista);
    
    res.json({ hayNoVistas });

  } catch (error) {
    console.error('Error al verificar cancelaciones no vistas:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};



export const contarCancelacionesNoVistas = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const usuarioId = req.user?.id;
    const rol = req.user?.tipo;

    if (!usuarioId) {
      res.status(401).json({ error: 'No autenticado' });
      return;
    }

    let cancelacionesNoVistas = 0;

    if (rol === 'usuario') {
      const result = await pool.query(`
        SELECT COUNT(*) as count
        FROM turnos t
        LEFT JOIN ultima_visto_cancelaciones uv ON uv.usuario_id = t.usuario_id
        WHERE t.usuario_id = $1 
          AND t.estado = 'cancelado' 
          AND t.cancelado_por = 'usuario'
          AND (uv.ultima_visualizacion IS NULL OR t.created_at >= uv.ultima_visualizacion)
      `, [usuarioId]);
      cancelacionesNoVistas = parseInt(result.rows[0].count);
    } else if (rol === 'guia') {
      const result = await pool.query(`
        SELECT COUNT(*) as count
        FROM turnos t
        LEFT JOIN ultima_visto_cancelaciones uv ON uv.guia_id = t.guia_id
        WHERE t.guia_id = $1 
          AND t.estado = 'cancelado' 
          AND t.cancelado_por = 'guia'
          AND (uv.ultima_visualizacion IS NULL OR t.created_at >= uv.ultima_visualizacion)
      `, [usuarioId]);
      cancelacionesNoVistas = parseInt(result.rows[0].count);
    } else {
      res.status(403).json({ error: 'Rol no autorizado' });
      return;
    }

    res.json({ count: cancelacionesNoVistas });

  } catch (error) {
    console.error('Error al contar cancelaciones no vistas:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

export const obtenerCancelacionesAdmin = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // Verificar que sea admin
    if (req.user?.tipo !== 'admin') {
      res.status(403).json({ error: 'Acceso solo para administradores' });
      return;
    }

    const { fecha_desde, fecha_hasta, cancelado_por, guia_id, usuario_id, page = 1, limit = 20 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let whereConditions: string[] = [];
    let params: any[] = [];
    let paramIndex = 1;

    // Filtro por fecha
    if (fecha_desde) {
      whereConditions.push(`t.created_at >= $${paramIndex}`);
      params.push(fecha_desde);
      paramIndex++;
    }
    if (fecha_hasta) {
      whereConditions.push(`t.created_at <= $${paramIndex}`);
      params.push(fecha_hasta);
      paramIndex++;
    }

    // Filtro por quien canceló
    if (cancelado_por && ['usuario', 'guia', 'admin'].includes(cancelado_por as string)) {
      whereConditions.push(`t.cancelado_por = $${paramIndex}`);
      params.push(cancelado_por);
      paramIndex++;
    }

    // Filtro por guía
    if (guia_id) {
      whereConditions.push(`t.guia_id = $${paramIndex}`);
      params.push(guia_id);
      paramIndex++;
    }

    // Filtro por usuario
    if (usuario_id) {
      whereConditions.push(`t.usuario_id = $${paramIndex}`);
      params.push(usuario_id);
      paramIndex++;
    }

    const whereClause = whereConditions.length > 0 
      ? `WHERE t.estado = 'cancelado' AND ${whereConditions.join(' AND ')}`
      : `WHERE t.estado = 'cancelado'`;

    // Query principal
    const query = `
      SELECT 
        t.id,
        t.created_at as fecha_cancelacion,
        t.fecha_programada,
        t.motivo_cancelacion,
        t.cancelado_por,
        u.id as usuario_id,
        u.nombre as usuario_nombre,
        u.email as usuario_email,
        g.id as guia_id,
        g.nombre as guia_nombre,
        g.email as guia_email
      FROM turnos t
      LEFT JOIN usuarios u ON t.usuario_id = u.id
      LEFT JOIN guias g ON t.guia_id = g.id
      ${whereClause}
      ORDER BY t.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    // Query para contar total
    const countQuery = `
      SELECT COUNT(*) as total
      FROM turnos t
      ${whereClause}
    `;

    const paramsConPaginacion = [...params, Number(limit), offset];
    const [result, countResult] = await Promise.all([
      pool.query(query, paramsConPaginacion),
      pool.query(countQuery, params)
    ]);

    res.json({
      data: result.rows,
      pagination: {
        currentPage: Number(page),
        totalPages: Math.ceil(Number(countResult.rows[0].total) / Number(limit)),
        totalItems: Number(countResult.rows[0].total),
        itemsPerPage: Number(limit)
      }
    });

  } catch (error) {
    console.error('Error al obtener cancelaciones:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};




export const obtenerMetricasCancelaciones = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (req.user?.tipo !== 'admin') {
      res.status(403).json({ error: 'Acceso solo para administradores' });
      return;
    }

    // Total de cancelaciones
    const totalResult = await pool.query(`
      SELECT COUNT(*) as total FROM turnos WHERE estado = 'cancelado'
    `);

    // Cancelaciones por rol
    const porRolResult = await pool.query(`
      SELECT cancelado_por, COUNT(*) as count 
      FROM turnos 
      WHERE estado = 'cancelado' 
      GROUP BY cancelado_por
    `);

    // Top guías con más cancelaciones
    const topGuiasResult = await pool.query(`
      SELECT g.nombre, COUNT(*) as count
      FROM turnos t
      JOIN guias g ON t.guia_id = g.id
      WHERE t.estado = 'cancelado' AND t.cancelado_por = 'guia'
      GROUP BY g.id, g.nombre
      ORDER BY count DESC
      LIMIT 10
    `);

    // Top usuarios con más cancelaciones
    const topUsuariosResult = await pool.query(`
      SELECT u.nombre, COUNT(*) as count
      FROM turnos t
      JOIN usuarios u ON t.usuario_id = u.id
      WHERE t.estado = 'cancelado' AND t.cancelado_por = 'usuario'
      GROUP BY u.id, u.nombre
      ORDER BY count DESC
      LIMIT 10
    `);

    res.json({
      total: parseInt(totalResult.rows[0].total),
      porRol: porRolResult.rows,
      topGuias: topGuiasResult.rows,
      topUsuarios: topUsuariosResult.rows
    });

  } catch (error) {
    console.error('Error al obtener métricas:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

export const getHistorialAdmin = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (req.user?.tipo !== 'admin') {
      res.status(403).json({ error: 'Acceso solo para administradores' });
      return;
    }

    const { 
      fecha_desde, 
      fecha_hasta, 
      estado, 
      usuario_id, 
      guia_id,
      page = 1, 
      limit = 20 
    } = req.query;
    
    const offset = (Number(page) - 1) * Number(limit);
    let whereConditions: string[] = [];
    let params: any[] = [];
    let paramIndex = 1;

    // Filtro por fecha (usando fecha_programada)
    if (fecha_desde) {
      whereConditions.push(`t.fecha_programada >= $${paramIndex}`);
      params.push(fecha_desde);
      paramIndex++;
    }
    if (fecha_hasta) {
      whereConditions.push(`t.fecha_programada <= $${paramIndex}`);
      params.push(fecha_hasta);
      paramIndex++;
    }

    // Filtro por estado
    if (estado) {
      if (estado === 'reprogramado') {
        whereConditions.push(`t.es_reprogramacion = true`);
      } else {
        whereConditions.push(`t.estado = $${paramIndex}`);
        params.push(estado);
        paramIndex++;
      }
    }

    // Filtro por usuario
    if (usuario_id) {
      whereConditions.push(`t.usuario_id = $${paramIndex}`);
      params.push(usuario_id);
      paramIndex++;
    }

    // Filtro por guía
    if (guia_id) {
      whereConditions.push(`t.guia_id = $${paramIndex}`);
      params.push(guia_id);
      paramIndex++;
    }

    const whereClause = whereConditions.length > 0 
      ? `WHERE ${whereConditions.join(' AND ')}`
      : '';

    const query = `
      SELECT 
        t.id,
        t.fecha_programada,
        t.estado,
        t.modalidad,
        t.created_at,
        t.motivo_cancelacion,
        t.cancelado_por,
        t.es_reprogramacion,
        u.id as usuario_id,
        u.nombre as usuario_nombre,
        u.email as usuario_email,
        g.id as guia_id,
        g.nombre as guia_nombre,
        g.email as guia_email
      FROM turnos t
      LEFT JOIN usuarios u ON t.usuario_id = u.id
      LEFT JOIN guias g ON t.guia_id = g.id
      ${whereClause}
      ORDER BY t.fecha_programada DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    const countQuery = `
      SELECT COUNT(*) as total
      FROM turnos t
      ${whereClause}
    `;

    const paramsConPaginacion = [...params, Number(limit), offset];
    const [result, countResult] = await Promise.all([
      pool.query(query, paramsConPaginacion),
      pool.query(countQuery, params)
    ]);

    res.json({
      data: result.rows,
      pagination: {
        currentPage: Number(page),
        totalPages: Math.ceil(Number(countResult.rows[0].total) / Number(limit)),
        totalItems: Number(countResult.rows[0].total),
        itemsPerPage: Number(limit)
      }
    });

  } catch (error) {
    console.error('Error al obtener historial para admin:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};