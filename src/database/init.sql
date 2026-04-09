-- backend/src/database/init.sql

-- Extensión para UUIDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Extensión para encriptación
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. TABLA DE ROLES
CREATE TABLE roles (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(50) UNIQUE NOT NULL, -- 'usuario', 'guia', 'administrador'
    descripcion TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. TABLA DE USUARIOS (personas en rehabilitación)
CREATE TABLE usuarios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    nombre VARCHAR(100),
    telefono VARCHAR(20),
    fecha_nacimiento DATE,
    nivel_urgencia INTEGER DEFAULT 0, -- 0=normal, 1=apoyo, 2=crisis
    historia_completa JSONB, -- datos adicionales (flexible)
    activo BOOLEAN DEFAULT true,
    ultimo_acceso TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. TABLA DE GUÍAS ESPIRITUALES (voluntarios/profesionales)
CREATE TABLE guias (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    nombre VARCHAR(100),
    telefono VARCHAR(20),
    tipo_guia VARCHAR(50), -- 'voluntario', 'profesional'
    especialidades TEXT[], -- array de textos
    disponible BOOLEAN DEFAULT false,
    verificado BOOLEAN DEFAULT false,
    two_factor_secret VARCHAR(255), -- para 2FA
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. TABLA DE ASIGNACIÓN DE ROLES (relación muchos a muchos)
CREATE TABLE usuario_roles (
    usuario_id UUID REFERENCES usuarios(id) ON DELETE CASCADE,
    guia_id UUID REFERENCES guias(id) ON DELETE CASCADE,
    rol_id INTEGER REFERENCES roles(id),
    PRIMARY KEY (usuario_id, guia_id, rol_id),
    CHECK (
        (usuario_id IS NOT NULL AND guia_id IS NULL) OR
        (usuario_id IS NULL AND guia_id IS NOT NULL)
    )
);

-- 5. TABLA DE CONVERSACIONES (sesiones de chat o video)
CREATE TABLE conversaciones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    usuario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
    guia_id UUID REFERENCES guias(id) ON DELETE SET NULL,
    tipo VARCHAR(20) NOT NULL, -- 'chat' o 'video'
    estado VARCHAR(20) DEFAULT 'activa', -- 'activa', 'finalizada', 'grabando'
    nivel_urgencia INTEGER DEFAULT 0,
    calificacion INTEGER CHECK (calificacion >= 1 AND calificacion <= 5),
    feedback TEXT,
    grabacion_url TEXT, -- URL encriptada en S3
    grabacion_consentimiento BOOLEAN DEFAULT false,
    fecha_inicio TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_fin TIMESTAMP,
    notas_privadas TEXT -- solo visible para guías
);

-- 6. TABLA DE MENSAJES (chat en tiempo real)
CREATE TABLE mensajes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversacion_id UUID REFERENCES conversaciones(id) ON DELETE CASCADE,
    emisor_id UUID NOT NULL, -- puede ser usuario_id o guia_id
    emisor_tipo VARCHAR(10) NOT NULL, -- 'usuario' o 'guia'
    contenido TEXT NOT NULL,
    tipo_contenido VARCHAR(20) DEFAULT 'texto', -- 'texto', 'imagen', 'archivo'
    archivo_url TEXT,
    leido BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 7. TABLA DE TURNOS (sesiones programadas)
CREATE TABLE turnos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    usuario_id UUID REFERENCES usuarios(id) ON DELETE CASCADE,
    guia_id UUID REFERENCES guias(id) ON DELETE CASCADE,
    fecha_programada TIMESTAMP NOT NULL,
    duracion_minutos INTEGER DEFAULT 60,
    modalidad VARCHAR(20) DEFAULT 'video', -- 'chat' o 'video'
    estado VARCHAR(20) DEFAULT 'pendiente', -- 'pendiente', 'confirmado', 'cancelado', 'completado'
    recordatorio_24h_enviado BOOLEAN DEFAULT false,
    recordatorio_1h_enviado BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 8. TABLA DE NOTAS DE SEGUIMIENTO (privadas del guía)
CREATE TABLE notas_seguimiento (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    usuario_id UUID REFERENCES usuarios(id) ON DELETE CASCADE,
    guia_id UUID REFERENCES guias(id) ON DELETE CASCADE,
    contenido TEXT NOT NULL,
    hitos TEXT[],
    temas_recurrentes TEXT[],
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 9. TABLA DE LOGS DE AUDITORÍA (seguridad)
CREATE TABLE auditoria_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    usuario_afectado_id UUID, -- puede ser usuario o guia
    guia_afectado_id UUID,
    accion VARCHAR(100) NOT NULL, -- 'login', 'logout', 'ver_historial', 'grabar_sesion', etc.
    ip_address INET,
    user_agent TEXT,
    detalles JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ÍNDICES para mejorar rendimiento
CREATE INDEX idx_usuarios_email ON usuarios(email);
CREATE INDEX idx_guias_email ON guias(email);
CREATE INDEX idx_conversaciones_usuario ON conversaciones(usuario_id);
CREATE INDEX idx_conversaciones_guia ON conversaciones(guia_id);
CREATE INDEX idx_mensajes_conversacion ON mensajes(conversacion_id);
CREATE INDEX idx_turnos_fecha ON turnos(fecha_programada);
CREATE INDEX idx_auditoria_fecha ON auditoria_logs(created_at);

-- TRIGGER para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_usuarios_updated_at BEFORE UPDATE ON usuarios
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_guias_updated_at BEFORE UPDATE ON guias
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insertar roles por defecto
INSERT INTO roles (nombre, descripcion) VALUES
    ('usuario', 'Persona en proceso de rehabilitación que busca apoyo'),
    ('guia', 'Voluntario o profesional que brinda acompañamiento espiritual'),
    ('administrador', 'Personal de la fundación que gestiona la plataforma');