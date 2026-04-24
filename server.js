require('dotenv').config();

const express = require('express');
const mysql = require('mysql2');
const path = require('path');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const rateLimit = require('express-rate-limit');

const app = express();

// =======================
// MIDDLEWARES
// =======================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.use((req, res, next) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    next();
});



// =======================
// SESSÃO
// =======================
app.use(session({
    secret: process.env.SESSION_SECRET || "secret123",
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        secure: false,
        maxAge: 8 * 60 * 60 * 1000
    }
}));

// =======================
// RATE LIMIT LOGIN
// =======================
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { success: false, error: "Demasiadas tentativas. Tenta em 15 minutos." }
});

// =======================
// MYSQL
// =======================
const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME
});

db.connect(err => {
    if (err) {
        console.error("Erro MySQL:", err);
    } else {
        console.log("Ligado ao MySQL");
    }
});

// =======================
// AUTH
// =======================
function requireAuth(req, res, next) {
    if (req.session && req.session.loggedIn) {
        return next();
    }
    // Se for pedido de API (Accept: json ou path começa com /tickets)
    if (req.xhr || req.headers.accept?.includes('application/json') || req.path.startsWith('/tickets')) {
        return res.status(401).json({ error: 'Não autenticado', redirect: '/' });
    }
    return res.redirect('/');
}

// =======================
// LOGIN (bcrypt)
// =======================
app.post('/login', loginLimiter, (req, res) => {
    const { username, password } = req.body;

    db.query(
        "SELECT * FROM users WHERE username = ?",
        [username],
        (err, result) => {

            if (err || result.length === 0) {
                return res.json({ success: false });
            }

            bcrypt.compare(password, result[0].password, (err, match) => {
                if (match) {
                    req.session.loggedIn = true;
                    req.session.username = username;
                    return res.json({ success: true });
                }

                return res.json({ success: false });
            });
        }
    );
});

// =======================
// LOGOUT
// =======================
app.post('/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/');
    });
});

// =======================
// DASHBOARD (PROTEGIDO)
// =======================
app.get('/dashboard', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'tickets.html'));
});

// =======================
// CRIAR TICKET (PÚBLICO)
// =======================
app.post('/tickets', (req, res) => {

    const { nome, contacto, departamento, ilha, motivo, descricao, prioridade } = req.body;

    const sql = `
        INSERT INTO tickets
        (nome, contacto, departamento, ilha, motivo, descricao, prioridade, estado, data_criacao)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'Aberto', NOW())
    `;

    db.query(sql, [nome, contacto || null, departamento, ilha, motivo, descricao, prioridade], (err, result) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: "Erro ao criar ticket" });
        }

        res.json({
            success: true,
            id: result.insertId
        });
    });
});

// =======================
// LISTAR TICKETS (PROTEGIDO)
// =======================
app.get('/tickets', requireAuth, (req, res) => {

    res.set('Cache-Control', 'no-store');

    db.query(
        "SELECT * FROM tickets ORDER BY id DESC",
        (err, result) => {

            if (err) {
                return res.status(500).json({ error: "Erro ao buscar tickets" });
            }

            res.json(result);
        }
    );
});

// =======================
// ATUALIZAR TICKET (ESTADO + SOLUÇÃO)
// =======================
app.put('/tickets/:id', requireAuth, (req, res) => {

    const id = req.params.id;
    const { estado, solucao } = req.body;

    let sql;
    let params;

    if (estado === "Resolvido") {
        sql = "UPDATE tickets SET estado=?, solucao=? WHERE id=?";
        params = [estado, solucao, id];
    } else {
        sql = "UPDATE tickets SET estado=? WHERE id=?";
        params = [estado, id];
    }

    db.query(sql, params, (err) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: "Erro ao atualizar ticket" });
        }

        res.json({ success: true });
    });
});

// =======================
// APAGAR TICKET
// =======================
app.delete('/tickets/:id', requireAuth, (req, res) => {

    db.query(
        "DELETE FROM tickets WHERE id = ?",
        [req.params.id],
        (err) => {

            if (err) {
                return res.status(500).json({ error: "Erro ao apagar ticket" });
            }

            res.json({ success: true });
        }
    );
});

// =======================
// SERVER
// =======================
const PORT = process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor a correr em http://localhost:${PORT}`);
});