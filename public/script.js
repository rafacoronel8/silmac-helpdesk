// 🔐 PROTEÇÃO XSS
function escapeHtml(str) {
    if (!str) return '---';
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

const notificationSound = new Audio('/sounds/not.wav');

const app = {

    tickets: [],
    lastTicketCount: 0,

    init: async function () {

        document.addEventListener('click', () => {
            notificationSound.play().then(() => {
                notificationSound.pause();
                notificationSound.currentTime = 0;
            }).catch(() => {});
        }, { once: true });

        const ticketForm = document.getElementById('ticketForm');
        if (ticketForm) {
            ticketForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.createTicket();
            });
        }
    },

    // 🔄 CARREGAR TICKETS (não usado na página pública)
    loadTickets: async function () {
        try {
            const res = await fetch('/tickets');
            if (!res.ok) return;
            const newTickets = await res.json();

            const newCount = newTickets.length;

            if (this.lastTicketCount !== 0 && newCount > this.lastTicketCount) {
                notificationSound.play().catch(err => {
                    console.log("Som bloqueado pelo browser:", err);
                });
            }

            this.tickets = newTickets;
            this.lastTicketCount = newCount;

        } catch (error) {
            console.error("Erro ao carregar tickets:", error);
        }
    },

    // 📤 CRIAR TICKET
    createTicket: async function () {
        const nome = document.getElementById('userName')?.value.trim();
        const contacto = document.getElementById('contacto')?.value.trim();
        const departamento = document.getElementById('department')?.value;
        const ilha = document.getElementById('ilha')?.value;

        const categoryValue = document.getElementById('category')?.value || "";
        const [motivo, prioridade] = categoryValue.split('|');

        if (!nome || !ilha || !motivo || !prioridade) {
            showToast('Preenche todos os campos obrigatórios!', false);
            return;
        }

        const descricao = document.getElementById('description')?.value.trim();

        try {
            const res = await fetch('/tickets', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nome, contacto, departamento, ilha, motivo, descricao, prioridade })
            });

            const data = await res.json();

            if (!res.ok || !data.success) {
                showToast(data.error || 'Erro ao criar ticket', false);
                return;
            }

            showToast('Ticket criado com sucesso! Apoio a caminho...', true);
            document.getElementById('ticketForm').reset();

        } catch (error) {
            console.error("Erro ao criar ticket:", error);
            showToast('Erro ao criar ticket. Tenta novamente.', false);
        }
    }
};

// 🔐 LOGIN
function openLogin() {
    document.getElementById('loginModal').classList.add('open');
    setTimeout(() => document.getElementById('loginUser').focus(), 100);
}

function closeLogin() {
    document.getElementById('loginModal').classList.remove('open');
    document.getElementById('loginError').textContent = '';
}

async function login() {
    const username = document.getElementById('loginUser').value.trim();
    const password = document.getElementById('loginPass').value;

    if (!username || !password) {
        document.getElementById('loginError').textContent = 'Preenche os dois campos.';
        return;
    }

    try {
        const res = await fetch('/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const data = await res.json();

        if (data.success) {
            window.location.href = '/dashboard';
        } else {
            document.getElementById('loginError').textContent = data.error || '❌ Credenciais inválidas';
        }
    } catch (err) {
        console.error(err);
        document.getElementById('loginError').textContent = 'Erro de ligação. Tenta novamente.';
    }
}

function showToast(msg, ok = true) {
    const t = document.getElementById('toast');
    document.getElementById('toastMsg').textContent = msg;
    t.style.borderColor = ok ? 'var(--success)' : 'var(--danger)';
    t.style.color = ok ? 'var(--success)' : 'var(--danger)';
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 3500);
}

// Modal: fechar ao clicar fora ou pressionar Escape/Enter
window.addEventListener('click', function (e) {
    const modal = document.getElementById('loginModal');
    if (e.target === modal) closeLogin();
});

document.addEventListener('keydown', function (e) {
    const modal = document.getElementById('loginModal');
    if (!modal) return;
    if (e.key === 'Escape') closeLogin();
    if (e.key === 'Enter' && modal.classList.contains('open')) login();
});

window.onload = () => app.init();