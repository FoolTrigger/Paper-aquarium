"""
fish_generator.py
------------------------------------------------------------
Процедурная генерация низкополигональных рыб для Paper Aquarium:
тело — поверхность вращения вокруг оси Z (хвост в -Z, голова в +Z)
со сплюснутым по X эллиптическим сечением (рыбы уплощены с боков),
плюс хвостовой, спинной и два грудных плавника как плоские сегменты.

Модели без скелета — это ровно тот путь, для которого в проекте уже есть
addBend()/fish-frame.js: ориентацию (нос/хвост/бок) и диапазон вдоль тела
приложение определит само по bounding box при загрузке, ничего вручную
прописывать не нужно.

Экспорт: .glb (геометрия + planar UV для последующей покраски) и рядом —
печатный лист раскраски (.svg) с 4 угловыми метками, сгенерированный тем же
способом, что и assets model-to-sheet.js в самом проекте (silhouette/crease
edges через face_adjacency, тот же 35° порог для складок).
"""
import numpy as np
import trimesh
import json


# ============================================================
# 1. Построение тела рыбы (поверхность вращения) + плавников
# ============================================================

def _profile_radius(t, peak=0.42, peak_pos=0.58, nose_r=0.10, tail_r=0.02):
    """Радиус тела в точке t∈[0,1] вдоль оси (0=хвост, 1=голова).
    Кусочно-линейная интерполяция по опорным точкам, сглаженная — так
    надёжнее держать форму «рыбы», чем степенными кривыми: без резкого
    перехода «бутылочное горлышко → раструб» возле носа."""
    t = np.asarray(t, dtype=float)
    key_t = np.array([0.0, 0.10, peak_pos, min(0.97, peak_pos + 0.30), 1.0])
    key_r = np.array([tail_r, peak * 0.55, peak, peak * 0.50, nose_r])
    return np.interp(t, key_t, key_r)



def _lathe_body(length=1.0, radial_segments=14, length_segments=22,
                width_squash=0.55, height_squash=1.25, **profile_kwargs):
    """Тело вращения: кольца вершин вдоль Z, сплюснутые по X (ширина рыбы)
    относительно Y (высота рыбы) — типичная боковая компрессия у рыб."""
    ts = np.linspace(0.0, 1.0, length_segments)
    thetas = np.linspace(0, 2 * np.pi, radial_segments, endpoint=False)

    verts = []
    for t in ts:
        r = _profile_radius(t, **profile_kwargs)
        z = (t - 0.0) * length  # 0=хвост, length=голова
        for th in thetas:
            x = np.cos(th) * r * width_squash
            y = np.sin(th) * r * height_squash + 0.08 * r  # чуть приподнимаем "спину"
            verts.append((x, y, z))
    verts = np.array(verts)

    faces = []
    n = radial_segments
    for i in range(length_segments - 1):
        for j in range(n):
            a = i * n + j
            b = i * n + (j + 1) % n
            c = (i + 1) * n + (j + 1) % n
            d = (i + 1) * n + j
            faces.append((a, b, c))
            faces.append((a, c, d))

    # затычки на носу и хвосте (веером к центральной точке), чтобы меш был замкнут
    tail_center = len(verts)
    verts = np.vstack([verts, [[0, 0.02, 0.0]]])
    for j in range(n):
        a = 0 * n + j
        b = 0 * n + (j + 1) % n
        faces.append((tail_center, b, a))

    nose_center = len(verts)
    verts = np.vstack([verts, [[0, 0.02, length]]])
    last = (length_segments - 1) * n
    for j in range(n):
        a = last + j
        b = last + (j + 1) % n
        faces.append((nose_center, a, b))

    return trimesh.Trimesh(vertices=verts, faces=np.array(faces), process=True)


def _fin_mesh(tri_or_poly_zy_or_zx, orient, thickness=0.006, normal_offset=0.0):
    """Тонкий плавник из плоского контура.
    orient='zy': точки (z, y) — вертикальный плавник (хвостовой/спинной),
                  тонкая ось — X.
    orient='zx': точки (z, x) — боковой плавник (грудной), тонкая ось — Y."""
    pts = np.array(tri_or_poly_zy_or_zx)
    n = len(pts)
    if orient == 'zy':
        thin_axis = np.array([1, 0, 0])
        top = np.column_stack([np.full(n, thickness + normal_offset), pts[:, 1], pts[:, 0]])
        bot = np.column_stack([np.full(n, -thickness + normal_offset), pts[:, 1], pts[:, 0]])
    else:  # 'zx'
        top = np.column_stack([pts[:, 1], np.full(n, thickness + normal_offset), pts[:, 0]])
        bot = np.column_stack([pts[:, 1], np.full(n, -thickness + normal_offset), pts[:, 0]])
    verts = np.vstack([top, bot])

    faces = []
    for i in range(1, n - 1):
        faces.append((0, i, i + 1))
        faces.append((n, n + i + 1, n + i))
    for i in range(n):
        j = (i + 1) % n
        faces.append((i, j, n + j))
        faces.append((i, n + j, n + i))
    return trimesh.Trimesh(vertices=verts, faces=np.array(faces), process=True)


