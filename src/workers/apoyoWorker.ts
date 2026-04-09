import apoyoQueue from '../queues/apoyoQueue';
import { pool } from '../database/connection';
import { notificarUsuario, notificarAAdmins } from '../services/socketService';

console.log('🚀 Worker de apoyo iniciado...');

apoyoQueue.process(async (job) => {
  console.log(`📦 Procesando solicitud ID: ${job.id}`);
  console.log('Datos de la solicitud:', job.data);

  const { usuarioId, tipo, mensajeInicial, fechaPreferida } = job.data;

  try {
    // PASO 1: Verificar si el usuario tiene turnos previos
    const turnosPreviosQuery = await pool.query(
      'SELECT COUNT(*) as total FROM turnos WHERE usuario_id = $1',
      [usuarioId]
    );
    
    const totalTurnosPrevios = parseInt(turnosPreviosQuery.rows[0].total);
    const esPrimeraVez = totalTurnosPrevios === 0;

    console.log(`🔍 VERIFICACIÓN: esPrimeraVez = ${esPrimeraVez}, totalTurnosPrevios = ${totalTurnosPrevios}`);
    console.log(`👤 Usuario ${usuarioId} - Total turnos previos: ${totalTurnosPrevios}`);
    console.log(`🎯 Es primera vez: ${esPrimeraVez ? 'SÍ' : 'NO'}`);

    // PASO 2: Determinar guía y estado según sea primera vez o no
    let guiaAsignado = null;
    let estado = 'pendiente';
    
    if (esPrimeraVez) {
      // Primera vez: sin guía, pendiente de admin
      estado = 'pendiente_admin';
      console.log('📋 Primera vez - Pendiente de asignación por admin');
    } else {
      // ============================================
      // VERIFICAR PREFERENCIA DEL USUARIO
      // ============================================
      
      // Consultar preferencia pendiente del usuario
      const preferenciaQuery = await pool.query(
        `SELECT preferencia FROM preferencias_usuario 
         WHERE usuario_id = $1 AND estado = 'pendiente'
         ORDER BY created_at DESC 
         LIMIT 1`,
        [usuarioId]
      );

      const ultimaPreferencia = preferenciaQuery.rows[0]?.preferencia;
      console.log(`📋 Última preferencia de reprogramación: ${ultimaPreferencia || 'ninguna'}`);

      if (ultimaPreferencia === 'otro_guia') {
        // El usuario pidió CAMBIO DE GUÍA -> usar el último guía que tuvo (el nuevo)
        console.log('🔄 Usuario solicitó cambio de guía - usando último guía asignado');
        
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
        // Quiere el MISMO GUÍA o no tiene preferencia -> usar el primer guía que tuvo
        console.log('🔄 Usuario quiere mismo guía - usando primer guía asignado');
        
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

      // Si aún no hay guía asignado, buscar turno activo
      if (!guiaAsignado) {
        console.log('⚠️ No se encontró guía por preferencia, buscando turno activo...');
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

      // Si aún no hay guía asignado, asignar uno aleatorio
      if (!guiaAsignado) {
        console.log('⚠️ No se encontró guía, buscando disponibles...');
        const guiasDisponibles = await pool.query(
          'SELECT id FROM guias WHERE disponible = true ORDER BY random() LIMIT 1'
        );
        
        if (guiasDisponibles.rows.length > 0) {
          guiaAsignado = guiasDisponibles.rows[0].id;
          console.log(`✅ Asignando guía aleatorio: ${guiaAsignado}`);
        } else {
          throw new Error('No hay guías disponibles');
        }
      }
    }

    // Determinar la fecha a usar
    let fechaProgramada = new Date();
    if (fechaPreferida) {
      fechaProgramada = new Date(fechaPreferida);
      console.log('📅 Fecha preferida original:', fechaPreferida);
      console.log('📅 Fecha preferida convertida:', fechaProgramada);
      console.log('📅 Fecha preferida UTC:', fechaProgramada.toISOString());
    } else {
      fechaProgramada = new Date();
      console.log('📅 Usando fecha actual:', fechaProgramada);
    }

   
   // ============================================
   // VALIDACIONES DE DISPONIBILIDAD
   // ============================================

    if (fechaPreferida) {
      const duracion = 60;
      const fechaInicio = new Date(fechaProgramada);
      const fechaFin = new Date(fechaProgramada);
      fechaFin.setMinutes(fechaFin.getMinutes() + duracion);

      console.log('🔍 Validando disponibilidad...');
      console.log('📅 Fecha inicio:', fechaInicio);
      console.log('📅 Fecha fin:', fechaFin);

      // 1. Validar que el USUARIO no tenga otro turno en el mismo horario
      const turnosUsuario = await pool.query(
        `SELECT id, guia_id, estado FROM turnos 
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
        const mensaje = `Ya tienes un turno programado en ese horario (${fechaInicio.toLocaleString()} - ${fechaFin.toLocaleString()}). Por favor, elige otra fecha u hora.`;
        console.log('❌', mensaje);
        throw new Error(mensaje);
      }

      // 2. Validar que el GUÍA no tenga otro turno en el mismo horario (con CUALQUIER usuario)
      if (guiaAsignado) {
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

        if (turnosGuia.rows.length > 0) {
          const conflicto = turnosGuia.rows[0];
          const mensaje = `El guía ya tiene un turno programado en ese horario con ${conflicto.usuario_nombre || 'otro usuario'}. Por favor, elige otra fecha u hora.`;
          console.log('❌', mensaje);
          throw new Error(mensaje);
        }
      }
    }

    // PASO 3: Guardar en tabla turnos
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
    console.log(`✅ Turno guardado en BD con ID: ${turnoId}`);

    // PASO 4: Notificaciones según el caso
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
      
      console.log('📢 Notificaciones enviadas: usuario y admins');
      
    } else {
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
      
      if (guiaAsignado) {
        notificarUsuario(guiaAsignado, 'nuevo-turno-disponible', {
          turnoId: turnoId,
          usuarioId: usuarioId,
          tipo: tipo,
          mensaje: `Tienes una nueva solicitud de ${tipo === 'crisis' ? '🆘 crisis' : tipo === 'apoyo' ? '🌱 apoyo' : '📋 seguimiento'}`
        });
        console.log(`📢 Turno asignado a guía: ${guiaAsignado}`);
      } else {
        console.log('📢 Turno sin guía asignado, pendiente de admin');
      }
    }

    // PASO 5: Si el usuario tenía una preferencia pendiente, marcarla como completada
    if (!esPrimeraVez) {
      await pool.query(
        `UPDATE preferencias_usuario 
         SET estado = 'completada', updated_at = NOW()
         WHERE usuario_id = $1 AND estado = 'pendiente'`,
        [usuarioId]
      );
      console.log('✅ Preferencia de usuario marcada como completada');
    }

    return { 
      asignado: !esPrimeraVez && guiaAsignado !== null,
      requiereAsignacion: esPrimeraVez || guiaAsignado === null,
      guiaId: guiaAsignado,
      turnoId: turnoId,
      fecha: result.rows[0].created_at
    };

  } catch (error) {
    console.error('Error guardando en BD:', error);
    throw error;
  }
});

apoyoQueue.on('completed', (job, result) => {
  console.log(`🎉 Trabajo ${job.id} completado. Resultado:`, result);
});

apoyoQueue.on('failed', (job, err) => {
  console.error(`❌ Trabajo ${job.id} falló:`, err);
});