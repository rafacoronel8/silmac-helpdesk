// ===========================
//   MATERIALS MODULE
// ===========================

const materialsModule = {

    materials: [],
    selectedUrgencia: 'Normal',

    init: async function () {
        await this.loadMaterials();
        setInterval(() => this.loadMaterials(), 15000);
    },

    loadMaterials: async function () {
        try {
            const res = await fetch('/materials', { cache: 'no-store' });

            if (res.status === 401) { window.location.href = '/'; return; }
            if (!res.ok) { console.error("Erro ao carregar materiais:", res.status); return; }

            this.materials = await res.json();
            this.render();
        } catch (err) {
            console.error("Erro ao carregar materiais:", err);
        }
    },

    // ─── MODAL ───────────────────────────────────────────
    openModal: function (preselectedMaterial = null) {
        if (preselectedMaterial) {
            document.getElementById('matMaterial').value = preselectedMaterial;
        }
        document.getElementById('materialModal').classList.add('open');
        setTimeout(() => document.getElementById('matMaterial').focus(), 100);
    },

    closeModal: function () {
        document.getElementById('materialModal').classList.remove('open');
        this.resetForm();
    },

    resetForm: function () {
        document.getElementById('matMaterial').value = '';
        document.getElementById('matDepartamento').value = '';
        document.getElementById('matNome').value = '';
        document.getElementById('matQuantidade').value = '1';
        document.getElementById('matObservacoes').value = '';
        this.setUrgencia('Normal', document.querySelector('.urgencia-btn.normal'));
    },

    // ─── QUICK SELECT ─────────────────────────────────────
    quickSelect: function (material) {
        this.openModal(material);
    },

    // ─── URGENCIA TOGGLE ──────────────────────────────────
    setUrgencia: function (value, btn) {
        this.selectedUrgencia = value;
        document.getElementById('matUrgencia').value = value;

        document.querySelectorAll('.urgencia-btn').forEach(b => b.classList.remove('active'));
        if (btn) btn.classList.add('active');
    },

    // ─── SAVE ─────────────────────────────────────────────
    save: async function () {
        const material     = document.getElementById('matMaterial').value.trim();
        const departamento = document.getElementById('matDepartamento').value;
        const urgencia     = document.getElementById('matUrgencia').value;
        const nome         = document.getElementById('matNome').value.trim();
        const quantidade   = parseInt(document.getElementById('matQuantidade').value) || 1;
        const observacoes  = document.getElementById('matObservacoes').value.trim();

        // Validation
        const errors = [];
        if (!material)     { errors.push('matMaterial'); }
        if (!departamento) { errors.push('matDepartamento'); }
        if (!nome)         { errors.push('matNome'); }

        if (errors.length) {
            errors.forEach(id => {
                const el = document.getElementById(id);
                el.style.borderColor = 'var(--danger)';
                el.style.boxShadow   = '0 0 0 3px rgba(197,48,48,0.12)';
                setTimeout(() => {
                    el.style.borderColor = '';
                    el.style.boxShadow   = '';
                }, 2000);
            });
            return;
        }

        try {
            const res = await fetch('/materials', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ material, departamento, urgencia, nome, quantidade, observacoes })
            });

            if (!res.ok) throw new Error("Erro ao guardar");

            this.closeModal();
            await this.loadMaterials();

        } catch (err) {
            console.error("Erro ao guardar requisição:", err);
            alert("Erro ao guardar a requisição. Tente novamente.");
        }
    },

    // ─── DELETE ───────────────────────────────────────────
    delete: async function (id) {
        if (!confirm("Remover esta requisição?")) return;
        try {
            await fetch(`/materials/${id}`, { method: 'DELETE' });
            await this.loadMaterials();
        } catch (err) {
            console.error("Erro ao eliminar:", err);
        }
    },

    // ─── UPDATE STATUS ────────────────────────────────────
    updateStatus: async function (id, estado) {
        try {
            await fetch(`/materials/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ estado })
            });
            await this.loadMaterials();
        } catch (err) {
            console.error("Erro ao atualizar estado:", err);
        }
    },

    // ─── RENDER ───────────────────────────────────────────
    render: function () {
        const tbody = document.getElementById('materialsBody');
        const badge = document.getElementById('materialCountBadge');
        if (!tbody) return;

        const search    = (document.getElementById('materialSearch')?.value || '').trim().toLowerCase();
        const urgFilter = document.getElementById('materialFilterUrgencia')?.value || '';

        let filtered = this.materials.filter(m => {
            const text = `${m.material} ${m.departamento} ${m.nome} ${m.observacoes || ''}`.toLowerCase();
            const matchSearch  = !search    || text.includes(search);
            const matchUrgencia = !urgFilter || m.urgencia === urgFilter;
            return matchSearch && matchUrgencia;
        });

        // Sort: Urgente first
        const urgOrder = { 'Urgente': 3, 'Normal': 2, 'Baixa': 1 };
        filtered.sort((a, b) => (urgOrder[b.urgencia] || 0) - (urgOrder[a.urgencia] || 0));

        if (badge) badge.textContent = filtered.length;

        if (filtered.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" class="table-empty">
                        <i class="fas fa-box-open"></i>
                        <p>${this.materials.length === 0 ? 'Nenhuma requisição registada.' : 'Nenhum resultado encontrado.'}</p>
                    </td>
                </tr>`;
            return;
        }

        tbody.innerHTML = filtered.map(m => {
            const urgClass = (m.urgencia || '').toLowerCase();
            const estado   = m.estado || 'Pendente';
            const estadoClass = estado === 'Entregue' ? 'entregue' : estado === 'Em Encomenda' ? 'encomenda' : 'pendente';

            const date = m.data_criacao
                ? new Date(m.data_criacao).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: '2-digit' })
                : '—';

            const icon = this.getMaterialIcon(m.material);

            return `
            <tr class="material-row">
                <td class="mat-id">#${escapeHtml(String(m.id))}</td>
                <td class="mat-material">
                    <span class="mat-icon">${icon}</span>
                    <div>
                        <strong>${escapeHtml(m.material)}</strong>
                        ${m.quantidade && m.quantidade > 1 ? `<span class="mat-qty">×${m.quantidade}</span>` : ''}
                        ${m.observacoes ? `<div class="mat-obs">${escapeHtml(m.observacoes)}</div>` : ''}
                    </div>
                </td>
                <td><span class="dept-tag">${escapeHtml(m.departamento)}</span></td>
                <td><span class="urg-badge ${urgClass}">${escapeHtml(m.urgencia)}</span></td>
                <td class="mat-nome">${escapeHtml(m.nome)}</td>
                <td class="mat-date">${date}</td>
                <td>
                    <select class="mat-status-select ${estadoClass}" onchange="materialsModule.updateStatus(${m.id}, this.value)">
                        <option ${estado === 'Pendente'       ? 'selected' : ''}>Pendente</option>
                        <option ${estado === 'Em Encomenda'   ? 'selected' : ''}>Em Encomenda</option>
                        <option ${estado === 'Entregue'       ? 'selected' : ''}>Entregue</option>
                    </select>
                </td>
                <td>
                    <button class="mat-delete-btn" onclick="materialsModule.delete(${m.id})" title="Remover">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>`;
        }).join('');
    },

    // ─── MATERIAL → FONT AWESOME ICON ────────────────────
    getMaterialIcon: function (name) {
        if (!name) return '<i class="fas fa-box"></i>';
        const n = name.toLowerCase();

        // Cabos
        if (n.includes('hdmi'))                                                       return '<i class="fas fa-tv"></i>';
        if (n.includes('vga'))                                                        return '<i class="fas fa-tv"></i>';
        if (n.includes('displayport'))                                                return '<i class="fas fa-tv"></i>';
        if (n.includes('rede') || n.includes('rj45') || n.includes('ethernet'))      return '<i class="fas fa-network-wired"></i>';
        if (n.includes('usb'))                                                        return '<i class="fab fa-usb"></i>';
        if (n.includes('alimentação') || n.includes('power'))                         return '<i class="fas fa-plug"></i>';
        if (n.includes('cabo'))                                                       return '<i class="fas fa-ethernet"></i>';

        // Periféricos
        if (n.includes('teclado'))                                                    return '<i class="fas fa-keyboard"></i>';
        if (n.includes('rato') || n.includes('mouse'))                                return '<i class="fas fa-mouse"></i>';
        if (n.includes('monitor') || n.includes('ecrã'))                              return '<i class="fas fa-desktop"></i>';
        if (n.includes('impressor') || n.includes('printer'))                         return '<i class="fas fa-print"></i>';
        if (n.includes('tinteiro') || n.includes('toner') || n.includes('cartucho')) return '<i class="fas fa-fill-drip"></i>';
        if (n.includes('headset') || n.includes('auricular') || n.includes('headphone')) return '<i class="fas fa-headphones"></i>';
        if (n.includes('webcam') || n.includes('câmera') || n.includes('camera'))    return '<i class="fas fa-camera"></i>';
        if (n.includes('projetor') || n.includes('projector'))                        return '<i class="fas fa-film"></i>';
        if (n.includes('scanner'))                                                    return '<i class="fas fa-barcode"></i>';
        if (n.includes('leitor'))                                                     return '<i class="fas fa-qrcode"></i>';

        // Rede & Infraestrutura
        if (n.includes('switch'))                                                     return '<i class="fas fa-random"></i>';
        if (n.includes('router') || n.includes('access point') || n.includes('ap ')) return '<i class="fas fa-wifi"></i>';
        if (n.includes('patch'))                                                      return '<i class="fas fa-sitemap"></i>';
        if (n.includes('rack'))                                                       return '<i class="fas fa-server"></i>';
        if (n.includes('firewall'))                                                   return '<i class="fas fa-shield-alt"></i>';

        // Hardware
        if (n.includes('ram') || n.includes('memória'))                               return '<i class="fas fa-memory"></i>';
        if (n.includes('ssd') || n.includes('nvme') || n.includes('hdd') || n.includes('disco')) return '<i class="fas fa-hdd"></i>';
        if (n.includes('pen') || n.includes('usb drive') || n.includes('pendrive'))  return '<i class="fas fa-save"></i>';
        if (n.includes('bateria') || n.includes('ups'))                               return '<i class="fas fa-battery-three-quarters"></i>';
        if (n.includes('fonte') || n.includes('psu'))                                 return '<i class="fas fa-bolt"></i>';
        if (n.includes('processador') || n.includes('cpu'))                           return '<i class="fas fa-microchip"></i>';
        if (n.includes('placa'))                                                      return '<i class="fas fa-microchip"></i>';

        // Outros
        if (n.includes('cadeira'))                                                    return '<i class="fas fa-chair"></i>';
        if (n.includes('mesa'))                                                       return '<i class="fas fa-table"></i>';
        if (n.includes('telefon'))                                                    return '<i class="fas fa-phone"></i>';
        if (n.includes('papel'))                                                      return '<i class="fas fa-file"></i>';
        if (n.includes('outro'))                                                      return '<i class="fas fa-box"></i>';

        return '<i class="fas fa-box"></i>';
    }
};

// Modal outside click
document.getElementById('materialModal')?.addEventListener('click', function (e) {
    if (e.target === this) materialsModule.closeModal();
});

document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') materialsModule.closeModal();
});

// Init
window.addEventListener('load', () => {
    materialsModule.init();
});