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

// 🔎 NORMALIZAR TEXTO
function normalize(str) {
    return str
        ?.toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
}

// 🎯 HIGHLIGHT (seguro contra regex injection)
function highlight(text, search) {
    if (!search) return escapeHtml(text);

    const safeSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${safeSearch})`, 'gi');

    return escapeHtml(text).replace(regex, '<mark>$1</mark>');
}

const dashboard = {

    tickets: [],
    selectedTicketId: null,
    chart: null,
    viewMode: "grid",

    init: async function () {
        await this.loadTickets();

        // 🔁 AUTO REFRESH
        setInterval(() => this.loadTickets(), 8000);

        const searchInput = document.getElementById('searchInput');
        const filterStatus = document.getElementById('filterStatus');
        const filterPriority = document.getElementById('filterPriority');

        let debounceTimer;

        if (searchInput) {
            searchInput.addEventListener('input', () => {
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => this.render(), 300);
            });
        }

        if (filterStatus) filterStatus.addEventListener('change', () => this.render());
        if (filterPriority) filterPriority.addEventListener('change', () => this.render());
    },

    loadTickets: async function () {
        try {
            const res = await fetch('/tickets');

            // Sessão expirou ou não autenticado
            if (res.status === 401) {
                window.location.href = '/';
                return;
            }

            if (!res.ok) {
                console.error("Erro ao carregar tickets:", res.status);
                return;
            }

            this.tickets = await res.json();

            this.updateStats();
            this.render();
        } catch (error) {
            console.error("Erro ao carregar tickets:", error);
        }
    },

    updateStats: function () {
        let high = 0, medium = 0, low = 0;
        let resolved = 0, andamento = 0, pausa = 0;

        this.tickets.forEach(t => {
            if (t.prioridade === "Alta") high++;
            else if (t.prioridade === "Media") medium++;
            else if (t.prioridade === "Baixa") low++;

            if (t.estado === "Resolvido") resolved++;
            else if (t.estado === "Em Andamento") andamento++;
            else if (t.estado === "Em Pausa") pausa++;
        });

        document.getElementById('highCount').textContent = high;
        document.getElementById('mediumCount').textContent = medium;
        document.getElementById('lowCount').textContent = low;
        document.getElementById('resolvedCount').textContent = resolved;
        document.getElementById('andamentoCount').textContent = andamento;
        document.getElementById('pausaCount').textContent = pausa;

        this.renderChart(high, medium, low);
    },

    // 📊 GRÁFICO
    renderChart: function (high, medium, low) {
        const ctx = document.getElementById('priorityChart');
        if (!ctx) return;

        if (this.chart) this.chart.destroy();

        this.chart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Alta', 'Média', 'Baixa'],
                datasets: [{
                    data: [high, medium, low],
                    backgroundColor: [
                        '#c53030',
                        '#dd6b20',
                        '#2f855a'
                    ],
                    borderWidth: 0
                }]
            },
            options: {
                plugins: {
                    legend: { position: 'bottom' }
                },
                cutout: '65%'
            }
        });
    },

    // 🔄 TOGGLE GRID / LIST
    toggleView: function () {
        const grid = document.getElementById('ticketsGrid');
        const label = document.getElementById('viewLabel');
        const icon = document.querySelector('.view-btn i');

        if (this.viewMode === "grid") {
            grid.classList.add('list-view');
            this.viewMode = "list";

            if (label) label.textContent = 'Lista';
            if (icon) icon.className = 'fas fa-list';

        } else {
            grid.classList.remove('list-view');
            this.viewMode = "grid";

            if (label) label.textContent = 'Grid';
            if (icon) icon.className = 'fas fa-th-large';
        }
    },

    changeStatus: function (id, estado) {
        if (estado === "Resolvido") {
            this.selectedTicketId = id;

            document.getElementById('solutionModal').classList.add('open');

            setTimeout(() => {
                document.getElementById('solutionText')?.focus();
            }, 100);

            return;
        }

        this.updateStatus(id, estado);
    },

    updateStatus: async function (id, estado, solucao = null) {
        try {
            await fetch(`/tickets/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ estado, solucao })
            });

            await this.loadTickets();
        } catch (error) {
            console.error("Erro ao atualizar estado:", error);
        }
    },

    saveSolution: async function () {
        const texto = document.getElementById('solutionText').value.trim();

        if (!texto) {
            const el = document.getElementById('solutionText');
            el.style.borderColor = 'red';
            setTimeout(() => el.style.borderColor = '', 1500);
            return;
        }

        await this.updateStatus(this.selectedTicketId, "Resolvido", texto);
        this.closeSolutionModal();
    },

    closeSolutionModal: function () {
        document.getElementById('solutionModal').classList.remove('open');
        document.getElementById('solutionText').value = '';
        this.selectedTicketId = null;
    },

    render: function () {
        const grid = document.getElementById('ticketsGrid');
        if (!grid) return;

        const search = (document.getElementById('searchInput')?.value || "").trim();
        const status = document.getElementById('filterStatus')?.value || "";
        const priority = document.getElementById('filterPriority')?.value || "";

        const searchNorm = normalize(search);
        const keywords = searchNorm ? searchNorm.split(" ").filter(k => k) : [];

        let filtered = this.tickets.filter(t => {

            const rawText = `
                ${t.nome}
                ${t.motivo}
                ${t.descricao}
                ${t.departamento}
                ${t.ilha}
                ${t.solucao || ''}
            `;

            const text = normalize(rawText);

            const matchSearch = !search || keywords.every(k => text.includes(k));

            const matchStatus =
                !status ||
                t.estado === status ||
                (status === "Aberto" && t.estado === "Pendente");

            const matchPriority =
                !priority ||
                t.prioridade === priority;

            return matchSearch && matchStatus && matchPriority;
        });

        // 🔥 ORDENAR POR PRIORIDADE
        filtered.sort((a, b) => {
            const p = { "Alta": 3, "Media": 2, "Baixa": 1 };
            return (p[b.prioridade] || 0) - (p[a.prioridade] || 0);
        });

        // 🔢 CONTADOR
        const badge = document.getElementById('ticketCountBadge');
        if (badge) badge.textContent = filtered.length;

        grid.innerHTML = "";

        if (filtered.length === 0) {
            grid.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-search"></i>
                    <p>Nenhum ticket encontrado.</p>
                </div>`;
            return;
        }

        filtered.forEach(t => {
            const pc = (t.prioridade || '').toLowerCase();

            const div = document.createElement('div');
            div.className = `ticket-card ${pc}`;

            div.innerHTML = `
                <div class="ticket-header">
                    <span class="ticket-id">#${escapeHtml(t.id)}</span>
                    <span class="priority-badge ${pc}">
                        ${escapeHtml(t.prioridade)}
                    </span>
                </div>

                <div class="ticket-title">
                    ${highlight(t.motivo, search)}
                </div>

                <div class="ticket-meta">
                    <span>👤 ${highlight(t.nome, search)}${t.contacto && t.contacto !== '---' ? ` · 📞 ${highlight(t.contacto, search)}` : ''}</span>
                    <span>🏢 ${highlight(t.departamento, search)}</span>
                    <span>📍 ${highlight(t.ilha, search)}</span>
                </div>

                <div class="status-badge-box">
                    <select onchange="dashboard.changeStatus(${t.id}, this.value)">
                        <option value="Aberto" ${t.estado === 'Aberto' || t.estado === 'Pendente' ? 'selected' : ''}>Aberto</option>
                        <option value="Em Andamento" ${t.estado === 'Em Andamento' ? 'selected' : ''}>Em Andamento</option>
                        <option value="Em Pausa" ${t.estado === 'Em Pausa' ? 'selected' : ''}>Em Pausa</option>
                        <option value="Resolvido" ${t.estado === 'Resolvido' ? 'selected' : ''}>Resolvido</option>
                    </select>
                </div>

                ${t.descricao ? `
                <div class="ticket-description">
                    ${highlight(t.descricao, search)}
                </div>` : ""}

                ${t.solucao ? `
                <div class="ticket-description">
                    <strong>🛠 Solução:</strong><br>
                    ${highlight(t.solucao, search)}
                </div>` : ""}

                <div class="ticket-description">
                    Estado: ${escapeHtml(t.estado)}<br>
                    Criado: ${t.data_criacao ? new Date(t.data_criacao).toLocaleString('pt-PT') : "N/A"}
                </div>
            `;

            grid.appendChild(div);
        });
    }
};


document.getElementById('solutionModal')?.addEventListener('click', function(e) {
    if (e.target === this) dashboard.closeSolutionModal();
});

document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') dashboard.closeSolutionModal();
});

window.onload = () => dashboard.init();