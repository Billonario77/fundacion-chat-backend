import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
export declare const validateRegistro: import("express-validator").ValidationChain[];
export declare const registro: (req: Request, res: Response) => Promise<void>;
export declare const validateLogin: import("express-validator").ValidationChain[];
export declare const login: (req: Request, res: Response) => Promise<void>;
export declare const perfil: (req: AuthRequest, res: Response) => Promise<void>;
//# sourceMappingURL=authController.d.ts.map