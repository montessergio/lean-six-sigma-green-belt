#!/usr/bin/env python3
"""
Genera tests/referencias-scipy.json con valores de referencia calculados por SciPy/NumPy.

Uso:  python3 tools/generar-referencias.py
Requiere: numpy y scipy. Los tests de Node (tests/stats.test.mjs) comparan js/lib/stats.js
contra este archivo, de modo que las funciones estadísticas del sitio quedan verificadas
por una implementación independiente.
"""
import json
import pathlib

import numpy as np
from scipy import special, stats

raiz = pathlib.Path(__file__).resolve().parent.parent
salida = raiz / "tests" / "referencias-scipy.json"

fuerza40 = [171.1, 179.9, 183.3, 175, 170.5, 177.5, 180.5, 183.9, 171.1, 170.7, 181.7, 180.5,
            186.3, 183.3, 177.3, 176.3, 192.1, 176.2, 173.5, 171.5, 178.4, 178.6, 175.9, 177.5,
            179.4, 181.7, 183.9, 179, 167.9, 181.7, 170, 176.9, 169.7, 177.9, 173.5, 179,
            196.1, 177.6, 182.5, 170.5]
torque10 = [1.32, 1.35, 1.38, 1.30, 1.41, 1.36, 1.33, 1.39, 1.34, 1.37]
conectores = [12, 15, 11, 14, 13, 19]

ref = {}

# --- funciones especiales ---
xs = [0, 0.05, 0.1, 0.5, 1, 1.5, 1.9, 2, 2.1, 2.5, 3, 4, 5, 6, 8, 10, 20]
ref["erfc"] = [[x, float(special.erfc(x))] for x in xs]
ref["erf"] = [[x, float(special.erf(x))] for x in xs]
ref["lgamma"] = [[x, float(special.gammaln(x))] for x in [0.3, 0.5, 1, 1.5, 2, 5, 10.5, 50, 100.25]]

# --- normal ---
zs = [-7, -6, -4.5, -3, -2.5, -1.96, -1, -0.5, 0, 0.5, 1, 1.5, 1.96, 2.83, 3, 4.5, 6]
ref["normal_cdf"] = [[z, float(stats.norm.cdf(z))] for z in zs]
ref["normal_sf"] = [[z, float(stats.norm.sf(z))] for z in zs]
ps = [1e-12, 1e-9, 3.4e-6, 1e-4, 3e-4, 1e-3, 0.02, 0.025, 0.1, 0.5, 0.9, 0.975, 0.999, 1 - 3e-4]
ref["normal_ppf"] = [[p, float(stats.norm.ppf(p))] for p in ps]

# --- t de Student ---
dfs = [1, 2, 3, 5, 9, 10, 29, 39, 100]
ref["t_ppf"] = [[p, df, float(stats.t.ppf(p, df))] for p in [0.6, 0.9, 0.975, 0.995] for df in dfs]
ref["t_cdf"] = [[t, df, float(stats.t.cdf(t, df))] for t in [-3, -1, 0, 0.5, 2, 2.262, 5] for df in [1, 4, 9, 30]]

# --- F y chi-cuadrada ---
ref["f_sf"] = [[f, d1, d2, float(stats.f.sf(f, d1, d2))] for f in [0.5, 1, 2.5, 4.26, 10, 30] for (d1, d2) in [(1, 8), (2, 9), (3, 36), (5, 20)]]
ref["chi2_sf"] = [[x, k, float(stats.chi2.sf(x, k))] for x in [0.5, 1, 3.84, 5.99, 12, 30] for k in [1, 2, 4, 9]]

# --- descriptiva ---
def desc(nombre, datos):
    a = np.array(datos, dtype=float)
    q1, q3 = np.percentile(a, [25, 75])  # método lineal = QUARTILE.INC
    n = len(a)
    m = a.mean()
    s = a.std(ddof=1)
    tc = stats.t.ppf(0.975, n - 1)
    return {
        "nombre": nombre,
        "datos": datos,
        "n": n,
        "media": float(m),
        "mediana": float(np.median(a)),
        "desviacion": float(s),
        "varianza": float(a.var(ddof=1)),
        "poblacional": float(a.std(ddof=0)),
        "q1": float(q1),
        "q3": float(q3),
        "asimetria": float(stats.skew(a, bias=False)),
        "curtosis": float(stats.kurtosis(a, bias=False)),
        "icInferior": float(m - tc * s / np.sqrt(n)),
        "icSuperior": float(m + tc * s / np.sqrt(n)),
    }

