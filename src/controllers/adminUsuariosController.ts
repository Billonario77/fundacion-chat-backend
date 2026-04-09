import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { pool } from '../database/connection';

// Obtener todos los usuarios
export const getUsuarios = async (req: AuthRequest, res: Response): Promise<void> => {
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

    const result = await pool.query(query);
    
    const usuarios = result.rows.map(u => ({
      ...u,
      tipo: 'usuario',
      activo: true
    }));

    res.json(usuarios);

  } catch (error) {
    console.error('Error al obtener usuarios:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// Obtener todos los guías
export const getGuias = async (req: AuthRequest, res: Response): Promise<void> => {
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

    const result = await pool.query(query);
    res.json(result.rows);

  } catch (error) {
    console.error('Error al obtener guías:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// Funciones placeholder para que no fallen las rutas
export const toggleUsuarioEstado = async (req: AuthRequest, res: Response): Promise<void> => {
  res.json({ mensaje: "Función no implementada" });
};

export const toggleGuiaDisponibilidad = async (req: AuthRequest, res: Response): Promise<void> => {
  res.json({ mensaje: "Función no implementada" });
};

export const actualizarRol = async (req: AuthRequest, res: Response): Promise<void> => {
  res.json({ mensaje: "Función no implementada" });
};