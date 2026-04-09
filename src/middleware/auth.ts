// backend/src/middleware/auth.ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthRequest extends Request {
    user?: {
        id: string;
        tipo: 'usuario' | 'guia' | 'admin';
        email: string;
    };
}

export const authenticateToken = (req: AuthRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers['authorization'];
    console.log('Auth header recibido:', authHeader);
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        return res.status(401).json({ error: 'Token no proporcionado' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret') as any;
        req.user = {
            id: decoded.id,
            tipo: decoded.tipo,
            email: decoded.email
        };
        next();
    } catch (error) {
        return res.status(403).json({ error: 'Token inválido' });
    }
};

// Middleware específico para guías (solo ellos pueden acceder)
export const requireGuia = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
        return res.status(401).json({ error: 'No autenticado' });
    }
    
    if (req.user.tipo !== 'guia' && req.user.tipo !== 'admin') {
        return res.status(403).json({ error: 'Acceso solo para guías' });
    }
    
    next();
};

// Middleware específico para administradores
export const requireAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
        return res.status(401).json({ error: 'No autenticado' });
    }
    
    if (req.user.tipo !== 'admin') {
        return res.status(403).json({ error: 'Acceso solo para administradores' });
    }
    
    next();
};