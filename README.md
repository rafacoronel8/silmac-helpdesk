# 🎧 Silmac Help Desk

Sistema interno de gestão de tickets de suporte técnico, desenvolvido para a rede interna da Silmac.

![Node.js](https://img.shields.io/badge/Node.js-20.x-green?logo=node.js)
![Express](https://img.shields.io/badge/Express-5.x-black?logo=express)
![MySQL](https://img.shields.io/badge/MySQL-8.x-blue?logo=mysql)
![License](https://img.shields.io/badge/license-ISC-lightgrey)

---

## 📋 Funcionalidades

- Criação de tickets de suporte por qualquer utilizador da rede (sem login)
- Dashboard protegido por autenticação para a equipa de TI
- Filtros por estado, prioridade e pesquisa por nome/motivo
- Atualização de estado dos tickets (Aberto, Em Andamento, Em Pausa, Resolvido)
- Registo de solução ao resolver um ticket
- Notificação sonora quando entra um novo ticket
- Proteção XSS em todos os campos
- Rate limiting no login e criação de tickets

---

## 🗂️ Estrutura do Projeto

```
silmac-helpdesk/
├── server.js           # Servidor Express + rotas da API
├── createUser.js       # Script para gerar hash de password
├── package.json
├── .env                # Variáveis de ambiente (não está no git)
└── public/
    ├── index.html      # Página pública de criação de tickets
    ├── tickets.html    # Dashboard (protegido por login)
    ├── login.html      # Página de login standalone
    ├── style.css       # Estilos globais
    ├── script.js       # Lógica da página pública
    ├── dashboard.js    # Lógica do dashboard
    ├── images/
    │   └── silmac.ico
    └── sounds/
        └── not.wav     # Som de notificação
```

---

## ⚙️ Requisitos

- Node.js 20+
- MySQL 8+
- npm

---

## 🚀 Instalação e Deploy (Servidor / VM)

### 1. Clonar o repositório

```bash
git clone https://github.com/SEU_USER/silmac-helpdesk.git
cd silmac-helpdesk
```

### 2. Instalar dependências

```bash
npm install
```

### 3. Configurar variáveis de ambiente

Cria um ficheiro `.env` na raiz do projeto:

```env
DB_HOST=localhost
DB_USER=silmac
DB_PASS=password_forte_aqui
DB_NAME=silmac_db
SESSION_SECRET=string_longa_e_aleatoria
PORT=3000
```

### 4. Configurar a base de dados MySQL

```sql
CREATE DATABASE silmac_db;
CREATE USER 'silmac'@'localhost' IDENTIFIED BY 'password_forte_aqui';
GRANT ALL PRIVILEGES ON silmac_db.* TO 'silmac'@'localhost';
FLUSH PRIVILEGES;
USE silmac_db;

CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(100) NOT NULL,
  password VARCHAR(255) NOT NULL
);

CREATE TABLE tickets (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(100),
  departamento VARCHAR(100),
  ilha VARCHAR(100),
  motivo VARCHAR(100),
  descricao TEXT,
  prioridade VARCHAR(20),
  estado VARCHAR(50) DEFAULT 'Aberto',
  solucao TEXT,
  data_criacao DATETIME
);
```

### 5. Criar utilizador admin

```bash
node createUser.js
# Copia o hash gerado e insere na base de dados:

mysql -u silmac -p silmac_db
INSERT INTO users (username, password) VALUES ('admin', 'HASH_AQUI');
```

### 6. Arrancar o servidor

```bash
# Desenvolvimento
node server.js

# Produção (com PM2)
npm install -g pm2
pm2 start server.js --name silmac-helpdesk
pm2 save
pm2 startup
```

---

## 🌐 Deploy na Rede Interna com Nginx

Para expor o serviço na porta 80 (acesso via IP sem porta):

```nginx
server {
    listen 80;
    server_name 192.168.1.25;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/silmac /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

Qualquer máquina na rede pode aceder em: **`http://192.168.1.25`**

---

## 🔄 Atualizar o Projeto

Após fazer `git push` com alterações:

```bash
cd /home/usuario/silmac-helpdesk
git pull
npm install        # apenas se o package.json foi alterado
pm2 restart silmac-helpdesk
```

---

## 🔒 Segurança

| Medida | Detalhe |
|--------|---------|
| Autenticação | Sessões com `express-session` + bcrypt |
| Rate Limiting | Máximo 10 tentativas de login por 15 minutos |
| Proteção XSS | Escape de todos os campos renderizados no cliente |
| HttpOnly Cookie | Cookie de sessão não acessível via JavaScript |
| Variáveis de ambiente | Credenciais nunca no código ou no git |

---

## 📡 Endpoints da API

| Método | Rota | Acesso | Descrição |
|--------|------|--------|-----------|
| `POST` | `/login` | Público | Autenticação |
| `POST` | `/logout` | Autenticado | Terminar sessão |
| `GET` | `/dashboard` | Autenticado | Página do dashboard |
| `POST` | `/tickets` | Público | Criar ticket |
| `GET` | `/tickets` | Autenticado | Listar todos os tickets |
| `PUT` | `/tickets/:id` | Autenticado | Atualizar estado/solução |
| `DELETE` | `/tickets/:id` | Autenticado | Apagar ticket |

---

## 🛠️ Tecnologias Utilizadas

- **Backend:** Node.js, Express 5, MySQL2
- **Autenticação:** express-session, bcryptjs
- **Segurança:** express-rate-limit, helmet (recomendado)
- **Frontend:** HTML5, CSS3, JavaScript vanilla
- **Servidor:** Nginx (reverse proxy), PM2 (process manager)

---

## 👤 Autor

Desenvolvido para uso interno da **Silmac**. Autor Rafael Silva Coronel
