const bcrypt = require('bcryptjs');

async function test() {
    const password = '123456';
    const hash = '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi';

    console.log('Сравнение:', await bcrypt.compare(password, hash));
    console.log('Новый хеш для "123456":', await bcrypt.hash(password, 10));
}

test();