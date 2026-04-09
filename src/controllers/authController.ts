// backend/src/controllers/authController.ts
import { Request, Response } from 'express';
import { pool } from '../database/connection';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { body, validationResult } from 'express-validator';
import { AuthRequest } from '../middleware/auth';

// Validaciones para registro
export const validateRegistro = [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 8 }).withMessage('La contraseña debe tener al menos 8 caracteres'),
    body('nombre').optional().isString().trim(),
    body('telefono').optional().isString(),
    body('tipo').isIn(['usuario', 'guia']).withMessage('Tipo debe ser usuario o guia')
];

// Registro de usuarios (personas en rehabilitación) y guías
export const registro = async (req: Request, res: Response): Promise<void> => {
    try {
        // Validar errores de express-validator
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            res.status(400).json({ errors: errors.array() });
            return;
        }

        const { email, password, nombre, telefono, tipo } = req.body;

        // Verificar si el email ya existe en la tabla correspondiente
        let existingUser;
        if (tipo === 'usuario') {
            const result = await pool.query('SELECT id FROM usuarios WHERE email = $1', [email]);
            existingUser = result.rows[0];
        } else {
            const result = await pool.query('SELECT id FROM guias WHERE email = $1', [email]);
            existingUser = result.rows[0];
        }

        if (existingUser) {
            res.status(400).json({ error: 'El email ya está registrado' });
            return;
        }

        // Hash de la contraseña
        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(password, saltRounds);

        // Insertar en la base de datos según el tipo
        let newUser;
        if (tipo === 'usuario') {
            const result = await pool.query(
                `INSERT INTO usuarios (email, password_hash, nombre, telefono)
                 VALUES ($1, $2, $3, $4)
                 RETURNING id, email, nombre`,
                [email, passwordHash, nombre, telefono]
            );
            newUser = result.rows[0];
        } else {
            const result = await pool.query(
                `INSERT INTO guias (email, password_hash, nombre, telefono, tipo_guia, verificado)
                 VALUES ($1, $2, $3, $4, $5, $6)
                 RETURNING id, email, nombre`,
                [email, passwordHash, nombre, telefono, 'voluntario', false]
            );
            newUser = result.rows[0];
        }

        // Generar token JWT
        const token = jwt.sign(
            { 
                id: newUser.id, 
                email: newUser.email,
                tipo: tipo
            },
            process.env.JWT_SECRET || 'secret',
            { expiresIn: '30d' }
        );

        // Registrar en auditoría
        await pool.query(
            `INSERT INTO auditoria_logs (usuario_afectado_id, guia_afectado_id, accion, detalles)
             VALUES ($1, $2, $3, $4)`,
            [
                tipo === 'usuario' ? newUser.id : null,
                tipo === 'guia' ? newUser.id : null,
                'registro',
                JSON.stringify({ email, tipo })
            ]
        );

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

    } catch (error) {
        console.error('Error en registro:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
};

// Validaciones para login
export const validateLogin = [
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty(),
];

// Login (sin requerir tipo)
export const login = async (req: Request, res: Response): Promise<void> => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            res.status(400).json({ errors: errors.array() });
            return;
        }

        const { email, password } = req.body;
        let user = null;
        let tipo = '';
        let tableName = '';

        // Buscar primero en usuarios
        const userResult = await pool.query(
            'SELECT id, email, password_hash, nombre FROM usuarios WHERE email = $1',
            [email]
        );
        
        if (userResult.rows.length > 0) {
            user = userResult.rows[0];
            tipo = 'usuario';
            tableName = 'usuarios';
        } else {
            // Si no está en usuarios, buscar en guias
            const guiaResult = await pool.query(
                'SELECT id, email, password_hash, nombre FROM guias WHERE email = $1',
                [email]
            );
            
            if (guiaResult.rows.length > 0) {
                user = guiaResult.rows[0];
                tipo = 'guia';
                tableName = 'guias';
            }
        }

        // Verificar si es admin (hardcodeado por ahora)
        if (!user && email === 'admin@fundacion.org' && password === 'Admin123!') {
            const token = jwt.sign(
                { id: 'admin-1', email, tipo: 'admin' },
                process.env.JWT_SECRET || 'secret',
                { expiresIn: '7d' }
            );
            
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

        // Si no se encontró en ninguna tabla
        if (!user) {
            res.status(401).json({ error: 'Credenciales inválidas' });
            return;
        }

        // Verificar contraseña
        const passwordValida = await bcrypt.compare(password, user.password_hash);
        if (!passwordValida) {
            res.status(401).json({ error: 'Credenciales inválidas' });
            return;
        }

        // Actualizar último acceso
        if (tableName === 'usuarios') {
            await pool.query('UPDATE usuarios SET updated_at = NOW() WHERE id = $1', [user.id]);
        } else if (tableName === 'guias') {
            await pool.query('UPDATE guias SET updated_at = NOW() WHERE id = $1', [user.id]);
        }

        // Generar token
        const token = jwt.sign(
            { id: user.id, email: user.email, tipo },
            process.env.JWT_SECRET || 'secret',
            { expiresIn: '7d' }
        );

        // Registrar en auditoría
        await pool.query(
            `INSERT INTO auditoria_logs (usuario_afectado_id, guia_afectado_id, accion, detalles)
             VALUES ($1, $2, $3, $4)`,
            [
                tipo === 'usuario' ? user.id : null,
                tipo === 'guia' ? user.id : null,
                'login',
                JSON.stringify({ email, tipo, ip: req.ip })
            ]
        );

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

    } catch (error) {
        console.error('Error en login:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
};

// Obtener perfil del usuario autenticado
export const perfil = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'No autenticado' });
            return;
        }

        const { id, tipo } = req.user;

        let userData;
        if (tipo === 'usuario') {
            const result = await pool.query(
                `SELECT id, email, nombre, telefono, nivel_urgencia, created_at
                 FROM usuarios WHERE id = $1`,
                [id]
            );
            userData = result.rows[0];
        } else if (tipo === 'guia') {
            const result = await pool.query(
                `SELECT id, email, nombre, telefono, tipo_guia, especialidades, disponible, verificado
                 FROM guias WHERE id = $1`,
                [id]
            );
            userData = result.rows[0];
        } else if (tipo === 'admin') {
            // Admin (datos simulados)
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

    } catch (error) {
        console.error('Error obteniendo perfil:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
};