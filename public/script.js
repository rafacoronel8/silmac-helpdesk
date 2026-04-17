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
        setInterval(() => {
            app.loadTickets();
        }, 5000);
        await this.loadTickets();

        const ticketForm = document.getElementById('ticketForm');
        const searchInput = document.getElementById('searchInput');
        const filterStatus = document.getElementById('filterStatus');
        const filterPriority = document.getElementById('filterPriority');

        if (ticketForm) {
            ticketForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.createTicket();
            });
        }

        if (searchInput) searchInput.addEventListener('input', () => this.renderTickets());
        if (filterStatus) filterStatus.addEventListener('change', () => this.renderTickets());
        if (filterPriority) filterPriority.addEventListener('change', () => this.renderTickets());
    },

    // 🔄 CARREGAR TICKETS
    loadTickets: async function () {
        try {
            const res = await fetch('/tickets');
            const newTickets = await res.json();

            // 📊 contar tickets
            const newCount = newTickets.length;

            // 🔔 tocar som se aumentou
            if (this.lastTicketCount !== 0 && newCount > this.lastTicketCount) {
                notificationSound.play().catch(err => {
                    console.log("Som bloqueado pelo browser:", err);
                });
            }

            // atualizar estado
            this.tickets = newTickets;
            this.lastTicketCount = newCount;

            this.updateDashboard();
            this.renderTickets();

        } catch (error) {
            console.error("Erro ao carregar tickets:", error);
        }
    },

    // 📤 CRIAR TICKET
    createTicket: async function () {
        const nome = document.getElementById('userName')?.value;
        const departamento = document.getElementById('department')?.value;
        const ilha = document.getElementById('ilha')?.value;

        const categoryValue = document.getElementById('category')?.value || "";
        const [motivo, prioridade] = categoryValue.split('|');

        // ✅ VALIDAÇÃO IMPORTANTE
        if (!nome || !motivo || !prioridade) {
            alert("Preenche todos os campos obrigatórios!");
            return;
        }

        const descricao = document.getElementById('description')?.value;

        const ticket = {
            nome,
            departamento,
            ilha,
            motivo,
            descricao,
            prioridade
        };

        try {
            const res = await fetch('/tickets', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(ticket)
            });

            const data = await res.json();

            if (!res.ok) {
                alert(data.error || "Erro ao criar ticket");
                return;
            }

            alert('✅ Ticket criado com sucesso!');
            document.getElementById('ticketForm')?.reset();

            await this.loadTickets();
        } catch (error) {
            console.error("Erro ao criar ticket:", error);
        }
    },

    // 🔁 ALTERAR ESTADO (CORRIGIDO)
    changeStatus: async function (ticketId, newStatus) {
        try {
            await fetch(`/tickets/${ticketId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ estado: newStatus })
            });

            await this.loadTickets();
        } catch (error) {
            console.error("Erro ao alterar estado:", error);
        }
    },

    // 📊 DASHBOARD
    updateDashboard: function () {
        const counts = {
            Alta: 0,
            Media: 0,
            Baixa: 0,
            Resolvidos: 0,
            Andamento: 0,
            Pausa: 0
        };

        this.tickets.forEach(t => {
            if (t.prioridade) {
                counts[t.prioridade] = (counts[t.prioridade] || 0) + 1;
            }

            if (t.estado === 'Resolvido') counts.Resolvidos++;
            else if (t.estado === 'Em Andamento') counts.Andamento++;
            else if (t.estado === 'Em Pausa') counts.Pausa++;
        });

        document.getElementById('highCount').textContent = counts.Alta || 0;
        document.getElementById('mediumCount').textContent = counts.Media || 0;
        document.getElementById('lowCount').textContent = counts.Baixa || 0;

        document.getElementById('tasksDoneCount').textContent = counts.Resolvidos || 0;
    },

    // 🎨 RENDER TICKETS
    renderTickets: function () {
        const grid = document.getElementById('ticketsGrid');
        if (!grid) return;

        const search = (document.getElementById('searchInput')?.value || "").toLowerCase();
        const statusFilter = document.getElementById('filterStatus')?.value || "";
        const priorityFilter = document.getElementById('filterPriority')?.value || "";

        grid.innerHTML = "";

        const filtered = this.tickets.filter(t =>
            (!search || t.nome?.toLowerCase().includes(search) || t.motivo?.toLowerCase().includes(search)) &&
            (!statusFilter || t.estado === statusFilter || (statusFilter === "Aberto" && t.estado === "Pendente")) &&
            (!priorityFilter || t.prioridade === priorityFilter)
        );

        if (filtered.length === 0) {
            grid.innerHTML = `<div class="empty-state"><p>Nenhum ticket encontrado.</p></div>`;
            return;
        }

        filtered.forEach(t => {
            const prioridadeClass = (t.prioridade || '').toLowerCase();

            const div = document.createElement('div');
            div.className = `ticket-card ${prioridadeClass}`;

            div.innerHTML = `
                <div class="ticket-header">
                    <span class="ticket-id">#${escapeHtml(t.id)}</span>

                    <span class="priority-badge ${prioridadeClass}">
                        ${escapeHtml(t.prioridade || 'N/A')}
                    </span>
                </div>

                <div class="ticket-title">
                    ${escapeHtml(t.motivo || 'Sem motivo')}
                </div>

                <div class="ticket-meta">
                    <span>👤 ${escapeHtml(t.nome)}</span>
                    <span>🏢 ${escapeHtml(t.departamento)}</span>
                    <span>📍 ${escapeHtml(t.ilha)}</span>
                </div>

                <div class="status-badge-box">
                    <select onchange="app.changeStatus(${t.id}, this.value)">
                        <option value="Aberto" ${t.estado === 'Aberto' ? 'selected' : ''}>Aberto</option>
                        <option value="Em Andamento" ${t.estado === 'Em Andamento' ? 'selected' : ''}>Em Andamento</option>
                        <option value="Em Pausa" ${t.estado === 'Em Pausa' ? 'selected' : ''}>Em Pausa</option>
                        <option value="Resolvido" ${t.estado === 'Resolvido' ? 'selected' : ''}>Resolvido</option>
                    </select>
                </div>

                <div class="ticket-description">
                    Estado: ${escapeHtml(t.estado)}<br>
                    Criado em: ${t.data_criacao ? new Date(t.data_criacao).toLocaleString() : 'N/A'}
                </div>
            `;

            grid.appendChild(div);
        });
    }
};

// 🔐 LOGIN (mantido)
function openLogin() {
    document.getElementById('loginModal').style.display = 'block';
}

function closeLogin() {
    document.getElementById('loginModal').style.display = 'none';
}

async function login() {
    const username = document.getElementById('loginUser').value;
    const password = document.getElementById('loginPass').value;

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
            alert('❌ Credenciais inválidas');
            closeLogin();
        }
    } catch (err) {
        console.error(err);
    }
}

// UX
window.onclick = function(e) {
    const modal = document.getElementById('loginModal');
    if (e.target === modal) closeLogin();
};

document.addEventListener('keydown', function(e) {
    const modal = document.getElementById('loginModal');
    if (e.key === 'Enter' && modal.style.display !== 'none') login();
});

window.onload = () => app.init();