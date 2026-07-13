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

// 🌗 MODO ESCURO
function initTheme() {
    const saved = localStorage.getItem('silmac-theme') || 'light';
    document.documentElement.setAttribute('data-theme', saved);
    updateThemeIcon(saved);
}

function updateThemeIcon(theme) {
    const btn = document.getElementById('themeToggle');
    if (!btn) return;
    btn.innerHTML = theme === 'dark'
        ? '<i class="fas fa-sun"></i>'
        : '<i class="fas fa-moon"></i>';
}

// 🔔 SOM DE NOTIFICAÇÃO
const notificationSound = new Audio('/sounds/not.wav');

// Desbloquear áudio na primeira interação do utilizador
document.addEventListener('click', () => {
    notificationSound.play().then(() => {
        notificationSound.pause();
        notificationSound.currentTime = 0;
    }).catch(() => {});
}, { once: true });

const dashboard = {

    tickets: [],
    lastTicketIds: null,   // null = primeira carga (não toca som)
    selectedTicketId: null,
    chart: null,
    viewMode: "grid",

    init: async function () {
        initTheme();

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
            const res = await fetch('/tickets', {
                cache: 'no-store'
            });

            // Sessão expirou ou não autenticado
            if (res.status === 401) {
                window.location.href = '/';
                return;
            }

            if (!res.ok) {
                console.error("Erro ao carregar tickets:", res.status);
                return;
            }

            const newTickets = await res.json();

            // 🔔 Tocar som se houver tickets novos (ignora a primeira carga)
            if (this.lastTicketIds !== null) {
                const currentIds = new Set(newTickets.map(t => t.id));
                const hasNew = newTickets.some(t => !this.lastTicketIds.has(t.id));
                if (hasNew) {
                    notificationSound.currentTime = 0;
                    notificationSound.play().catch(err => console.log("Som bloqueado:", err));
                }
            }

            this.lastTicketIds = new Set(newTickets.map(t => t.id));
            this.tickets = newTickets;

            this.updateStats();
            this.render();
        } catch (error) {
            console.error("Erro ao carregar tickets:", error);
        }
    },

    updateStats: function () {
        let high = 0, medium = 0, low = 0;
        let resolved = 0, andamento = 0, aberto = 0;

        this.tickets.forEach(t => {
            if (t.prioridade === "Alta") high++;
            else if (t.prioridade === "Media") medium++;
            else if (t.prioridade === "Baixa") low++;

            if (t.estado === "Resolvido") resolved++;
            else if (t.estado === "Em Andamento") andamento++;
            else if (t.estado === "Aberto" || t.estado === "Pendente") aberto++;
        });

        document.getElementById('highCount').textContent = high;
        document.getElementById('mediumCount').textContent = medium;
        document.getElementById('lowCount').textContent = low;
        document.getElementById('resolvedCount').textContent = resolved;
        document.getElementById('andamentoCount').textContent = andamento;
        document.getElementById('abertoCount').textContent = aberto;

        this.renderChart(high, medium, low);
        this.updateInsights(resolved);
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

    // 🌗 TOGGLE MODO ESCURO
    toggleTheme: function () {
        const current = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
        const next = current === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('silmac-theme', next);
        updateThemeIcon(next);
        if (this.chart) this.renderChart(
            this.tickets.filter(t => t.prioridade === 'Alta').length,
            this.tickets.filter(t => t.prioridade === 'Media').length,
            this.tickets.filter(t => t.prioridade === 'Baixa').length
        );
    },

    // 🎫 NOVO TICKET (a partir do dashboard)
    openTicketModal: function () {
        document.getElementById('ticketModal').classList.add('open');
        setTimeout(() => document.getElementById('tkNome')?.focus(), 100);
    },

    closeTicketModal: function () {
        document.getElementById('ticketModal').classList.remove('open');
        ['tkNome', 'tkContacto', 'tkAnydesk', 'tkDescricao'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
        ['tkDepartamento', 'tkIlha', 'tkCategory'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
    },

    submitTicket: async function () {
        const nome = document.getElementById('tkNome')?.value.trim();
        const contacto = document.getElementById('tkContacto')?.value.trim();
        const anydesk = document.getElementById('tkAnydesk')?.value.trim();
        const departamento = document.getElementById('tkDepartamento')?.value;
        const ilha = document.getElementById('tkIlha')?.value;
        const descricao = document.getElementById('tkDescricao')?.value.trim();

        const categoryValue = document.getElementById('tkCategory')?.value || "";
        const [motivo, prioridade] = categoryValue.split('|');

        const requiredIds = [];
        if (!nome) requiredIds.push('tkNome');
        if (!ilha) requiredIds.push('tkIlha');
        if (!motivo || !prioridade) requiredIds.push('tkCategory');

        if (requiredIds.length) {
            requiredIds.forEach(id => {
                const el = document.getElementById(id);
                if (!el) return;
                el.style.borderColor = 'var(--danger)';
                setTimeout(() => el.style.borderColor = '', 1500);
            });
            return;
        }

        try {
            const res = await fetch('/tickets', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nome, contacto, anydesk, departamento, ilha, motivo, descricao, prioridade })
            });

            const data = await res.json();

            if (!res.ok || !data.success) {
                alert(data.error || 'Erro ao criar ticket');
                return;
            }

            this.closeTicketModal();
            await this.loadTickets();

        } catch (error) {
            console.error("Erro ao criar ticket:", error);
            alert('Erro ao criar ticket. Tenta novamente.');
        }
    },

    // 📊 MINI DASHBOARD / INSIGHTS
    updateInsights: function (resolvedCount) {
        // Tickets hoje
        const todayStr = new Date().toDateString();
        const todayCount = this.tickets.filter(t =>
            t.data_criacao && new Date(t.data_criacao).toDateString() === todayStr
        ).length;
        const todayEl = document.getElementById('todayCount');
        if (todayEl) todayEl.textContent = todayCount;

        // Utilizador com mais pedidos (agrupado por primeiro nome, normalizado)
        // Ex: "Natalino", "natalino", "Natalino Piedade" contam como a mesma pessoa
        const groups = {};
        this.tickets.forEach(t => {
            if (!t.nome) return;
            const firstRaw = t.nome.trim().split(/\s+/)[0];
            if (!firstRaw) return;
            const key = normalize(firstRaw);
            if (!groups[key]) {
                groups[key] = {
                    count: 0,
                    display: firstRaw.charAt(0).toUpperCase() + firstRaw.slice(1).toLowerCase()
                };
            }
            groups[key].count++;
        });

        const ranked = Object.values(groups).sort((a, b) => b.count - a.count);

        const topNameEl = document.getElementById('topUserName');
        const topCountEl = document.getElementById('topUserCount');
        if (topNameEl && topCountEl) {
            if (ranked.length) {
                topNameEl.textContent = ranked[0].display;
                topCountEl.textContent = `${ranked[0].count} ticket${ranked[0].count !== 1 ? 's' : ''}`;
            } else {
                topNameEl.textContent = '—';
                topCountEl.textContent = '';
            }
        }

        const rankingList = document.getElementById('rankingList');
        if (rankingList) {
            if (!ranked.length) {
                rankingList.innerHTML = '<div class="insight-sub">Sem dados ainda.</div>';
            } else {
                rankingList.innerHTML = ranked.slice(0, 5).map((r, i) => `
                    <div class="ranking-row">
                        <span class="ranking-pos">${i + 1}</span>
                        <span class="ranking-name">${escapeHtml(r.display)}</span>
                        <span class="ranking-count">${r.count}</span>
                    </div>
                `).join('');
            }
        }

        this.updateMilestone(resolvedCount);
    },

    // 🏆 PRÉMIOS (100, 150, 200... — 50 a 50 tickets resolvidos, total da equipa)
    updateMilestone: function (resolvedCount) {
        const START = 100;
        const STEP = 50;

        let progress, total, next;

        if (resolvedCount < START) {
            progress = resolvedCount;
            total = START;
            next = START;
        } else {
            const k = Math.floor((resolvedCount - START) / STEP) + 1;
            next = START + STEP * k;
            const stepStart = next - STEP;
            progress = resolvedCount - stepStart;
            total = STEP;
        }

        const progressEl = document.getElementById('milestoneProgress');
        const subEl = document.getElementById('milestoneSub');
        if (progressEl) progressEl.textContent = `${progress} / ${total}`;
        if (subEl) subEl.textContent = `Próxima meta: ${next} tickets resolvidos`;

        // Verificar se um novo prémio foi alcançado (total da equipa)
        if (resolvedCount >= START) {
            const highestMilestone = START + STEP * Math.floor((resolvedCount - START) / STEP);
            const last = parseInt(localStorage.getItem('silmac-last-milestone') || '0', 10);
            if (highestMilestone > last) {
                localStorage.setItem('silmac-last-milestone', String(highestMilestone));
                this.showMilestoneToast(highestMilestone);
            }
        }
    },

    showMilestoneToast: function (value) {
        const toast = document.getElementById('milestoneToast');
        if (!toast) return;
        const titleEl = document.getElementById('milestoneToastTitle');
        const subEl = document.getElementById('milestoneToastSub');
        if (titleEl) titleEl.textContent = 'Parabéns, equipa! 🎉';
        if (subEl) subEl.textContent = `${value} tickets resolvidos!`;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 5000);
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
                ${t.anydesk || ''}
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

        // 🔥 ORDENAR POR ESTADO → depois por PRIORIDADE
        const estadoOrder = { "Aberto": 4, "Pendente": 4, "Em Andamento": 3, "Resolvido": 1 };
        const prioOrder   = { "Alta": 3, "Media": 2, "Baixa": 1 };
        filtered.sort((a, b) => {
            const eDiff = (estadoOrder[b.estado] || 0) - (estadoOrder[a.estado] || 0);
            if (eDiff !== 0) return eDiff;
            return (prioOrder[b.prioridade] || 0) - (prioOrder[a.prioridade] || 0);
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
            const isResolvido = t.estado === 'Resolvido';

            const div = document.createElement('div');
            div.className = `ticket-card ${pc}${isResolvido ? ' resolved' : ''}`;

            div.innerHTML = `
                <div class="ticket-header">
                    <span class="ticket-id">#${escapeHtml(t.id)}</span>
                    <div style="display:flex;align-items:center;gap:6px;">
                        ${isResolvido ? `<span class="resolved-badge"><i class="fas fa-check-circle"></i> Resolvido</span>` : ''}
                        <span class="priority-badge ${pc}">
                            ${escapeHtml(t.prioridade)}
                        </span>
                    </div>
                </div>

                <div class="ticket-title">
                    ${highlight(t.motivo, search)}
                </div>

                <div class="ticket-meta">
                    <span>👤 ${highlight(t.nome, search)}${t.contacto && t.contacto !== '---' ? ` · 📞 ${highlight(t.contacto, search)}` : ''}</span>
                    <span>🏢 ${highlight(t.departamento, search)}</span>
                    <span>📍 ${highlight(t.ilha, search)}</span>
                    ${t.anydesk && t.anydesk !== '---' ? `<span class="anydesk-badge"><i class="fas fa-desktop"></i> AnyDesk: ${highlight(t.anydesk, search)}</span>` : ''}
                </div>

                <div class="status-badge-box">
                    <select onchange="dashboard.changeStatus(${t.id}, this.value)">
                        <option value="Aberto" ${t.estado === 'Aberto' || t.estado === 'Pendente' ? 'selected' : ''}>Aberto</option>
                        <option value="Em Andamento" ${t.estado === 'Em Andamento' ? 'selected' : ''}>Em Andamento</option>
                        <option value="Resolvido" ${t.estado === 'Resolvido' ? 'selected' : ''}>Resolvido</option>
                    </select>
                </div>

                <div class="ticket-type-row">
                    <span class="ticket-type-chip">
                        <i class="fas fa-tag"></i> ${escapeHtml(t.motivo || 'Outro')}
                    </span>
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

document.getElementById('ticketModal')?.addEventListener('click', function(e) {
    if (e.target === this) dashboard.closeTicketModal();
});

document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        dashboard.closeSolutionModal();
        dashboard.closeTicketModal();
    }
});

window.onload = () => dashboard.init();