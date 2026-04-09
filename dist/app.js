"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
const socket_io_1 = require("socket.io");
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const helmet_1 = __importDefault(require("helmet"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const turnosRoutes_1 = __importDefault(require("./routes/turnosRoutes"));
const adminRoutes_1 = __importDefault(require("./routes/adminRoutes"));
const reprogramacionRoutes_1 = __importDefault(require("./routes/reprogramacionRoutes"));
const authRoutes_1 = __importDefault(require("./routes/authRoutes"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const socketService_1 = require("./services/socketService");
const estadisticasRoutes_1 = __importDefault(require("./routes/estadisticasRoutes"));
const adminUsuariosRoutes_1 = __importDefault(require("./routes/adminUsuariosRoutes"));
const mensajesRoutes_1 = __importDefault(require("./routes/mensajesRoutes"));
const agoraRoutes_1 = __importDefault(require("./routes/agoraRoutes"));
const emergenciaRoutes_1 = __importDefault(require("./routes/emergenciaRoutes"));
const grabacionRoutes_1 = __importDefault(require("./routes/grabacionRoutes"));
process.env.TZ = 'America/Bogota';
console.log('🕐 Zona horaria configurada:', process.env.TZ);
console.log('🕐 Hora en backend:', new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' }));
console.log('🕐 Hora actual:', new Date().toString());
dotenv_1.default.config();
const app = (0, express_1.default)();
app.use((0, cors_1.default)({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true
}));
app.set('etag', false);
const server = http_1.default.createServer(app);
const io = new socket_io_1.Server(server, {
    cors: {
        origin: [
            'http://localhost:5173',
            'http://localhost:3000',
            'http://192.168.3.44:3000'
        ],
        methods: ['GET', 'POST']
    },
    transports: ['websocket'],
    pingTimeout: 60000,
    pingInterval: 25000
});
(0, socketService_1.initSocketService)(io);
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)());
app.use(express_1.default.json());
const limiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 1000,
    max: 300
});
app.use('/api', limiter);
app.use('/api/auth', authRoutes_1.default);
app.use('/api/turnos', turnosRoutes_1.default);
app.use('/api/admin', adminRoutes_1.default);
app.use('/api/reprogramaciones', reprogramacionRoutes_1.default);
app.use('/api/estadisticas', estadisticasRoutes_1.default);
app.use('/api/admin/usuarios', adminUsuariosRoutes_1.default);
app.use('/api/mensajes', mensajesRoutes_1.default);
app.use('/api/agora', agoraRoutes_1.default);
app.use('/api/emergencia', emergenciaRoutes_1.default);
app.use('/api/grabacion', grabacionRoutes_1.default);
app.get('/', (req, res) => {
    res.send('API de la Fundación - Servidor funcionando');
});
const connectedUsers = new Map();
const userSockets = new Map();
io.use((socket, next) => {
    try {
        const token = socket.handshake.auth.token || socket.handshake.headers.token;
        if (!token) {
            return next(new Error('Autenticación requerida'));
        }
        const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET || 'secret');
        socket.data.user = {
            id: decoded.id,
            tipo: decoded.tipo,
            email: decoded.email
        };
        next();
    }
    catch (error) {
        next(new Error('Token inválido'));
    }
});
io.on('connection', (socket) => {
    const user = socket.data.user;
    console.log(`🟢 Usuario conectado: ${user.email} (${user.tipo}) - Socket: ${socket.id}`);
    connectedUsers.set(socket.id, {
        socketId: socket.id,
        userId: user.id,
        tipo: user.tipo
    });
    userSockets.set(user.id, socket.id);
    socket.join(`user:${user.id}`);
    socket.join(`rol:${user.tipo}`);
    socket.on('unirse-a-rooms', (data) => {
        console.log(`📌 ${user.email} se unió a rooms:`, data);
    });
    socket.on('disconnect', () => {
        console.log(`🔴 Usuario desconectado: ${user.email} - Socket: ${socket.id}`);
        connectedUsers.delete(socket.id);
        userSockets.delete(user.id);
    });
    socket.on('mensaje-privado', (data) => {
        console.log('Mensaje recibido:', data);
        io.to(data.para).emit('mensaje-privado', {
            de: socket.id,
            contenido: data.contenido,
            timestamp: new Date()
        });
    });
});
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
//# sourceMappingURL=app.js.map