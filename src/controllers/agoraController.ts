import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { RtcTokenBuilder, RtcRole } from 'agora-access-token';

const APP_ID = process.env.AGORA_APP_ID || '';
const APP_CERTIFICATE = process.env.AGORA_APP_CERTIFICATE || '';

export const generarToken = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { channelName, uid } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ error: 'No autenticado' });
      return;
    }

    if (!channelName) {
      res.status(400).json({ error: 'Channel name requerido' });
      return;
    }

    if (!APP_ID || !APP_CERTIFICATE) {
      res.status(500).json({ error: 'Credenciales de Agora no configuradas' });
      return;
    }

    // Generar token (expira en 1 hora)
    const role = RtcRole.PUBLISHER;
    const expirationTimeInSeconds = 3600;
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds;

    const token = RtcTokenBuilder.buildTokenWithUid(
      APP_ID,
      APP_CERTIFICATE,
      channelName,
      uid || 0,
      role,
      privilegeExpiredTs
    );

    res.json({ token });

  } catch (error) {
    console.error('Error generando token de Agora:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};