import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { pool } from '../database/connection';
import { notificarUsuario } from '../services/socketService';
import { notificarAAdmins } from '../services/socketService';

// Obtener solicitudes de reprogramación pendientes
export const getSolicitudesPendientes = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // Verificar que sea admin
    if (req.user?.tipo !== 'admin') {
      res.status(403).json({ error: 'Acceso solo para administradores' });
      return;
    }

    const query = `
      SELECT 
        r.id,
        r.turno_original_id,
        r.usuario_id,
        u.nombre as usuario_nombre,
        u.email as usuario_email,
        r.preferencia,
        r.fecha_preferida,
        r.comentarios,
        r.estado,
        r.created_at,
        r.updated_at
      FROM reprogramaciones r
      JOIN usuarios u ON r.usuario_id = u.id
      WHERE r.estado = 'pendiente'
      ORDER BY r.created_at DESC
    `;

    const result = await pool.query(query);
    
    res.json(result.rows);

  } catch (error) {
    console.error('Error al obtener solicitudes:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};


// Obtener guías disponibles (VERSIÓN SIMPLE - SIN FILTRO DE HORARIO)
export const getGuiasDisponibles = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    console.log('👤 Usuario que solicita guías:', req.user?.email);
    
    if (req.user?.tipo !== 'admin') {
      console.log('⛔ Acceso denegado - no es admin');
      res.status(403).json({ error: 'Acceso solo para administradores' });
      return;
    }

    // VERSIÓN SIMPLE - DEVUELVE TODOS LOS GUÍAS DISPONIBLES
    const query = `
      SELECT 
        id,
        nombre,
        email
      FROM guias
      WHERE disponible = true
      ORDER BY nombre
    `;

    const result = await pool.query(query);
    console.log('📋 Guías disponibles (sin filtro de horario):', result.rows);
    res.json(result.rows);

  } catch (error) {
    console.error('❌ Error al obtener guías:', error);
    res.status(500).json({ 
      error: 'Error interno del servidor'
    });
  }
};



