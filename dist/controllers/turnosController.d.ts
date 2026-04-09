import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
export declare const solicitarApoyo: (req: Request, res: Response) => Promise<void>;
export declare const misTurnos: (req: AuthRequest, res: Response) => Promise<void>;
export declare const actualizarEstadoTurno: (req: AuthRequest, res: Response) => Promise<void>;
export declare const obtenerTurnoPorId: (req: AuthRequest, res: Response) => Promise<void>;
export declare const misSolicitudes: (req: AuthRequest, res: Response) => Promise<void>;
export declare const getHistorialTurnos: (req: AuthRequest, res: Response) => Promise<void>;
export declare const cancelarTurno: (req: AuthRequest, res: Response) => Promise<void>;
export declare const reprogramarTurno: (req: AuthRequest, res: Response) => Promise<void>;
export declare const getMisReprogramaciones: (req: AuthRequest, res: Response) => Promise<void>;
export declare const marcarCancelacionesComoVistas: (req: AuthRequest, res: Response) => Promise<void>;
export declare const hayCancelacionesNoVistas: (req: AuthRequest, res: Response) => Promise<void>;
export declare const contarCancelacionesNoVistas: (req: AuthRequest, res: Response) => Promise<void>;
export declare const obtenerCancelacionesAdmin: (req: AuthRequest, res: Response) => Promise<void>;
export declare const obtenerMetricasCancelaciones: (req: AuthRequest, res: Response) => Promise<void>;
export declare const getHistorialAdmin: (req: AuthRequest, res: Response) => Promise<void>;
//# sourceMappingURL=turnosController.d.ts.map