def _tail_fin(length, span=0.30, sweep=0.24, y_center=0.03):
    """Вертикальный веерный хвост позади тела (z<0), симметричный
    относительно y_center (лёгкое смещение тела вверх, см. _lathe_body)."""
    pts = [
        (0.0, y_center),
        (-sweep, y_center + span),
        (-sweep * 0.45, y_center + span * 0.32),
        (-sweep * 0.62, y_center),
        (-sweep * 0.45, y_center - span * 0.32),
        (-sweep, y_center - span),
    ]
    return _fin_mesh(pts, 'zy')


def _dorsal_fin(length, base_start=0.40, base_end=0.66, height=0.22, y_base=0.16):
    z0, z1 = base_start * length, base_end * length
    zm = (z0 + z1) / 2
    pts = [(z0, y_base * 0.75), (zm, y_base + height), (z1, y_base * 0.75)]
    return _fin_mesh(pts, 'zy', normal_offset=0.0)


def _pectoral_fin(length, at=0.60, x_base=0.14, x_out=0.30, side=1):
    z0 = at * length
    pts = [
        (z0 + 0.07, x_base * side),
        (z0 - 0.05, x_out * side),
        (z0 - 0.16, x_base * 0.6 * side),
    ]
    return _fin_mesh(pts, 'zx')


def build_fish(length=1.0, palette=None, debug_colors=False, **body_kwargs):
    body = _lathe_body(length=length, **body_kwargs)

    # База спинного/грудных плавников должна начинаться СНАРУЖИ тела, а не
    # внутри него — берём фактический радиус профиля в нужной точке, а не
    # произвольную константу (иначе плавник наполовину тонет в корпусе).
    bk = {k: v for k, v in body_kwargs.items() if k in
          ('peak', 'peak_pos', 'nose_r', 'tail_r')}
    hs = body_kwargs.get('height_squash', 1.25)
    ws = body_kwargs.get('width_squash', 0.55)

    dorsal_t = np.linspace(0.38, 0.68, 12)
    dorsal_r = _profile_radius(dorsal_t, **bk) * hs
    tail = _tail_fin(length, y_center=0.02 * _profile_radius(np.array([0.0]), **bk)[0])
    dorsal = _dorsal_fin(length, y_base=float(dorsal_r.max()) * 0.92)

    pec_t = 0.58
    pec_r = float(_profile_radius(np.array([pec_t]), **bk)[0]) * ws
    pec_l = _pectoral_fin(length, at=pec_t, x_base=pec_r * 0.9, x_out=pec_r + 0.16, side=1)
    pec_r_fin = _pectoral_fin(length, at=pec_t, x_base=pec_r * 0.9, x_out=pec_r + 0.16, side=-1)

    parts = {'body': body, 'tail': tail, 'dorsal': dorsal, 'pecL': pec_l, 'pecR': pec_r_fin}

    if debug_colors:
        diag_colors = {'body': '#e8a33c', 'tail': '#cc3333', 'dorsal': '#33aa55',
                        'pecL': '#3355cc', 'pecR': '#9933cc'}
        for name, mesh in parts.items():
            mesh.visual.face_colors = np.tile(
                np.array([*_hex_to_rgb(diag_colors[name]), 255], dtype=np.uint8), (len(mesh.faces), 1)
            )

    fish = trimesh.util.concatenate(list(parts.values()))
    fish.update_faces(fish.nondegenerate_faces())
    fish.remove_unreferenced_vertices()
    return fish


def _hex_to_rgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))


# ============================================================
# 2. Планарная UV-развёртка для будущей покраски (см. model-to-sheet.js)
# ============================================================

