import { Server as SocketServer } from 'socket.io';
export declare const initSocketService: (socketIO: SocketServer) => void;
export declare const notificarUsuario: (userId: string, evento: string, datos: any) => void;
export declare const notificarAGuias: (evento: string, datos: any) => void;
export declare const notificarAAdmins: (evento: string, datos: any) => void;
export declare const notificarAUsuarios: (userIds: string[], evento: string, datos: any) => void;
export declare const notificarEnTurno: (turnoId: string, evento: string, datos: any, omitirUsuarioId?: string) => void;
export declare const getUsuariosConectados: () => number;
//# sourceMappingURL=socketService.d.ts.map