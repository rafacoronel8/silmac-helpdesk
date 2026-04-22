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

// 🔎 NORMALIZAR TEXTO (remove acentos)
function normalize(str) {
    return str
        ?.toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
}

// 🎯 HIGHLIGHT
function highlight(text, search) {
    if (!search) return escapeHtml(text);

    const regex = new RegExp(`(${search})`, 'gi');
    return escapeHtml(text).replace(regex, '<mark>$1</mark>');
}

const dashboard = {

    tickets: [],
    selectedTicketId: null,

    init: async function () {
        await this.loadTickets();

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
    },

    changeStatus: function (id, estado) {
        if (estado === "Resolvido") {
            this.selectedTicketId = id;
            document.getElementById('solutionModal').style.display = 'flex';
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
        const texto = document.getElementById('solutionText').value;

        if (!texto) {
            alert("Escreve a solução!");
            return;
        }

        await this.updateStatus(this.selectedTicketId, "Resolvido", texto);
        this.closeSolutionModal();
    },

    closeSolutionModal: function () {
        document.getElementById('solutionModal').style.display = 'none';
        document.getElementById('solutionText').value = '';
        this.selectedTicketId = null;
    },

    render: function () {
        const grid = document.getElementById('ticketsGrid');
        if (!grid) return;

        const search = (document.getElementById('searchInput')?.value || "").trim();
        const status = document.getElementById('filterStatus')?.value || "";
        const priority = document.getElementById('filterPriority')?.value || "";

        const searchNormalized = normalize(search);
        const keywords = searchNormalized.split(" ").filter(k => k);

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

        // 🚀 Ordenação por relevância simples
        if (search) {
            filtered.sort((a, b) => {
                const aMatch = normalize(a.motivo).includes(searchNormalized);
                const bMatch = normalize(b.motivo).includes(searchNormalized);
                return bMatch - aMatch;
            });
        }

        grid.innerHTML = "";

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
                        ${escapeHtml(t.prioridade)}
                    </span>
                </div>

                <div class="ticket-title">
                    ${highlight(t.motivo, search)}
                </div>

                <div class="ticket-meta">
                    <span>👤 ${highlight(t.nome, search)}</span>
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

                <div class="ticket-description">
                    <strong>📄 Descrição:</strong><br>
                    ${highlight(t.descricao, search)}
                </div>

                <div class="ticket-description">
                    Estado: ${escapeHtml(t.estado)}<br>
                    Criado: ${t.data_criacao ? new Date(t.data_criacao).toLocaleString() : "N/A"}
                </div>

                ${t.solucao ? `
                <div class="ticket-description">
                    <strong>🛠 Solução:</strong><br>
                    ${highlight(t.solucao, search)}
                </div>` : ""}
            `;

            grid.appendChild(div);
        });
    }
};

window.onload = () => dashboard.init();