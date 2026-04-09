import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
export declare const getUsuarios: (req: AuthRequest, res: Response) => Promise<void>;
export declare const getGuias: (req: AuthRequest, res: Response) => Promise<void>;
export declare const toggleUsuarioEstado: (req: AuthRequest, res: Response) => Promise<void>;
export declare const toggleGuiaDisponibilidad: (req: AuthRequest, res: Response) => Promise<void>;
export declare const actualizarRol: (req: AuthRequest, res: Response) => Promise<void>;
//# sourceMappingURL=adminUsuariosController.d.ts.map