ref["descriptiva"] = [desc("fuerza40", fuerza40), desc("torque10", torque10), desc("conectores", conectores)]

# --- Six Sigma: tabla de la guía (M1 §6) con desplazamiento 1.5 ---
ref["sigma_dpmo"] = [[s, float(stats.norm.sf(s - 1.5) * 1e6)] for s in [1, 1.5, 2, 3, 4, 4.5, 5, 6]]
casos = [(2000, 5, 3), (1500, 8, 18), (3000, 6, 12), (3000, 6, 4), (800, 5, 2), (16000, 5, 13), (2000, 25, 15), (4000, 25, 16)]
ref["metricas_defectos"] = []
for (u, o, d) in casos:
    dpo = d / (u * o)
    z = float(-stats.norm.ppf(dpo))
    ref["metricas_defectos"].append({"u": u, "o": o, "d": d, "dpo": dpo, "dpmo": dpo * 1e6, "z": z, "sigma": z + 1.5})

# --- AHP: λmax por valores propios (independiente del método de columnas normalizadas) ---
def ahp_ref(m):
    A = np.array(m, dtype=float)
    n = len(A)
    w_col = (A / A.sum(axis=0)).mean(axis=1)
    lam_col = float(np.mean((A @ w_col) / w_col))
    vals, vecs = np.linalg.eig(A)
    k = np.argmax(vals.real)
    w_eig = np.abs(vecs[:, k].real)
    w_eig = w_eig / w_eig.sum()
    return {"matriz": m, "pesos_columnas": w_col.tolist(), "lambda_columnas": lam_col,
            "lambda_propio": float(vals[k].real), "pesos_propio": w_eig.tolist()}

M = [[1, 3, 4, 7], [1/3, 1, 2, 5], [1/4, 1/2, 1, 4], [1/7, 1/5, 1/4, 1]]
ref["ahp"] = [ahp_ref(M)]

# ======================================================================
# Sesión 4 (Analizar): cuantiles, rango estudentizado, ANOVA, regresión, chi-cuadrada, Fisher e IC
# ======================================================================
ref["f_ppf"] = [[p, d1, d2, float(stats.f.ppf(p, d1, d2))] for p in [0.9, 0.95, 0.99] for (d1, d2) in [(2, 12), (2, 27), (3, 40), (5, 10), (4, 100)]]
ref["chi2_ppf"] = [[p, k, float(stats.chi2.ppf(p, k))] for p in [0.9, 0.95, 0.99] for k in [1, 2, 4, 6, 16]]
ref["tukey_sf"] = [[q, k, df, float(stats.studentized_range.sf(q, k, df))] for k in (2, 3, 4, 6, 10) for df in (1, 2, 5, 10, 27, 60, 200) for q in (0.5, 1.5, 3.0, 4.5, 7.0)]
ref["tukey_ppf"] = [[p, k, df, float(stats.studentized_range.ppf(p, k, df))] for p in (0.95, 0.99) for k in (3, 4, 6) for df in (5, 12, 27, 100)]


