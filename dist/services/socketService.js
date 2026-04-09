"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUsuariosConectados = exports.notificarEnTurno = exports.notificarAUsuarios = exports.notificarAAdmins = exports.notificarAGuias = exports.notificarUsuario = exports.initSocketService = void 0;
let io;
const usuariosConectados = new Map();
const initSocketService = (socketIO) => {
    io = socketIO;
    console.log('📡 Servicio de sockets inicializado');
    io.on('connection', (socket) => {
        console.log('🟢 Nueva conexión socket:', socket.id);
        socket.on('registrar', (data) => {
            const { userId, rol } = data;
            console.log(`🔑 Registrando socket ${socket.id} para usuario ${userId} (${rol})`);
            usuariosConectados.set(socket.id, userId);
            socket.join(`user:${userId}`);
            if (rol) {
                socket.join(`rol:${rol}`);
                console.log(`👥 Usuario ${userId} unido a sala rol:${rol}`);
            }
            console.log(`📊 Usuarios conectados: ${usuariosConectados.size}`);
        });
        socket.on('escribiendo', (data) => {
            const { turnoId, usuarioId, nombre } = data;
            console.log(`✍️ Usuario ${nombre} (${usuarioId}) está escribiendo en turno ${turnoId}`);
            socket.to(`turno:${turnoId}`).emit('usuario-escribiendo', {
                turnoId,
                usuarioId,
                nombre
            });
        });
        socket.on('unirse-turno', (turnoId) => {
            console.log(`🔊 Socket ${socket.id} uniéndose a sala turno:${turnoId}`);
            socket.join(`turno:${turnoId}`);
        });
        socket.on('salir-turno', (turnoId) => {
            console.log(`🔇 Socket ${socket.id} saliendo de sala turno:${turnoId}`);
            socket.leave(`turno:${turnoId}`);
        });
        socket.on('disconnect', () => {
            const userId = usuariosConectados.get(socket.id);
            console.log(`🔴 Socket ${socket.id} desconectado${userId ? ` (usuario: ${userId})` : ''}`);
            usuariosConectados.delete(socket.id);
            console.log(`📊 Usuarios conectados restantes: ${usuariosConectados.size}`);
        });
    });
};
exports.initSocketService = initSocketService;
const notificarUsuario = (userId, evento, datos) => {
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
exports.notificarUsuario = notificarUsuario;
const notificarAGuias = (evento, datos) => {
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
exports.notificarAGuias = notificarAGuias;
const notificarAAdmins = (evento, datos) => {
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
exports.notificarAAdmins = notificarAAdmins;
const notificarAUsuarios = (userIds, evento, datos) => {
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
exports.notificarAUsuarios = notificarAUsuarios;
const notificarEnTurno = (turnoId, evento, datos, omitirUsuarioId) => {
    if (!io) {
        console.error('Socket.io no inicializado');
        return;
    }
    console.log(`📢 Notificando en turno ${turnoId}: ${evento}`);
    if (omitirUsuarioId) {
        io.to(`turno:${turnoId}`).emit(evento, {
            ...datos,
            timestamp: new Date().toISOString()
        });
    }
    else {
        io.to(`turno:${turnoId}`).emit(evento, {
            ...datos,
            timestamp: new Date().toISOString()
        });
    }
};
exports.notificarEnTurno = notificarEnTurno;
const getUsuariosConectados = () => {
    return usuariosConectados.size;
};
exports.getUsuariosConectados = getUsuariosConectados;
//# sourceMappingURL=socketService.js.map