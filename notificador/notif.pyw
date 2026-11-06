import tkinter as tk
import requests, os, json, winsound, webbrowser

# ===== CONFIGURAÇÃO =====
BASE = "http://192.168.1.32:3000"                      # helpdesk dentro da rede interna
TOKEN = "5f52f4f8a78de1af7936b3680b97f6f09eaac10faf451215"                   # igual ao NOTIF_TOKEN do .env na VM
URL_DASHBOARD = "http://helpdesk.silmac.cv:6080/dashboard"
INTERVALO_MS = 5000                                    # consulta a cada 5 segundos
DURACAO_MS = 20000                                     # pop-up fica 20 segundos
SOM = os.path.join(os.path.dirname(os.path.abspath(__file__)), "not.wav")
# ========================

ESTADO = os.path.join(os.environ["APPDATA"], "helpdesk_notif.json")
CORES = {"Alta": "#b91c1c", "Média": "#c2410c", "Media": "#c2410c", "Baixa": "#15803d"}

root = tk.Tk()
root.withdraw()
abertos = []
ultimo = None
try:
    with open(ESTADO) as f:
        ultimo = json.load(f)["ultimo"]
except Exception:
    pass


def tocar_som():
    try:
        if os.path.exists(SOM):
            winsound.PlaySound(SOM, winsound.SND_FILENAME | winsound.SND_ASYNC)
        else:
            winsound.PlaySound("SystemExclamation", winsound.SND_ALIAS | winsound.SND_ASYNC)
    except Exception:
        pass


def reposicionar():
    for i, w in enumerate(abertos):
        x = w.winfo_screenwidth() - 380
        y = w.winfo_screenheight() - 60 - (i + 1) * 170
        w.geometry(f"+{x}+{y}")


def fechar(w):
    if w in abertos:
        abertos.remove(w)
        w.destroy()
        reposicionar()


def abrir_dashboard(w):
    webbrowser.open(URL_DASHBOARD)
    fechar(w)


def popup(t):
    cor = CORES.get(t.get("prioridade"), "#1d4ed8")
    w = tk.Toplevel(root)
    w.overrideredirect(True)
    w.attributes("-topmost", True)
    w.configure(bg="white", highlightbackground=cor, highlightthickness=2)
    w.geometry("360x150")

    tk.Label(w, text=f"Novo Ticket Aberto: #{t['id']}", bg="white", fg="#0b4a8f",
             font=("Segoe UI", 12, "bold")).pack(anchor="w", padx=12, pady=(10, 2))
    tk.Label(w, text=f"Nome: {t.get('nome', '')}", bg="white",
             font=("Segoe UI", 10)).pack(anchor="w", padx=12)
    tk.Label(w, text=f"Problema: {t.get('problema', '')}", bg="white", wraplength=330,
             justify="left", font=("Segoe UI", 10)).pack(anchor="w", padx=12)
    tk.Label(w, text=f"Prioridade: {t.get('prioridade', '')}", bg="white", fg=cor,
             font=("Segoe UI", 10, "bold")).pack(anchor="w", padx=12, pady=(4, 0))

    w.bind("<Button-1>", lambda e: abrir_dashboard(w))
    for filho in w.winfo_children():
        filho.bind("<Button-1>", lambda e: abrir_dashboard(w))

    abertos.append(w)
    reposicionar()
    tocar_som()
    w.after(DURACAO_MS, lambda: fechar(w))


def verificar():
    global ultimo
    try:
        r = requests.get(f"{BASE}/api/notificacoes/novos",
                         params={"desde": ultimo or 0},
                         headers={"x-token": TOKEN}, timeout=3)
        d = r.json()
        if ultimo is None:
            ultimo = d["max_id"]            # 1.ª execução: não avisa o histórico
        else:
            for t in d["tickets"]:
                popup(t)
                ultimo = t["id"]
        with open(ESTADO, "w") as f:
            json.dump({"ultimo": ultimo}, f)
    except Exception:
        pass
    root.after(INTERVALO_MS, verificar)


verificar()
root.mainloop()