def bake_planar_uv(mesh, view_axis=0):
    """view_axis: индекс "тонкой" оси (0=X у наших рыб — сплюснуты по бокам).
    UV = (Z, Y) нормализованные в [0,1], с отражением по U для вершин на
    дальней от условной камеры стороне — та же логика, что в
    model-to-sheet.js buildPlanarUVProjection, чтобы боковая раскраска не
    расползалась зеркально по двум бокам модели."""
    pos = mesh.vertices
    axes = [i for i in range(3) if i != view_axis]  # обычно [1,2] = (Y,Z)
    u_raw = pos[:, 2]  # Z — вдоль тела
    v_raw = pos[:, 1]  # Y — высота
    u = (u_raw - u_raw.min()) / max(1e-6, (u_raw.max() - u_raw.min()))
    v = (v_raw - v_raw.min()) / max(1e-6, (v_raw.max() - v_raw.min()))

    normals = mesh.vertex_normals
    far_side = normals[:, view_axis] > 0
    u = np.where(far_side, 1 - u, u)

    uv = np.column_stack([u, v])
    mesh.visual = trimesh.visual.TextureVisuals(uv=uv)
    return uv


# ============================================================
# 3. Извлечение силуэта/складок и сборка SVG-листа (Sheet Composer)
# ============================================================

def extract_edges(mesh, view_dir=(1, 0, 0), crease_deg=35.0):
    fn = mesh.face_normals
    pairs = mesh.face_adjacency
    d = fn[pairs[:, 0]] @ view_dir, fn[pairs[:, 1]] @ view_dir
    sign0, sign1 = np.sign(d[0]), np.sign(d[1])
    silhouette_mask = sign0 != sign1

    angles_deg = np.degrees(mesh.face_adjacency_angles)
    crease_mask = angles_deg > crease_deg

    edges = mesh.face_adjacency_edges
    v = mesh.vertices
    silhouette = [(v[a], v[b]) for a, b in edges[silhouette_mask]]
    creases = [(v[a], v[b]) for a, b in edges[crease_mask & ~silhouette_mask]]
    return silhouette, creases


def _marker_svg(marker_id, x, y, size):
    bits = []
    for row in range(4):
        row_bits = []
        parity = 0
        for col in range(4):
            bit = (marker_id >> (row * 4 + col)) & 1
            row_bits.append(bit)
            parity ^= bit
        row_bits.append(parity)
        bits.append(row_bits)

    cell = size / 7
    s = f'<rect x="{x}" y="{y}" width="{size}" height="{size}" fill="black"/>'
    s += f'<rect x="{x+cell}" y="{y+cell}" width="{size-2*cell}" height="{size-2*cell}" fill="white"/>'
    for row in range(4):
        for col in range(5):
            if bits[row][col]:
                cx, cy = x + cell * 2 + col * cell, y + cell * 2 + row * cell
                s += f'<rect x="{cx}" y="{cy}" width="{cell}" height="{cell}" fill="black"/>'
    return s


def compose_sheet(mesh, species_id, species_name, view_dir=(1, 0, 0), crease_deg=35.0,
                   page_mm=(210, 297), margin_mm=15, marker_mm=18, mm_to_px=96 / 25.4):
    silhouette, creases = extract_edges(mesh, view_dir, crease_deg)
    # правая/верхняя оси проекции = Z, Y (соответствует bake_planar_uv)
    def proj(p):
        return p[2], p[1]

    pts = [proj(p) for e in silhouette for p in e]
    xs, ys = [p[0] for p in pts], [p[1] for p in pts]
    minx, maxx, miny, maxy = min(xs), max(xs), min(ys), max(ys)
    cw, ch = maxx - minx, maxy - miny

    page_w, page_h = page_mm[0] * mm_to_px, page_mm[1] * mm_to_px
    margin, marker = margin_mm * mm_to_px, marker_mm * mm_to_px
    avail_w = page_w - 2 * margin - 2 * marker
    avail_h = page_h - 2 * margin - 2 * marker
    scale = min(avail_w / cw, avail_h / ch) * 0.9
    off_x = margin + marker + (avail_w - cw * scale) / 2 - minx * scale
    off_y = margin + marker + (avail_h - ch * scale) / 2 - miny * scale

    def sx(x): return f'{x*scale+off_x:.2f}'
    def sy(y): return f'{(maxy-y)*scale+off_y:.2f}'

    solid = ''.join(
        f'<line x1="{sx(proj(a)[0])}" y1="{sy(proj(a)[1])}" x2="{sx(proj(b)[0])}" y2="{sy(proj(b)[1])}" '
        f'stroke="black" stroke-width="3" stroke-linecap="round"/>\n'
        for a, b in silhouette
    )
    dashed = ''.join(
        f'<line x1="{sx(proj(a)[0])}" y1="{sy(proj(a)[1])}" x2="{sx(proj(b)[0])}" y2="{sy(proj(b)[1])}" '
        f'stroke="#333" stroke-width="1" stroke-dasharray="4 3"/>\n'
        for a, b in creases
    )

    markers = (
        _marker_svg(species_id * 4 + 0, margin, margin, marker) +
        _marker_svg(species_id * 4 + 1, page_w - margin - marker, margin, marker) +
        _marker_svg(species_id * 4 + 2, margin, page_h - margin - marker, marker) +
        _marker_svg(species_id * 4 + 3, page_w - margin - marker, page_h - margin - marker, marker)
    )

    svg = f'''<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="{page_w}" height="{page_h}" viewBox="0 0 {page_w} {page_h}">
  <rect width="{page_w}" height="{page_h}" fill="white"/>
  {markers}
  <g>{dashed}{solid}</g>
  <text x="{page_w/2}" y="{margin-8}" text-anchor="middle" font-family="sans-serif" font-size="18">{species_name}</text>
  <text x="{page_w/2}" y="{page_h-8}" text-anchor="middle" font-family="sans-serif" font-size="8" fill="#888">Tank Species ID: {species_id}</text>
</svg>'''
    return svg


