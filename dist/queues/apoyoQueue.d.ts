import Queue from 'bull';
declare const apoyoQueue: Queue.Queue<any>;
export interface SolicitudApoyo {
    usuarioId: string;
    tipo: 'crisis' | 'apoyo' | 'seguimiento';
    mensajeInicial?: string;
    fechaPreferida?: string;
    fechaSolicitud: Date;
}
export default apoyoQueue;
//# sourceMappingURL=apoyoQueue.d.ts.map