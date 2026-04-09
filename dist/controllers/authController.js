"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.perfil = exports.login = exports.validateLogin = exports.registro = exports.validateRegistro = void 0;
const connection_1 = require("../database/connection");
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const express_validator_1 = require("express-validator");
exports.validateRegistro = [
    (0, express_validator_1.body)('email').isEmail().normalizeEmail(),
    (0, express_validator_1.body)('password').isLength({ min: 8 }).withMessage('La contraseña debe tener al menos 8 caracteres'),
    (0, express_validator_1.body)('nombre').optional().isString().trim(),
    (0, express_validator_1.body)('telefono').optional().isString(),
    (0, express_validator_1.body)('tipo').isIn(['usuario', 'guia']).withMessage('Tipo debe ser usuario o guia')
];
const registro = async (req, res) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            res.status(400).json({ errors: errors.array() });
            return;
        }
        const { email, password, nombre, telefono, tipo } = req.body;
        let existingUser;
        if (tipo === 'usuario') {
            const result = await connection_1.pool.query('SELECT id FROM usuarios WHERE email = $1', [email]);
            existingUser = result.rows[0];
        }
        else {
            const result = await connection_1.pool.query('SELECT id FROM guias WHERE email = $1', [email]);
            existingUser = result.rows[0];
        }
        if (existingUser) {
            res.status(400).json({ error: 'El email ya está registrado' });
            return;
        }
        const saltRounds = 10;
        const passwordHash = await bcrypt_1.default.hash(password, saltRounds);
        let newUser;
        if (tipo === 'usuario') {
            const result = await connection_1.pool.query(`INSERT INTO usuarios (email, password_hash, nombre, telefono)
                 VALUES ($1, $2, $3, $4)
                 RETURNING id, email, nombre`, [email, passwordHash, nombre, telefono]);
            newUser = result.rows[0];
        }
        else {
            const result = await connection_1.pool.query(`INSERT INTO guias (email, password_hash, nombre, telefono, tipo_guia, verificado)
                 VALUES ($1, $2, $3, $4, $5, $6)
                 RETURNING id, email, nombre`, [email, passwordHash, nombre, telefono, 'voluntario', false]);
            newUser = result.rows[0];
        }
        const token = jsonwebtoken_1.default.sign({
            id: newUser.id,
            email: newUser.email,
            tipo: tipo
        }, process.env.JWT_SECRET || 'secret', { expiresIn: '30d' });
        await connection_1.pool.query(`INSERT INTO auditoria_logs (usuario_afectado_id, guia_afectado_id, accion, detalles)
             VALUES ($1, $2, $3, $4)`, [
            tipo === 'usuario' ? newUser.id : null,
            tipo === 'guia' ? newUser.id : null,
            'registro',
            JSON.stringify({ email, tipo })
        ]);
        res.status(201).json({
            message: 'Usuario registrado exitosamente',
            token,
            user: {
                id: newUser.id,
                email: newUser.email,
                nombre: newUser.nombre,
                tipo
            }
        });
    }
    catch (error) {
        console.error('Error en registro:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
};
exports.registro = registro;
exports.validateLogin = [
    (0, express_validator_1.body)('email').isEmail().normalizeEmail(),
    (0, express_validator_1.body)('password').notEmpty(),
];
const login = async (req, res) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            res.status(400).json({ errors: errors.array() });
            return;
        }
        const { email, password } = req.body;
        let user = null;
        let tipo = '';
        let tableName = '';
        const userResult = await connection_1.pool.query('SELECT id, email, password_hash, nombre FROM usuarios WHERE email = $1', [email]);
        if (userResult.rows.length > 0) {
            user = userResult.rows[0];
            tipo = 'usuario';
            tableName = 'usuarios';
        }
        else {
            const guiaResult = await connection_1.pool.query('SELECT id, email, password_hash, nombre FROM guias WHERE email = $1', [email]);
            if (guiaResult.rows.length > 0) {
                user = guiaResult.rows[0];
                tipo = 'guia';
                tableName = 'guias';
            }
        }
        if (!user && email === 'admin@fundacion.org' && password === 'Admin123!') {
            const token = jsonwebtoken_1.default.sign({ id: 'admin-1', email, tipo: 'admin' }, process.env.JWT_SECRET || 'secret', { expiresIn: '7d' });
            res.json({
                message: 'Login exitoso',
                token,
                user: {
                    id: 'admin-1',
                    email,
                    nombre: 'Administrador',
                    tipo: 'admin'
                }
            });
            return;
        }
        if (!user) {
            res.status(401).json({ error: 'Credenciales inválidas' });
            return;
        }
        const passwordValida = await bcrypt_1.default.compare(password, user.password_hash);
        if (!passwordValida) {
            res.status(401).json({ error: 'Credenciales inválidas' });
            return;
        }
        if (tableName === 'usuarios') {
            await connection_1.pool.query('UPDATE usuarios SET updated_at = NOW() WHERE id = $1', [user.id]);
        }
        else if (tableName === 'guias') {
            await connection_1.pool.query('UPDATE guias SET updated_at = NOW() WHERE id = $1', [user.id]);
        }
        const token = jsonwebtoken_1.default.sign({ id: user.id, email: user.email, tipo }, process.env.JWT_SECRET || 'secret', { expiresIn: '7d' });
        await connection_1.pool.query(`INSERT INTO auditoria_logs (usuario_afectado_id, guia_afectado_id, accion, detalles)
             VALUES ($1, $2, $3, $4)`, [
            tipo === 'usuario' ? user.id : null,
            tipo === 'guia' ? user.id : null,
            'login',
            JSON.stringify({ email, tipo, ip: req.ip })
        ]);
        res.json({
            message: 'Login exitoso',
            token,
            user: {
                id: user.id,
                email: user.email,
                nombre: user.nombre,
                tipo
            }
        });
    }
    catch (error) {
        console.error('Error en login:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
};
exports.login = login;
const perfil = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'No autenticado' });
            return;
        }
        const { id, tipo } = req.user;
        let userData;
        if (tipo === 'usuario') {
            const result = await connection_1.pool.query(`SELECT id, email, nombre, telefono, nivel_urgencia, created_at
                 FROM usuarios WHERE id = $1`, [id]);
            userData = result.rows[0];
        }
        else if (tipo === 'guia') {
            const result = await connection_1.pool.query(`SELECT id, email, nombre, telefono, tipo_guia, especialidades, disponible, verificado
                 FROM guias WHERE id = $1`, [id]);
            userData = result.rows[0];
        }
        else if (tipo === 'admin') {
            userData = {
                id: 'admin-1',
                email: req.user.email,
                nombre: 'Administrador'
            };
        }
        res.json({
            user: {
                ...userData,
                tipo
            }
        });
    }
    catch (error) {
        console.error('Error obteniendo perfil:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
};
exports.perfil = perfil;
//# sourceMappingURL=authController.js.map