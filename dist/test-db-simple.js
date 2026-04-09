"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
console.log('=== TEST DE ENTORNO ===');
console.log('Directorio actual:', process.cwd());
console.log('\nArchivos en el directorio actual:');
const files = fs.readdirSync('.');
files.forEach(file => {
    const stats = fs.statSync(file);
    console.log(`  ${file} (${stats.size} bytes)`);
});
const envPath = path.join(process.cwd(), '.env');
console.log('\nIntentando leer .env desde:', envPath);
try {
    const content = fs.readFileSync(envPath, 'utf8');
    console.log('✅ Archivo .env leído correctamente');
    console.log('Contenido (primeros 50 caracteres):', content.substring(0, 50));
    console.log('Longitud total:', content.length, 'caracteres');
    console.log('\nLíneas del archivo:');
    const lines = content.split(/\r?\n/);
    lines.forEach((line, index) => {
        if (line.trim() && !line.startsWith('#')) {
            console.log(`  Línea ${index + 1}: "${line}"`);
        }
    });
}
catch (error) {
    console.error('❌ Error leyendo .env:', error.message);
}
console.log('\n=== Probando dotenv ===');
const dotenv_1 = __importDefault(require("dotenv"));
const result = dotenv_1.default.config();
console.log('Resultado de dotenv.config():', result.error ? 'Error: ' + result.error.message : 'OK');
console.log('\nVariables después de dotenv.config():');
console.log('DB_HOST:', process.env.DB_HOST || 'NO DEFINIDO');
console.log('DB_USER:', process.env.DB_USER || 'NO DEFINIDO');
console.log('DB_PASSWORD:', process.env.DB_PASSWORD ? 'DEFINIDA (longitud: ' + process.env.DB_PASSWORD.length + ')' : 'NO DEFINIDA');
//# sourceMappingURL=test-db-simple.js.map