# ============================================================
# 4. Сшивание силуэтных рёбер в один замкнутый контур (как в
#    /tools/silhouettes.html реального проекта) — для интеграции через
#    их родной tools/make-coloring.js вместо повторного изобретения
#    формата листа/меток с нуля.
# ============================================================

def silhouette_polygon(mesh, view_dir=(1, 0, 0), round_decimals=5):
    """Возвращает список [(z,y), ...] — один замкнутый контур (самый длинный
    связный цикл среди силуэтных рёбер), в порядке обхода."""
    fn = mesh.face_normals
    pairs = mesh.face_adjacency
    d0 = fn[pairs[:, 0]] @ np.array(view_dir)
    d1 = fn[pairs[:, 1]] @ np.array(view_dir)
    silhouette_mask = np.sign(d0) != np.sign(d1)

    edges = mesh.face_adjacency_edges[silhouette_mask]
    v = mesh.vertices

    def key(p):
        return (round(float(p[2]), round_decimals), round(float(p[1]), round_decimals))

    adj = {}
    for a, b in edges:
        ka, kb = key(v[a]), key(v[b])
        if ka == kb:
            continue
        adj.setdefault(ka, set()).add(kb)
        adj.setdefault(kb, set()).add(ka)

    visited = set()
    loops = []
    for start in list(adj.keys()):
        if start in visited:
            continue
        loop = [start]
        visited.add(start)
        cur = start
        prev = None
        while True:
            nexts = [n for n in adj.get(cur, ()) if n != prev]
            nexts = [n for n in nexts if n not in visited] or \
                     [n for n in adj.get(cur, ()) if n != prev]
            if not nexts:
                break
            nxt = nexts[0]
            if nxt == start:
                break
            loop.append(nxt)
            visited.add(nxt)
            prev, cur = cur, nxt
        loops.append(loop)

    loops.sort(key=len, reverse=True)
    best = loops[0]
    return [(p[0], p[1]) for p in best]


def normalize_contour(points):
    """z,y → тот же формат, что contours.json реального проекта: делим ОБЕ
    оси на протяжённость по Z (не искажая пропорции), центрируем так, чтобы
    z ∈ [-0.5, 0.5]. Возвращает (contour, bbox)."""
    zs = np.array([p[0] for p in points])
    ys = np.array([p[1] for p in points])
    zspan = zs.max() - zs.min()
    zc = (zs.max() + zs.min()) / 2
    z_n = (zs - zc) / zspan
    y_n = (ys - ys.min()) / zspan  # тот же масштаб, что и Z — пропорции целые
    y_n = y_n - (y_n.max() + y_n.min()) / 2  # центрируем по высоте тоже

    contour = [[round(float(a), 4), round(float(b), 4)] for a, b in zip(z_n, y_n)]
    bbox = {'z': [round(float(z_n.min()), 4), round(float(z_n.max()), 4)],
            'y': [round(float(y_n.min()), 4), round(float(y_n.max()), 4)]}
    return contour, bbox


