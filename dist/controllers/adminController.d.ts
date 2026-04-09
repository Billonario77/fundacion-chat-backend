import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
export declare const getSolicitudesPendientes: (req: AuthRequest, res: Response) => Promise<void>;
export declare const getGuiasDisponibles: (req: AuthRequest, res: Response) => Promise<void>;
export declare const crearTurnoReprogramado: (req: AuthRequest, res: Response) => Promise<void>;
export declare const asignarGuia: (req: AuthRequest, res: Response) => Promise<void>;
export declare const getTurnosPendientesAsignacion: (req: AuthRequest, res: Response) => Promise<void>;
export declare const asignarGuiaATurno: (req: AuthRequest, res: Response) => Promise<void>;
export declare const getGuiasConUsuarios: (req: AuthRequest, res: Response) => Promise<void>;
export declare const buscarUsuarioConGuia: (req: AuthRequest, res: Response) => Promise<void>;
export declare const getTodosGuias: (req: AuthRequest, res: Response) => Promise<void>;
export declare const getTodosUsuarios: (req: AuthRequest, res: Response) => Promise<void>;
export declare const getTodosUsuariosConGuia: (req: AuthRequest, res: Response) => Promise<void>;
export declare const contarReprogramacionesPendientes: (req: AuthRequest, res: Response) => Promise<void>;
//# sourceMappingURL=adminController.d.ts.map