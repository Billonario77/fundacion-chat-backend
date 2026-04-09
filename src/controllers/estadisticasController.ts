import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { pool } from '../database/connection';

export const getEstadisticas = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // Verificar que sea admin
    if (req.user?.tipo !== 'admin') {
      res.status(403).json({ error: 'Acceso solo para administradores' });
      return;
    }

    console.log('📊 Admin solicitando estadísticas');

    // 1. Obtener fechas de la query string
    const { fechaInicio, fechaFin } = req.query;
    console.log('📅 Fechas recibidas:', { fechaInicio, fechaFin });

    let fechaInicioStr: string;
    let fechaFinStr: string;

    if (fechaInicio && fechaFin && typeof fechaInicio === 'string' && typeof fechaFin === 'string') {
      fechaInicioStr = fechaInicio;
      fechaFinStr = fechaFin;
    } else {
      const hoy = new Date();
      const hace30Dias = new Date();
      hace30Dias.setDate(hoy.getDate() - 30);

      fechaFinStr = hoy.toISOString().split('T')[0];
      fechaInicioStr = hace30Dias.toISOString().split('T')[0];
    }

    console.log(`📅 Rango de fechas: ${fechaInicioStr} a ${fechaFinStr}`);

    // 2. Ejecutar consultas (adaptadas a tu estructura real)
    
    // Total de usuarios (de la tabla usuarios)
    const usuariosResult = await pool.query('SELECT COUNT(*) as total FROM usuarios');
    const totalUsuarios = parseInt(usuariosResult.rows[0]?.total || '0');

    // Total de guías (de la tabla guias)
    const guiasResult = await pool.query('SELECT COUNT(*) as total FROM guias');
    const totalGuias = parseInt(guiasResult.rows[0]?.total || '0');

    // Total de turnos
    const turnosResult = await pool.query('SELECT COUNT(*) as total FROM turnos');
    const totalTurnos = parseInt(turnosResult.rows[0]?.total || '0');

    // Turnos por estado (usando fecha_programada)
    const turnosPorEstadoResult = await pool.query(
      `SELECT estado, COUNT(*) as cantidad
       FROM turnos
       WHERE fecha_programada::date BETWEEN $1 AND $2
       GROUP BY estado`,
      [fechaInicioStr, fechaFinStr]
    );

    // Turnos reprogramados (es_reprogramacion = true)
    const turnosReprogramadosResult = await pool.query(
      `SELECT COUNT(*) as cantidad
      FROM turnos
      WHERE es_reprogramacion = true
      AND fecha_programada::date BETWEEN $1 AND $2`,
      [fechaInicioStr, fechaFinStr]
    );

    // Turnos reprogramados por estado
    const turnosReprogramadosPorEstadoResult = await pool.query(
      `SELECT estado, COUNT(*) as cantidad
      FROM turnos
      WHERE es_reprogramacion = true
      AND fecha_programada::date BETWEEN $1 AND $2
      GROUP BY estado`,
      [fechaInicioStr, fechaFinStr]
    );

    // Turnos por día (usando fecha_programada)
    const turnosPorDiaResult = await pool.query(
      `SELECT DATE(fecha_programada) as fecha, COUNT(*) as cantidad
       FROM turnos
       WHERE fecha_programada::date BETWEEN $1 AND $2
       GROUP BY DATE(fecha_programada)
       ORDER BY fecha ASC`,
      [fechaInicioStr, fechaFinStr]
    );

    // Guías más activos (JOIN entre turnos y guias)
    const guiasMasActivosResult = await pool.query(
      `SELECT g.id, g.nombre, g.email, COUNT(t.id) as total_turnos
       FROM guias g
       JOIN turnos t ON g.id = t.guia_id
       WHERE t.fecha_programada::date BETWEEN $1 AND $2
       GROUP BY g.id, g.nombre, g.email
       ORDER BY total_turnos DESC
       LIMIT 5`,
      [fechaInicioStr, fechaFinStr]
    );

    // 3. Enviar respuesta
    const respuesta = {
      fechas: {
        inicio: fechaInicioStr,
        fin: fechaFinStr,
      },
      totales: {
        usuarios: totalUsuarios,
        guias: totalGuias,
        turnos: totalTurnos,
      },
      turnosPorEstado: turnosPorEstadoResult.rows.map(row => ({
        estado: row.estado,
        cantidad: parseInt(row.cantidad)
      })),
      turnosPorDia: turnosPorDiaResult.rows.map(row => ({
        fecha: row.fecha,
        cantidad: parseInt(row.cantidad)
      })),
      guiasMasActivos: guiasMasActivosResult.rows.map(row => ({
        id: row.id,
        nombre: row.nombre,
        email: row.email,
        totalTurnos: parseInt(row.total_turnos)
      })),
      // NUEVAS MÉTRICAS
      turnosReprogramados: {
        total: parseInt(turnosReprogramadosResult.rows[0]?.cantidad || '0'),
        porEstado: turnosReprogramadosPorEstadoResult.rows.map(row => ({
          estado: row.estado,
          cantidad: parseInt(row.cantidad)
        }))
      }
    };

    console.log('✅ Estadísticas enviadas:', respuesta);
    res.json(respuesta);

  } catch (error) {
    console.error('❌ Error en estadísticas:', error);
    res.status(500).json({ 
      error: 'Error interno del servidor',
      detalle: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
};