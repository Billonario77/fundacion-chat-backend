import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
export declare const getMisReprogramaciones: (req: AuthRequest, res: Response) => Promise<void>;
export declare const getReprogramacionById: (req: AuthRequest, res: Response) => Promise<void>;
export declare const cancelarReprogramacion: (req: AuthRequest, res: Response) => Promise<void>;
export declare const solicitarCambioGuia: (req: AuthRequest, res: Response) => Promise<void>;
//# sourceMappingURL=reprogramacionController.d.ts.map