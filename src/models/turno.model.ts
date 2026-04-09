// backend/src/models/turno.model.ts

/**
 * Modelo que representa la tabla 'turnos' en la base de datos
 * Basado en la estructura obtenida de PostgreSQL
 */

// Tipos para los valores fijos de la base de datos
export type TurnoModalidad = 'video' | 'audio' | 'chat';
export type TurnoEstado = 'pendiente' | 'aceptado' | 'iniciado' | 'completado' | 'cancelado';

// Interfaz principal que representa un turno completo
export interface Turno {
  id: string;                          // uuid
  usuario_id: string | null;           // uuid
  guia_id: string | null;              // uuid
  fecha_programada: Date;               // timestamp
  duracion_minutos: number;             // integer, default 60
  modalidad: TurnoModalidad;            // varchar(20), default 'video'
  estado: TurnoEstado;                  // varchar(20), default 'pendiente'
  recordatorio_24h_enviado: boolean;    // boolean, default false
  recordatorio_1h_enviado: boolean;     // boolean, default false
  created_at: Date;                      // timestamp, default CURRENT_TIMESTAMP
}

// Interfaz para crear un nuevo turno (campos requeridos al insertar)
export interface CrearTurnoDTO {
  usuario_id: string;
  guia_id?: string | null;
  fecha_programada: Date;
  duracion_minutos?: number;             // Opcional, default 60
  modalidad?: TurnoModalidad;            // Opcional, default 'video'
  estado?: TurnoEstado;                   // Opcional, default 'pendiente'
  recordatorio_24h_enviado?: boolean;     // Opcional, default false
  recordatorio_1h_enviado?: boolean;      // Opcional, default false
}

// Interfaz para actualizar un turno (todos los campos opcionales)
export interface ActualizarTurnoDTO {
  guia_id?: string | null;
  fecha_programada?: Date;
  duracion_minutos?: number;
  modalidad?: TurnoModalidad;
  estado?: TurnoEstado;
  recordatorio_24h_enviado?: boolean;
  recordatorio_1h_enviado?: boolean;
}

// Interfaz para turnos con información adicional (cuando hacemos JOINs)
export interface TurnoConRelaciones extends Turno {
  usuario_nombre?: string;
  usuario_email?: string;
  guia_nombre?: string;
  guia_email?: string;
}