def anova_ref(nombre, grupos, alfa=0.05):
    """ANOVA de un factor: tabla, F, p, F crítico, η², IC por grupo y comparaciones por pares (LSD y Tukey–Kramer)."""
    arrs = [np.array(g, dtype=float) for g in grupos]
    k = len(arrs)
    ni = [len(a) for a in arrs]
    N = sum(ni)
    gm = float(np.concatenate(arrs).mean())
    sce = float(sum(len(a) * (a.mean() - gm) ** 2 for a in arrs))
    scd = float(sum(((a - a.mean()) ** 2).sum() for a in arrs))
    gle, gld = k - 1, N - k
    cme, cmd = sce / gle, scd / gld
    F, p = stats.f_oneway(*arrs)
    tc = float(stats.t.ppf(1 - alfa / 2, gld))
    qc = float(stats.studentized_range.ppf(1 - alfa, k, gld))
    tukey = stats.tukey_hsd(*arrs)
    pares = []
    for i in range(k):
        for j in range(i + 1, k):
            se = float(np.sqrt(cmd * (1 / ni[i] + 1 / ni[j])))
            dif = float(arrs[i].mean() - arrs[j].mean())
            t_est = dif / se
            p_tukey = float(stats.studentized_range.sf(abs(t_est) * np.sqrt(2), k, gld))
            assert abs(p_tukey - float(tukey.pvalue[i][j])) < 1e-6, "tukey_hsd y studentized_range no coinciden"
            pares.append({"i": i, "j": j, "dif": dif, "se": se, "lsd": tc * se, "p_lsd": float(2 * stats.t.sf(abs(t_est), gld)),
                          "hsd": qc * se / float(np.sqrt(2)), "p_tukey": p_tukey})
    grupos_ref = []
    for a, n in zip(arrs, ni):
        semi = tc * float(np.sqrt(cmd / n))
        grupos_ref.append({"n": n, "media": float(a.mean()), "s": float(a.std(ddof=1)), "semi": semi})
    s_ = [g["s"] for g in grupos_ref]
    return {"nombre": nombre, "alfa": alfa, "grupos": grupos, "k": k, "N": N, "mediaGlobal": gm, "scEntre": sce, "scDentro": scd,
            "glEntre": gle, "glDentro": gld, "cmEntre": cme, "cmDentro": cmd, "F": float(F), "p": float(p),
            "fCritico": float(stats.f.ppf(1 - alfa, gle, gld)), "eta2": sce / (sce + scd), "razonS": max(s_) / min(s_),
            "tCritico": tc, "qCritico": qc, "gruposRef": grupos_ref, "pares": pares}


turnos_guia = [[172, 175, 178, 174, 176], [173, 176, 171, 177, 173], [165, 168, 158, 170, 164]]
turnos_excel = [[178.3, 176.5, 171.5, 180.1, 177.6, 177.8, 177.1, 183.1, 180.3, 181.6],
                [178.8, 178, 174.9, 183.1, 172.2, 177.1, 179.9, 179.1, 179, 173.9],
                [162.5, 165.5, 169.7, 164.9, 162.8, 160.5, 170.7, 166.7, 164.6, 163.2]]
ref["anova"] = [
    anova_ref("minimo", [[10, 12], [14, 16], [18, 20]]),
    anova_ref("guia", turnos_guia),
    anova_ref("excel", turnos_excel),
    anova_ref("excel_alfa01", turnos_excel, alfa=0.01),
    anova_ref("desbalanceado", [[5.1, 4.8, 5.4, 5.0], [5.9, 6.3, 6.1], [5.2, 5.5, 5.0, 5.3, 5.6], [6.8, 7.1, 6.5, 7.0]]),
]


def reg_ref(nombre, x, y, predicciones, objetivos):
    x = np.array(x, dtype=float)
    y = np.array(y, dtype=float)
    n = len(x)
    r = stats.linregress(x, y)
    res = y - (r.intercept + r.slope * x)
    s = float(np.sqrt((res ** 2).sum() / (n - 2)))
    tc = float(stats.t.ppf(0.975, n - 2))
    sxx = float(((x - x.mean()) ** 2).sum())
    out = {"nombre": nombre, "x": x.tolist(), "y": y.tolist(), "n": n, "pendiente": float(r.slope), "intercepto": float(r.intercept),
           "r": float(r.rvalue), "r2": float(r.rvalue ** 2), "s": s, "eePendiente": float(r.stderr), "eeIntercepto": float(r.intercept_stderr),
           "t": float(r.slope / r.stderr), "p": float(r.pvalue), "icPendiente": [float(r.slope - tc * r.stderr), float(r.slope + tc * r.stderr)],
           "residuos": res.tolist(), "predicciones": [], "xParaY": []}
    for x0 in predicciones:
        yh = float(r.intercept + r.slope * x0)
        sm = s * float(np.sqrt(1 / n + (x0 - x.mean()) ** 2 / sxx))
        sp = s * float(np.sqrt(1 + 1 / n + (x0 - x.mean()) ** 2 / sxx))
        out["predicciones"].append({"x0": x0, "yh": yh, "icMedia": [yh - tc * sm, yh + tc * sm], "icPred": [yh - tc * sp, yh + tc * sp],
                                    "fuera": bool(x0 < x.min() or x0 > x.max())})
    for y0 in objetivos:
        out["xParaY"].append({"y0": y0, "x": float((y0 - r.intercept) / r.slope)})
    return out


