import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
export declare const enviarMensaje: (req: AuthRequest, res: Response) => Promise<void>;
export declare const getMensajesPorTurno: (req: AuthRequest, res: Response) => Promise<void>;
export declare const marcarComoLeidos: (req: AuthRequest, res: Response) => Promise<void>;
export declare const getMensajesNoLeidos: (req: AuthRequest, res: Response) => Promise<void>;
//# sourceMappingURL=mensajesController.d.ts.map