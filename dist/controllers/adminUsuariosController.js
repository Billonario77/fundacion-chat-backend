"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.actualizarRol = exports.toggleGuiaDisponibilidad = exports.toggleUsuarioEstado = exports.getGuias = exports.getUsuarios = void 0;
const connection_1 = require("../database/connection");
const getUsuarios = async (req, res) => {
    try {
        if (req.user?.tipo !== 'admin') {
            res.status(403).json({ error: 'Acceso solo para administradores' });
            return;
        }
        const query = `
      SELECT 
        id, 
        email, 
        nombre,
        created_at
      FROM usuarios
      ORDER BY created_at DESC
    `;
        const result = await connection_1.pool.query(query);
        const usuarios = result.rows.map(u => ({
            ...u,
            tipo: 'usuario',
            activo: true
        }));
        res.json(usuarios);
    }
    catch (error) {
        console.error('Error al obtener usuarios:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
};
exports.getUsuarios = getUsuarios;
const getGuias = async (req, res) => {
    try {
        if (req.user?.tipo !== 'admin') {
            res.status(403).json({ error: 'Acceso solo para administradores' });
            return;
        }
        const query = `
      SELECT 
        id, 
        email, 
        nombre,
        disponible,
        created_at
      FROM guias
      ORDER BY created_at DESC
    `;
        const result = await connection_1.pool.query(query);
        res.json(result.rows);
    }
    catch (error) {
        console.error('Error al obtener guías:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
};
exports.getGuias = getGuias;
const toggleUsuarioEstado = async (req, res) => {
    res.json({ mensaje: "Función no implementada" });
};
exports.toggleUsuarioEstado = toggleUsuarioEstado;
const toggleGuiaDisponibilidad = async (req, res) => {
    res.json({ mensaje: "Función no implementada" });
};
exports.toggleGuiaDisponibilidad = toggleGuiaDisponibilidad;
const actualizarRol = async (req, res) => {
    res.json({ mensaje: "Función no implementada" });
};
exports.actualizarRol = actualizarRol;
//# sourceMappingURL=adminUsuariosController.js.map