// Crear turno reprogramado
export const crearTurnoReprogramado = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    console.log('🚀 INICIANDO crearTurnoReprogramado');
    console.log('👤 Admin:', req.user?.email);
    
    if (req.user?.tipo !== 'admin') {
      console.log('⛔ Acceso denegado - no es admin');
      res.status(403).json({ error: 'Acceso solo para administradores' });
      return;
    }

    const { solicitudId } = req.params;
    const { guiaId, fechaProgramada } = req.body;

    console.log('📦 Parámetros recibidos:', {
      solicitudId,
      guiaId,
      fechaProgramada,
      body: req.body,
      params: req.params
    });

    // Verificar que los parámetros necesarios existan
    if (!solicitudId || !guiaId) {
      console.log('❌ Faltan parámetros obligatorios');
      res.status(400).json({ error: 'solicitudId y guiaId son requeridos' });
      return;
    }

    // PASO 1: Obtener la solicitud de reprogramación
    console.log('🔍 Buscando solicitud:', solicitudId);
    const solicitudQuery = `
      SELECT r.*, t.*, t.id as turno_original_id
      FROM reprogramaciones r
      JOIN turnos t ON r.turno_original_id = t.id
      WHERE r.id = $1 AND r.estado = 'pendiente'
    `;
    
    const solicitudResult = await pool.query(solicitudQuery, [solicitudId]);
    console.log('📊 Resultado solicitud:', solicitudResult.rows);
    
    if (solicitudResult.rows.length === 0) {
      console.log('❌ Solicitud no encontrada o ya procesada');
      res.status(404).json({ error: 'Solicitud no encontrada o ya procesada' });
      return;
    }

    const solicitud = solicitudResult.rows[0];
    console.log('✅ Solicitud encontrada:', {
      id: solicitud.id,
      usuario_id: solicitud.usuario_id,
      turno_original: solicitud.turno_original_id,
      fecha_preferida: solicitud.fecha_preferida
    });

    // PASO 2: Verificar que el guía existe y está disponible
    console.log('🔍 Verificando guía:', guiaId);
    const guiaQuery = await pool.query(
      'SELECT id, nombre, disponible FROM guias WHERE id = $1',
      [guiaId]
    );
    
    console.log('📊 Resultado guía:', guiaQuery.rows);
    
    if (guiaQuery.rows.length === 0) {
      console.log('❌ Guía no encontrado');
      res.status(404).json({ error: 'Guía no encontrado' });
      return;
    }

    if (!guiaQuery.rows[0].disponible) {
      console.log('❌ Guía no está disponible');
      res.status(400).json({ error: 'El guía no está disponible actualmente' });
      return;
    }

    // PASO 3: Determinar fecha para el nuevo turno
    let fechaTurno: Date;
    if (fechaProgramada) {
      fechaTurno = new Date(fechaProgramada);
      console.log('📅 Usando fechaProgramada del body:', fechaProgramada);
    } else if (solicitud.fecha_preferida) {
      fechaTurno = new Date(solicitud.fecha_preferida);
      console.log('📅 Usando fecha_preferida de solicitud:', solicitud.fecha_preferida);
    } else {
      fechaTurno = new Date();
      fechaTurno.setHours(fechaTurno.getHours() + 1);
      console.log('📅 Usando fecha por defecto (+1h):', fechaTurno);
    }

    // Verificar que el guía no tenga otro turno en el mismo horario
    console.log('🔍 Verificando disponibilidad del guía en el horario:', fechaTurno);
    const duracion = solicitud.duracion_minutos || 60;
    
    const verificarDisponibilidad = await pool.query(
      `SELECT id FROM turnos 
       WHERE guia_id = $1 
       AND estado IN ('pendiente', 'aceptado', 'iniciado')
       AND fecha_programada < $2::timestamp + ($3::int * interval '1 minute')
       AND fecha_programada + (COALESCE(duracion_minutos, 60) * interval '1 minute') > $2::timestamp`,
      [guiaId, fechaTurno, duracion]
    );
    
    console.log('📊 Verificación disponibilidad:', verificarDisponibilidad.rows);
    
    if (verificarDisponibilidad.rows.length > 0) {
      console.log('❌ El guía ya tiene un turno en ese horario');
      res.status(400).json({ error: 'El guía ya tiene un turno programado en ese horario' });
      return;
    }

        // PASO 4: Crear el nuevo turno (marcado como reprogramación)
    console.log('🆕 Creando turno reprogramado...');
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
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
      RETURNING id
    `;

    const turnoValues = [
      solicitud.usuario_id,
      guiaId,
      fechaTurno,
      duracion,
      solicitud.modalidad || 'chat',
      'pendiente',
      true,                          // <-- es_reprogramacion = true
      solicitud.turno_original_id    // <-- turno original
    ];
    
    console.log('📦 Insertando turno con valores:', turnoValues);
    
    const turnoResult = await pool.query(insertTurnoQuery, turnoValues);
    console.log('✅ Turno creado con ID:', turnoResult.rows[0].id);

    const nuevoTurnoId = turnoResult.rows[0].id;

// ============================================
// NUEVO: Guardar preferencia del usuario
// ============================================
      console.log('📝 Verificando preferencia del usuario...');
      if (solicitud.preferencia) {
        // Verificar si ya existe una preferencia pendiente
        const preferenciaQuery = await pool.query(
          `SELECT id FROM preferencias_usuario 
          WHERE usuario_id = $1 AND estado = 'pendiente'`,
          [solicitud.usuario_id]
        );

        if (preferenciaQuery.rows.length > 0) {
          // Actualizar preferencia existente
          await pool.query(
            `UPDATE preferencias_usuario 
            SET preferencia = $1, updated_at = NOW()
            WHERE usuario_id = $2 AND estado = 'pendiente'`,
            [solicitud.preferencia, solicitud.usuario_id]
          );
          console.log(`✅ Preferencia actualizada: ${solicitud.preferencia}`);
        } else {
          // Crear nueva preferencia
          await pool.query(
            `INSERT INTO preferencias_usuario (usuario_id, preferencia, estado)
            VALUES ($1, $2, 'pendiente')`,
            [solicitud.usuario_id, solicitud.preferencia]
          );
          console.log(`✅ Nueva preferencia guardada: ${solicitud.preferencia}`);
        }
      }

      // Notificar al usuario que su reprogramación fue aceptada
      notificarUsuario(solicitud.usuario_id, 'estado-turno-actualizado', {
        turnoId: nuevoTurnoId,
        estado: 'pendiente',
        mensaje: 'Tu solicitud de reprogramación fue aceptada. Ya tienes un nuevo turno asignado.'
      });

      // Notificar al guía que tiene un nuevo turno
      notificarUsuario(guiaId, 'nuevo-turno-disponible', {
        turnoId: nuevoTurnoId,
        usuarioId: solicitud.usuario_id,
        mensaje: 'Se te ha asignado un nuevo turno (reprogramación)'
      });


    // PASO 5: Actualizar la solicitud de reprogramación
    console.log('🔄 Actualizando solicitud de reprogramación...');
    await pool.query(
      `UPDATE reprogramaciones 
       SET estado = 'completada', nuevo_turno_id = $1, updated_at = NOW()
       WHERE id = $2`,
      [nuevoTurnoId, solicitudId]
    );
    console.log('✅ Solicitud actualizada');

    // PASO 6: Registrar en auditoría
    console.log('📝 Registrando en auditoría...');
    await pool.query(
      `INSERT INTO auditoria_logs (usuario_afectado_id, guia_afectado_id, accion, detalles, created_at)
      VALUES ($1, $2, $3, $4, NOW())`,
      [
        solicitud.usuario_id,  // usuario_afectado_id
        guiaId,                 // guia_afectado_id
        'reprogramar_turno',
        JSON.stringify({ 
          solicitud_id: solicitudId,
          turno_original: solicitud.turno_original_id,
          nuevo_turno: nuevoTurnoId,
          admin: req.user?.email
        })
      ]
    );
    console.log('✅ Auditoría registrada');

    console.log('🎉 Proceso completado exitosamente');
    res.json({
      message: 'Turno reprogramado exitosamente',
      nuevo_turno_id: nuevoTurnoId
    });

  } catch (error) {
    console.error('❌ ERROR EN crearTurnoReprogramado:');
    console.error('Mensaje:', error instanceof Error ? error.message : 'Error desconocido');
    console.error('Stack:', error instanceof Error ? error.stack : 'No stack');
    console.error('Error completo:', error);
    
    res.status(500).json({ 
      error: 'Error interno del servidor',
      detalle: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
};



// Asignar guía a solicitud (endpoint separado si es necesario)
export const asignarGuia = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (req.user?.tipo !== 'admin') {
      res.status(403).json({ error: 'Acceso solo para administradores' });
      return;
    }

    const { solicitudId } = req.params;
    const { guiaId } = req.body;

    // Verificar que la solicitud existe y está pendiente
    const solicitudQuery = 'SELECT id FROM reprogramaciones WHERE id = $1 AND estado = $2';
    const solicitudResult = await pool.query(solicitudQuery, [solicitudId, 'pendiente']);
    
    if (solicitudResult.rows.length === 0) {
      res.status(404).json({ error: 'Solicitud no encontrada' });
      return;
    }

    // Aquí podrías guardar la asignación temporal si lo deseas
    // Por ahora, simplemente confirmamos

    res.json({ 
      message: 'Guía asignado correctamente',
      solicitud_id: solicitudId,
      guia_id: guiaId
    });

  } catch (error) {
    console.error('Error al asignar guía:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// Obtener turnos pendientes de asignación (primeros usuarios)
export const getTurnosPendientesAsignacion = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (req.user?.tipo !== 'admin') {
      res.status(403).json({ error: 'Acceso solo para administradores' });
      return;
    }

    const query = `
      SELECT 
        t.id,
        t.usuario_id,
        u.nombre as usuario_nombre,
        u.email as usuario_email,
        t.modalidad as tipo,
        t.created_at,
        '' as mensaje_inicial,
        t.estado
      FROM turnos t
      JOIN usuarios u ON t.usuario_id = u.id
      WHERE t.requiere_asignacion_admin = true 
        AND t.estado = 'pendiente_admin'
        AND t.guia_id IS NULL
      ORDER BY t.created_at DESC
    `;

    const result = await pool.query(query);
    res.json(result.rows);

  } catch (error) {
    console.error('Error al obtener turnos pendientes:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// Asignar guía a un turno pendiente
export const asignarGuiaATurno = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (req.user?.tipo !== 'admin') {
      res.status(403).json({ error: 'Acceso solo para administradores' });
      return;
    }

    const { turnoId } = req.params;
    const { guiaId } = req.body;

    if (!turnoId || !guiaId) {
      res.status(400).json({ error: 'turnoId y guiaId son requeridos' });
      return;
    }

    // Verificar que el turno existe y requiere asignación
    const turnoQuery = await pool.query(
      'SELECT id, usuario_id FROM turnos WHERE id = $1 AND requiere_asignacion_admin = true AND estado = $2',
      [turnoId, 'pendiente_admin']
    );

    if (turnoQuery.rows.length === 0) {
      res.status(404).json({ error: 'Turno no encontrado o ya no requiere asignación' });
      return;
    }

    // Verificar que el guía existe
    const guiaQuery = await pool.query(
      'SELECT id, nombre FROM guias WHERE id = $1',
      [guiaId]
    );

    if (guiaQuery.rows.length === 0) {
      res.status(404).json({ error: 'Guía no encontrado' });
      return;
    }

    // Actualizar el turno
    await pool.query(
      `UPDATE turnos 
       SET guia_id = $1, 
           estado = 'pendiente', 
           requiere_asignacion_admin = false
       WHERE id = $2`,
      [guiaId, turnoId]
    );

    // Notificar al usuario que ya tiene guía asignado
    notificarUsuario(turnoQuery.rows[0].usuario_id, 'estado-turno-actualizado', {
      turnoId: turnoId,
      estado: 'pendiente',
      mensaje: 'Ya tienes un guía asignado. Pronto podrás comenzar tu sesión.'
    });


    // Notificar al guía que tiene un nuevo turno asignado
    console.log('📢 Notificando al guía:', guiaId, 'del turno:', turnoId);
    notificarUsuario(guiaId, 'nuevo-turno-disponible', {
      turnoId: turnoId,
      usuarioId: turnoQuery.rows[0].usuario_id,
      mensaje: 'Se te ha asignado un nuevo turno'
    });

    // Registrar en auditoría
    await pool.query(
      `INSERT INTO auditoria_logs (usuario_afectado_id, guia_afectado_id, accion, detalles, created_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [
        turnoQuery.rows[0].usuario_id,
        guiaId,
        'asignacion_manual_admin',
        JSON.stringify({ 
          turno_id: turnoId,
          admin: req.user?.email
        })
      ]
    );

    res.json({ 
      message: 'Guía asignado correctamente',
      turnoId,
      guiaId
    });

  } catch (error) {
    console.error('Error al asignar guía:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};




// Obtener todos los guías con sus usuarios asignados
// Obtener todos los guías con sus usuarios asignados
export const getGuiasConUsuarios = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (req.user?.tipo !== 'admin') {
      res.status(403).json({ error: 'Acceso solo para administradores' });
      return;
    }

    const query = `
      SELECT 
        g.id as guia_id,
        g.nombre as guia_nombre,
        g.email as guia_email,
        u.id as usuario_id,
        u.nombre as usuario_nombre,
        u.email as usuario_email,
        MAX(t.fecha_programada) as ultimo_turno,
        COUNT(t.id) as total_turnos
      FROM guias g
      LEFT JOIN turnos t ON g.id = t.guia_id
      LEFT JOIN usuarios u ON t.usuario_id = u.id
      WHERE g.disponible = true
      GROUP BY g.id, g.nombre, g.email, u.id, u.nombre, u.email
      ORDER BY g.nombre, u.nombre
    `;

    const result = await pool.query(query);
    
    // Reorganizar los datos por guía
    const guiasMap = new Map();
    
    result.rows.forEach(row => {
      if (!guiasMap.has(row.guia_id)) {
        guiasMap.set(row.guia_id, {
          guiaId: row.guia_id,
          guiaNombre: row.guia_nombre,
          guiaEmail: row.guia_email,
          usuarios: []
        });
      }
      
      if (row.usuario_id) {
        guiasMap.get(row.guia_id).usuarios.push({
          usuarioId: row.usuario_id,
          usuarioNombre: row.usuario_nombre,
          usuarioEmail: row.usuario_email,
          ultimoTurno: row.ultimo_turno,
          totalTurnos: row.total_turnos
        });
      }
    });

    res.json(Array.from(guiasMap.values()));

  } catch (error) {
    console.error('Error al obtener guías con usuarios:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};


// Buscar usuario por nombre o email y obtener su guía
export const buscarUsuarioConGuia = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (req.user?.tipo !== 'admin') {
      res.status(403).json({ error: 'Acceso solo para administradores' });
      return;
    }

    const { termino } = req.query;

    if (!termino) {
      res.status(400).json({ error: 'Término de búsqueda requerido' });
      return;
    }

    const query = `
      SELECT DISTINCT
        u.id as usuario_id,
        u.nombre as usuario_nombre,
        u.email as usuario_email,
        g.id as guia_id,
        g.nombre as guia_nombre,
        g.email as guia_email,
        (
          SELECT fecha_programada 
          FROM turnos 
          WHERE usuario_id = u.id 
          ORDER BY created_at DESC 
          LIMIT 1
        ) as ultimo_turno
      FROM usuarios u
      LEFT JOIN turnos t ON u.id = t.usuario_id
      LEFT JOIN guias g ON t.guia_id = g.id
      WHERE u.nombre ILIKE $1 OR u.email ILIKE $1
      ORDER BY u.nombre
    `;

    const result = await pool.query(query, [`%${termino}%`]);
    res.json(result.rows);

  } catch (error) {
    console.error('Error al buscar usuario:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};


// Obtener lista de todos los guías (para filtros)
export const getTodosGuias = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (req.user?.tipo !== 'admin') {
      res.status(403).json({ error: 'Acceso solo para administradores' });
      return;
    }

    const result = await pool.query(`
      SELECT id, nombre, email 
      FROM guias 
      ORDER BY nombre ASC
    `);

    res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener guías:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// Obtener lista de todos los usuarios (para filtros)
export const getTodosUsuarios = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (req.user?.tipo !== 'admin') {
      res.status(403).json({ error: 'Acceso solo para administradores' });
      return;
    }

    const result = await pool.query(`
      SELECT id, nombre, email 
      FROM usuarios 
      ORDER BY nombre ASC
    `);

    res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener usuarios:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};


export const getTodosUsuariosConGuia = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (req.user?.tipo !== 'admin') {
      res.status(403).json({ error: 'Acceso solo para administradores' });
      return;
    }

    const result = await pool.query(`
      SELECT 
        u.id as usuario_id,
        u.nombre as usuario_nombre,
        u.email as usuario_email,
        g.id as guia_id,
        g.nombre as guia_nombre,
        g.email as guia_email,
        (
          SELECT MAX(fecha_programada) 
          FROM turnos 
          WHERE usuario_id = u.id 
            AND estado = 'completado'
        ) as ultimo_turno
      FROM usuarios u
      LEFT JOIN (
        SELECT DISTINCT ON (usuario_id) usuario_id, guia_id
        FROM turnos
        WHERE estado IN ('completado', 'iniciado', 'aceptado')
        ORDER BY usuario_id, fecha_programada DESC
      ) ultimo ON u.id = ultimo.usuario_id
      LEFT JOIN guias g ON ultimo.guia_id = g.id
      ORDER BY u.nombre ASC
    `);

    res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener usuarios con guía:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

export const contarReprogramacionesPendientes = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (req.user?.tipo !== 'admin') {
      res.status(403).json({ error: 'Acceso solo para administradores' });
      return;
    }

    const result = await pool.query(`
      SELECT COUNT(*) as count
      FROM reprogramaciones
      WHERE estado = 'pendiente'
    `);

    res.json({ count: parseInt(result.rows[0].count) });
  } catch (error) {
    console.error('Error al contar reprogramaciones pendientes:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};