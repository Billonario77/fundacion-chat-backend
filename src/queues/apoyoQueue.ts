import Queue from 'bull';

// Configuración de la cola usando Redis que ya tenemos corriendo
const apoyoQueue = new Queue('solicitudes-apoyo', {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379')
  }
});

// Tipos de solicitudes que podemos recibir
export interface SolicitudApoyo {
  usuarioId: string;  // Ahora string para UUID
  tipo: 'crisis' | 'apoyo' | 'seguimiento';
  mensajeInicial?: string;
  fechaPreferida?: string;  // <-- AGREGAR ESTA LÍNEA
  fechaSolicitud: Date;
}

export default apoyoQueue;