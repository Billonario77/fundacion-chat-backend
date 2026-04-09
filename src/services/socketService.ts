import { Server as SocketServer, Socket } from 'socket.io';

let io: SocketServer;

// Almacenar usuarios conectados (para debug)
const usuariosConectados = new Map<string, string>(); // socketId -> userId

export const initSocketService = (socketIO: SocketServer) => {
  io = socketIO;
  console.log('📡 Servicio de sockets inicializado');

  // Configurar manejadores de conexión
  io.on('connection', (socket: Socket) => {
    console.log('🟢 Nueva conexión socket:', socket.id);

    // El cliente envía su userId al conectarse
    socket.on('registrar', (data: { userId: string; rol: string }) => {
      const { userId, rol } = data;
      console.log(`🔑 Registrando socket ${socket.id} para usuario ${userId} (${rol})`);
      
      // Guardar en mapa
      usuariosConectados.set(socket.id, userId);
      
      // Unir al usuario a su sala personal
      socket.join(`user:${userId}`);
      
      // Unir a sala por rol
      if (rol) {
        socket.join(`rol:${rol}`);
        console.log(`👥 Usuario ${userId} unido a sala rol:${rol}`);
      }
      
      console.log(`📊 Usuarios conectados: ${usuariosConectados.size}`);
    });

    // Manejar evento "escribiendo"
    socket.on('escribiendo', (data: { turnoId: string; usuarioId: string; nombre: string }) => {
      const { turnoId, usuarioId, nombre } = data;
      console.log(`✍️ Usuario ${nombre} (${usuarioId}) está escribiendo en turno ${turnoId}`);
      
      // Reenviar el evento a todos en la sala del turno EXCEPTO al emisor
      socket.to(`turno:${turnoId}`).emit('usuario-escribiendo', {
        turnoId,
        usuarioId,
        nombre
      });
    });

    // Unirse a sala de turno (para mensajes y escritura)
    socket.on('unirse-turno', (turnoId: string) => {
      console.log(`🔊 Socket ${socket.id} uniéndose a sala turno:${turnoId}`);
      socket.join(`turno:${turnoId}`);
    });

    // Salir de sala de turno
    socket.on('salir-turno', (turnoId: string) => {
      console.log(`🔇 Socket ${socket.id} saliendo de sala turno:${turnoId}`);
      socket.leave(`turno:${turnoId}`);
    });

    // Manejar desconexión
    socket.on('disconnect', () => {
      const userId = usuariosConectados.get(socket.id);
      console.log(`🔴 Socket ${socket.id} desconectado${userId ? ` (usuario: ${userId})` : ''}`);
      usuariosConectados.delete(socket.id);
      console.log(`📊 Usuarios conectados restantes: ${usuariosConectados.size}`);
    });
  });
};



// Notificar a un usuario específico
export const notificarUsuario = (userId: string, evento: string, datos: any) => {
  if (!io) {
    console.error('Socket.io no inicializado');
    return;
  }
  
  console.log(`📨 Enviando notificación a usuario ${userId}: ${evento}`);
  console.log(`🔍 Salas disponibles para user:${userId}:`, io.sockets.adapter.rooms.get(`user:${userId}`));
  io.to(`user:${userId}`).emit(evento, {
    ...datos,
    timestamp: new Date().toISOString()
  });
};

// Notificar a todos los guías
export const notificarAGuias = (evento: string, datos: any) => {
  if (!io) {
    console.error('Socket.io no inicializado');
    return;
  }
  
  console.log(`📢 Notificando a todos los guías: ${evento}`);
  io.to('rol:guia').emit(evento, {
    ...datos,
    timestamp: new Date().toISOString()
  });
};

// Notificar a todos los admins
export const notificarAAdmins = (evento: string, datos: any) => {
  if (!io) {
    console.error('Socket.io no inicializado');
    return;
  }
  
  console.log(`📢 Notificando a admins: ${evento}`);
  io.to('rol:admin').emit(evento, {
    ...datos,
    timestamp: new Date().toISOString()
  });
};

// Notificar a múltiples usuarios
export const notificarAUsuarios = (userIds: string[], evento: string, datos: any) => {
  if (!io) {
    console.error('Socket.io no inicializado');
    return;
  }
  
  userIds.forEach(userId => {
    io.to(`user:${userId}`).emit(evento, {
      ...datos,
      timestamp: new Date().toISOString()
    });
  });
  
  console.log(`📨 Notificaciones enviadas a ${userIds.length} usuarios`);
};

// Notificar a todos en una sala de turno
export const notificarEnTurno = (turnoId: string, evento: string, datos: any, omitirUsuarioId?: string) => {
  if (!io) {
    console.error('Socket.io no inicializado');
    return;
  }
  
  console.log(`📢 Notificando en turno ${turnoId}: ${evento}`);
  
  if (omitirUsuarioId) {
    // Esto requeriría lógica más compleja para omitir a un usuario específico
    // Por ahora, simplemente emitimos a todos
    io.to(`turno:${turnoId}`).emit(evento, {
      ...datos,
      timestamp: new Date().toISOString()
    });
  } else {
    io.to(`turno:${turnoId}`).emit(evento, {
      ...datos,
      timestamp: new Date().toISOString()
    });
  }
};

// Obtener número de usuarios conectados (útil para estadísticas)
export const getUsuariosConectados = () => {
  return usuariosConectados.size;
};