# ============================================================
# 5. Более надёжное извлечение силуэта для составных мешей (тело + отдельно
#    смоделированные плавники как несвязные компоненты, реальные ассеты
#    Quaternius) — силуэт по бакетам вдоль оси тела вместо обхода графа
#    рёбер (тот подход ломается на разветвлённой топологии/несвязных
#    кусках). Для типично «звёздных» вдоль своей длины существ (рыба,
#    акула, дельфин, кит, скат) даёт чистый, простой (без самопересечений)
#    контур почти всегда.
# ============================================================

def silhouette_by_slices(mesh, u_axis=2, v_axis=1, bins=48, smooth=1):
    """u_axis/v_axis — индексы координат (0=X,1=Y,2=Z) для горизонтали и
    вертикали контура. Возвращает список [(u,v), ...] — один замкнутый
    контур (верхняя граница слева направо, затем нижняя справа налево)."""
    pts = mesh.vertices
    u = pts[:, u_axis]
    v = pts[:, v_axis]
    umin, umax = u.min(), u.max()
    edges = np.linspace(umin, umax, bins + 1)
    centers = (edges[:-1] + edges[1:]) / 2

    top, bot = [], []
    for i in range(bins):
        m = (u >= edges[i]) & (u < edges[i + 1] if i < bins - 1 else u <= edges[i + 1])
        if not np.any(m):
            continue
        top.append((centers[i], v[m].max()))
        bot.append((centers[i], v[m].min()))

    if smooth > 0:
        def sm(seq):
            arr = np.array(seq)
            k = smooth
            out = arr.copy()
            for i in range(len(arr)):
                lo, hi = max(0, i - k), min(len(arr), i + k + 1)
                out[i, 1] = arr[lo:hi, 1].mean()
            return [tuple(p) for p in out]
        top, bot = sm(top), sm(bot)

    # нос/хвост — реальная крайняя точка по u, не центр первого/последнего бина
    tip_a = (float(u.min()), float(v[u.argmin()]))
    tip_b = (float(u.max()), float(v[u.argmax()]))
    return [tip_a] + top + [tip_b] + list(reversed(bot))


# ============================================================
# 6. Растровое извлечение силуэта (заливка треугольников + marching squares)
#    — правильная замена silhouette_by_slices для составных мешей с
#    отдельными кусками (плавники не сварены с телом). Бакеты по min/max
#    давали «двойную рваную линию»: у тонких плавников, которые входят и
#    выходят из соседних Z-бинов независимо, верхняя и нижняя граница
#    дёргаются порознь. Растеризация треугольников — тот же приём, что и
#    в tools/make-coloring.js для зоны плавников (тот их FIN-алгоритм),
#    только здесь используется для всего силуэта целиком.
# ============================================================

def silhouette_raster(mesh, u_axis=2, v_axis=1, resolution=400, simplify_tol=0.004):
    """u_axis/v_axis: 0=X,1=Y,2=Z. Возвращает список [(u,v), ...] — один
    замкнутый, чистый (без самопересечений) контур в исходных единицах меша."""
    from skimage.measure import find_contours, approximate_polygon
    from skimage.draw import polygon as sk_polygon

    pts = mesh.vertices
    u = pts[:, u_axis]
    v = pts[:, v_axis]
    umin, umax = u.min(), u.max()
    vmin, vmax = v.min(), v.max()
    uspan, vspan = umax - umin, vmax - vmin
    pad = 0.04 * max(uspan, vspan)

    W = resolution
    H = max(8, int(resolution * (vspan + 2 * pad) / (uspan + 2 * pad)))

    def to_px(uu, vv):
        px = (uu - (umin - pad)) / (uspan + 2 * pad) * W
        py = (vv - (vmin - pad)) / (vspan + 2 * pad) * H
        return px, py

    mask = np.zeros((H, W), dtype=np.uint8)
    tri_u = u[mesh.faces]   # (F,3)
    tri_v = v[mesh.faces]
    for i in range(len(mesh.faces)):
        px, py = to_px(tri_u[i], tri_v[i])
        rr, cc = sk_polygon(py, px, shape=(H, W))
        mask[rr, cc] = 1

    contours = find_contours(mask.astype(float), 0.5)
    if not contours:
        raise ValueError('silhouette_raster: пустая маска — модель не спроецировалась')
    best = max(contours, key=len)   # самый длинный контур = внешняя граница
    simplified = approximate_polygon(best, tolerance=simplify_tol * max(W, H))

    out = []
    for row, col in simplified:
        uu = (col / W) * (uspan + 2 * pad) + (umin - pad)
        vv = (row / H) * (vspan + 2 * pad) + (vmin - pad)
        out.append((float(uu), float(vv)))
    if out[0] == out[-1]:
        out = out[:-1]
    return out
