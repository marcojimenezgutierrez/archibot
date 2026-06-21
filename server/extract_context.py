"""
Extrae el texto de los reglamentos del expediente (con número de página) a un JSON
que el servidor usa como contexto para el LLM (Azure OpenAI). Ejecutar una sola vez
(o al cambiar los PDFs):  python server/extract_context.py
"""
import pdfplumber, json, os

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # raíz del repo
DOCS = {
    'horas':   ('demo/pdfs/horas_estudiante_asistente_posgrado.pdf',
                'Reglamento de Horas Estudiante, Asistente y Asistente de Posgrado'),
    'regimen': ('demo/pdfs/regimen_academico_estudiantil.pdf',
                'Reglamento de Régimen Académico Estudiantil'),
    'tcu':     ('demo/pdfs/trabajo_comunal.pdf',
                'Reglamento del Trabajo Comunal Universitario'),
}

out = {}
for did, (rel, title) in DOCS.items():
    path = os.path.join(BASE, rel)
    pages = []
    with pdfplumber.open(path) as pdf:
        for p in pdf.pages:
            pages.append((p.extract_text() or '').strip())
    out[did] = {'documentId': did, 'title': title, 'pages': pages}
    print(f'{did}: {len(pages)} páginas, {sum(len(x) for x in pages)} caracteres')

dest = os.path.join(BASE, 'server', 'context', 'regulations.json')
os.makedirs(os.path.dirname(dest), exist_ok=True)
with open(dest, 'w', encoding='utf-8') as f:
    json.dump(out, f, ensure_ascii=False)
print('Escrito:', dest)
