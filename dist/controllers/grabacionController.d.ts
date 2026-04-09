import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
export declare const iniciarGrabacion: (req: AuthRequest, res: Response) => Promise<void>;
export declare const responderGrabacion: (req: AuthRequest, res: Response) => Promise<void>;
export declare const finalizarGrabacion: (req: AuthRequest, res: Response) => Promise<void>;
//# sourceMappingURL=grabacionController.d.ts.map