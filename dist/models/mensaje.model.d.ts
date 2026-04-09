export interface Mensaje {
    id: string;
    turno_id: string;
    emisor_id: string;
    emisor_tipo: 'usuario' | 'guia';
    contenido: string;
    leido: boolean;
    created_at: Date;
}
export interface EnviarMensajeDTO {
    turnoId: string;
    contenido: string;
    emisorId: string;
    emisorTipo: 'usuario' | 'guia';
}
//# sourceMappingURL=mensaje.model.d.ts.map