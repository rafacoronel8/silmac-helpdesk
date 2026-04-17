const bcrypt = require('bcryptjs');

(async () => {
    const hash = await bcrypt.hash('1234', 10);
    console.log(hash);
})();