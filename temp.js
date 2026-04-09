const bcrypt = require('bcrypt');

async function generarHash() {
    const password = 'password123';
    const saltRounds = 10;
    
    const hash = await bcrypt.hash(password, saltRounds);
    console.log('Hash generado:', hash);
}

generarHash();