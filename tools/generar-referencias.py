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

salida.write_text(json.dumps(ref, ensure_ascii=False, indent=1))
print("escrito", salida, "con", len(ref), "bloques")