fuerza_r = [160, 162.3, 164.5, 166.8, 169.1, 171.4, 173.6, 175.9, 178.2, 180.5, 182.7, 185]
resist_r = [2.21, 2.01, 1.94, 1.53, 1.48, 1.13, 1.17, 0.9, 0.78, 0.45, 0.32, 0.07]
ref["regresion"] = [
    reg_ref("excel", fuerza_r, resist_r, [170, 175, 190, 150], [1.5, 1.2]),
    reg_ref("generico", list(range(1, 11)), [2.1, 3.9, 6.2, 7.8, 10.1, 12.2, 13.8, 16.1, 18.0, 20.2], [5.5, 12, 0], [10, 25]),
    reg_ref("debil", [1, 2, 3, 4, 5, 6, 7, 8], [3.1, 2.4, 4.8, 3.3, 2.9, 4.1, 3.6, 4.4], [4.5, 9], [4]),
]


def chi_ref(nombre, obs):
    O = np.array(obs, dtype=float)
    chi2, p, gl, E = stats.chi2_contingency(O, correction=False)
    r, c = O.shape
    N = float(O.sum())
    out = {"nombre": nombre, "observadas": obs, "N": N, "chi2": float(chi2), "p": float(p), "gl": int(gl), "esperadas": E.tolist(),
           "critico": float(stats.chi2.ppf(0.95, gl)), "cramerV": float(np.sqrt(chi2 / (N * min(r - 1, c - 1)))),
           "bajas": int((E < 5).sum()), "minEsperado": float(E.min()), "contribuciones": ((O - E) ** 2 / E).tolist()}
    if O.shape == (2, 2):
        chi2y, py, _, _ = stats.chi2_contingency(O, correction=True)
        out["yates"] = float(chi2y)
        out["pYates"] = float(py)
        out["fisher"] = float(stats.fisher_exact(O)[1])
    return out


ref["chi2"] = [
    chi_ref("excel", [[285, 280, 262], [15, 20, 38]]),
    chi_ref("guia", [[2, 2, 6], [5338, 5338, 5334]]),
    chi_ref("torque_resto", [[6, 8, 21], [25, 22, 21]]),
    chi_ref("hoja_lab14", [[14, 11, 9], [6, 8, 21], [5, 4, 6], [3, 2, 4], [2, 3, 1], [1, 2, 1]]),
    chi_ref("t1_t2", [[285, 15], [280, 20]]),
    chi_ref("fisher_a", [[3, 1], [1, 3]]),
    chi_ref("fisher_b", [[8, 2], [1, 5]]),
    chi_ref("grande_2x2", [[1200, 800], [900, 1100]]),
    chi_ref("tres_por_tres", [[20, 15, 25], [30, 35, 15], [10, 20, 30]]),
]

ref["ic_media"] = []
for (n, m, s, conf) in [(25, 80, 10, 0.95), (16, 50, 8, 0.95), (10, 1.355, 0.034, 0.95), (10, 1.355, 0.034, 0.99), (40, 177.0, 6.3, 0.90), (3, 10, 2, 0.95)]:
    z = float(stats.norm.ppf(1 - (1 - conf) / 2))
    t_ = float(stats.t.ppf(1 - (1 - conf) / 2, n - 1))
    ee = s / np.sqrt(n)
    ref["ic_media"].append({"n": n, "media": m, "s": s, "confianza": conf, "z": z, "t": t_, "ee": float(ee),
                            "icZ": [float(m - z * ee), float(m + z * ee)], "icT": [float(m - t_ * ee), float(m + t_ * ee)]})

salida.write_text(json.dumps(ref, ensure_ascii=False, indent=1))
print("escrito", salida, "con", len(ref), "bloques")
