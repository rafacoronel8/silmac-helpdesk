/**
 * Sistema de criacao de utilizador para colocar como admin do sistema
 * nome do utilizador sera identificado no terminal gerara um hash para a password 1234
 */
const bcrypt = require('bcryptjs');

(async () => {
    const hash = await bcrypt.hash('1234', 10);
    console.log(hash);
})();