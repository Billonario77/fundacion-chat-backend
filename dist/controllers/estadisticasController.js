"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getEstadisticas = void 0;
const connection_1 = require("../database/connection");
const getEstadisticas = async (req, res) => {
    try {
        if (req.user?.tipo !== 'admin') {
            res.status(403).json({ error: 'Acceso solo para administradores' });
            return;
        }
        console.log('📊 Admin solicitando estadísticas');
        const { fechaInicio, fechaFin } = req.query;
        console.log('📅 Fechas recibidas:', { fechaInicio, fechaFin });
        let fechaInicioStr;
        let fechaFinStr;
        if (fechaInicio && fechaFin && typeof fechaInicio === 'string' && typeof fechaFin === 'string') {
            fechaInicioStr = fechaInicio;
            fechaFinStr = fechaFin;
        }
        else {
            const hoy = new Date();
            const hace30Dias = new Date();
            hace30Dias.setDate(hoy.getDate() - 30);
            fechaFinStr = hoy.toISOString().split('T')[0];
            fechaInicioStr = hace30Dias.toISOString().split('T')[0];
        }
        console.log(`📅 Rango de fechas: ${fechaInicioStr} a ${fechaFinStr}`);
        const usuariosResult = await connection_1.pool.query('SELECT COUNT(*) as total FROM usuarios');
        const totalUsuarios = parseInt(usuariosResult.rows[0]?.total || '0');
        const guiasResult = await connection_1.pool.query('SELECT COUNT(*) as total FROM guias');
        const totalGuias = parseInt(guiasResult.rows[0]?.total || '0');
        const turnosResult = await connection_1.pool.query('SELECT COUNT(*) as total FROM turnos');
        const totalTurnos = parseInt(turnosResult.rows[0]?.total || '0');
        const turnosPorEstadoResult = await connection_1.pool.query(`SELECT estado, COUNT(*) as cantidad
       FROM turnos
       WHERE fecha_programada::date BETWEEN $1 AND $2
       GROUP BY estado`, [fechaInicioStr, fechaFinStr]);
        const turnosReprogramadosResult = await connection_1.pool.query(`SELECT COUNT(*) as cantidad
      FROM turnos
      WHERE es_reprogramacion = true
      AND fecha_programada::date BETWEEN $1 AND $2`, [fechaInicioStr, fechaFinStr]);
        const turnosReprogramadosPorEstadoResult = await connection_1.pool.query(`SELECT estado, COUNT(*) as cantidad
      FROM turnos
      WHERE es_reprogramacion = true
      AND fecha_programada::date BETWEEN $1 AND $2
      GROUP BY estado`, [fechaInicioStr, fechaFinStr]);
        const turnosPorDiaResult = await connection_1.pool.query(`SELECT DATE(fecha_programada) as fecha, COUNT(*) as cantidad
       FROM turnos
       WHERE fecha_programada::date BETWEEN $1 AND $2
       GROUP BY DATE(fecha_programada)
       ORDER BY fecha ASC`, [fechaInicioStr, fechaFinStr]);
        const guiasMasActivosResult = await connection_1.pool.query(`SELECT g.id, g.nombre, g.email, COUNT(t.id) as total_turnos
       FROM guias g
       JOIN turnos t ON g.id = t.guia_id
       WHERE t.fecha_programada::date BETWEEN $1 AND $2
       GROUP BY g.id, g.nombre, g.email
       ORDER BY total_turnos DESC
       LIMIT 5`, [fechaInicioStr, fechaFinStr]);
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
    }
    catch (error) {
        console.error('❌ Error en estadísticas:', error);
        res.status(500).json({
            error: 'Error interno del servidor',
            detalle: error instanceof Error ? error.message : 'Error desconocido'
        });
    }
};
exports.getEstadisticas = getEstadisticas;
//# sourceMappingURL=estadisticasController.js.map