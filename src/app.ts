// backend/src/app.ts
import express from 'express';
import http from 'http';
import { Server as SocketServer } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import turnosRoutes from './routes/turnosRoutes';
import adminRoutes from './routes/adminRoutes';
import reprogramacionRoutes from './routes/reprogramacionRoutes';
import authRoutes from './routes/authRoutes';
import jwt from 'jsonwebtoken';
import { initSocketService } from './services/socketService';
import estadisticasRoutes from './routes/estadisticasRoutes';
import adminUsuariosRoutes from './routes/adminUsuariosRoutes';
import mensajesRoutes from './routes/mensajesRoutes';
import agoraRoutes from './routes/agoraRoutes';
import emergenciaRoutes from './routes/emergenciaRoutes';
import grabacionRoutes from './routes/grabacionRoutes';

// Configurar zona horaria para toda la aplicación
process.env.TZ = 'America/Bogota';
console.log('🕐 Zona horaria configurada:', process.env.TZ);
console.log('🕐 Hora en backend:', new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' }));
console.log('🕐 Hora actual:', new Date().toString());

dotenv.config();

const app = express();

// Configurar CORS
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

app.set('etag', false);
const server = http.createServer(app);

// ============================================
// ============================================
// ÚNICA DECLARACIÓN DE io
// ============================================
const io = new SocketServer(server, {
  cors: {
    origin: [
      'http://localhost:5173',
      'http://localhost:3000',
      'http://192.168.3.44:3000' // <-- Tu IP
    ],
    methods: ['GET', 'POST']
  },
  transports: ['websocket'], 
  pingTimeout: 60000, 
  pingInterval: 25000 
});


// ============================================
// INICIALIZAR SERVICIO DE SOCKETS (inmediatamente después de crear io)
// ============================================
initSocketService(io);

// Middlewares de seguridad y utilidad
app.use(helmet());
app.use(cors());
app.use(express.json());


// Limitar peticiones (DESPUÉS de express.json)
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 300  // 300 peticiones por minuto
});
app.use('/api', limiter);


// Rutas
app.use('/api/auth', authRoutes);
app.use('/api/turnos', turnosRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/reprogramaciones', reprogramacionRoutes);
app.use('/api/estadisticas', estadisticasRoutes);
app.use('/api/admin/usuarios', adminUsuariosRoutes);
app.use('/api/mensajes', mensajesRoutes);
app.use('/api/agora', agoraRoutes);
app.use('/api/emergencia', emergenciaRoutes);
app.use('/api/grabacion', grabacionRoutes);



// Ruta de prueba
app.get('/', (req, res) => {
  res.send('API de la Fundación - Servidor funcionando');
});

// Mapa para trackear qué usuarios están conectados y sus sockets
interface ConnectedUser {
  socketId: string;
  userId: string;
  tipo: 'usuario' | 'guia' | 'admin';
}

const connectedUsers = new Map<string, ConnectedUser>(); // key: socketId, value: user info
const userSockets = new Map<string, string>(); // key: userId, value: socketId

// ============================================
// Configuración de Sockets con autenticación
// ============================================
io.use((socket, next) => {
  try {
    // Obtener token del handshake
    const token = socket.handshake.auth.token || socket.handshake.headers.token;
    
    if (!token) {
      return next(new Error('Autenticación requerida'));
    }

    // Verificar token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret') as any;
    
    // Guardar información del usuario en el socket
    socket.data.user = {
      id: decoded.id,
      tipo: decoded.tipo,
      email: decoded.email
    };
    
    next();
  } catch (error) {
    next(new Error('Token inválido'));
  }
});

io.on('connection', (socket) => {
  const user = socket.data.user;
  console.log(`🟢 Usuario conectado: ${user.email} (${user.tipo}) - Socket: ${socket.id}`);

  // Guardar en nuestros maps
  connectedUsers.set(socket.id, {
    socketId: socket.id,
    userId: user.id,
    tipo: user.tipo
  });
  userSockets.set(user.id, socket.id);

  // Unir al usuario a su room personal
  socket.join(`user:${user.id}`);
  
  // Unir a rooms según su rol
  socket.join(`rol:${user.tipo}`);

  socket.on('unirse-a-rooms', (data) => {
    console.log(`📌 ${user.email} se unió a rooms:`, data);
  });

  socket.on('disconnect', () => {
    console.log(`🔴 Usuario desconectado: ${user.email} - Socket: ${socket.id}`);
    
    connectedUsers.delete(socket.id);
    userSockets.delete(user.id);
  });

  // Mantener el código existente de mensaje-privado
  socket.on('mensaje-privado', (data) => {
    console.log('Mensaje recibido:', data);
    io.to(data.para).emit('mensaje-privado', {
      de: socket.id,
      contenido: data.contenido,
      timestamp: new Date()
    });
  });
});

// IMPORTAR WORKERS AQUÍ
//import './workers/apoyoWorker';

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});