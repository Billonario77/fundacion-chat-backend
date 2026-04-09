// backend/src/database/setup.ts
import { pool } from './connection';
import fs from 'fs';
import path from 'path';

async function setupDatabase() {
    try {
        console.log('🔄 Iniciando configuración de la base de datos...');
        
        // Leer el archivo SQL
        const sqlPath = path.join(__dirname, 'init.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');
        
        // Ejecutar el script
        await pool.query(sql);
        
        console.log('✅ Base de datos configurada exitosamente');
        console.log('📊 Tablas creadas:');
        console.log('   - roles');
        console.log('   - usuarios');
        console.log('   - guias');
        console.log('   - usuario_roles');
        console.log('   - conversaciones');
        console.log('   - mensajes');
        console.log('   - turnos');
        console.log('   - notas_seguimiento');
        console.log('   - auditoria_logs');
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Error configurando la base de datos:', error);
        process.exit(1);
    }
}

setupDatabase();