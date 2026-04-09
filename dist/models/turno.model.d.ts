export type TurnoModalidad = 'video' | 'audio' | 'chat';
export type TurnoEstado = 'pendiente' | 'aceptado' | 'iniciado' | 'completado' | 'cancelado';
export interface Turno {
    id: string;
    usuario_id: string | null;
    guia_id: string | null;
    fecha_programada: Date;
    duracion_minutos: number;
    modalidad: TurnoModalidad;
    estado: TurnoEstado;
    recordatorio_24h_enviado: boolean;
    recordatorio_1h_enviado: boolean;
    created_at: Date;
}
export interface CrearTurnoDTO {
    usuario_id: string;
    guia_id?: string | null;
    fecha_programada: Date;
    duracion_minutos?: number;
    modalidad?: TurnoModalidad;
    estado?: TurnoEstado;
    recordatorio_24h_enviado?: boolean;
    recordatorio_1h_enviado?: boolean;
}
export interface ActualizarTurnoDTO {
    guia_id?: string | null;
    fecha_programada?: Date;
    duracion_minutos?: number;
    modalidad?: TurnoModalidad;
    estado?: TurnoEstado;
    recordatorio_24h_enviado?: boolean;
    recordatorio_1h_enviado?: boolean;
}
export interface TurnoConRelaciones extends Turno {
    usuario_nombre?: string;
    usuario_email?: string;
    guia_nombre?: string;
    guia_email?: string;
}
//# sourceMappingURL=turno.model.d.ts.map