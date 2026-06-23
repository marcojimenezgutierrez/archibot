Ariel — Artículo Entregable 3 (PF-3311)
========================================

Carpeta autocontenida para compilar el artículo en LaTeX (formato IEEE, 4 págs).

Contenido:
  - main.tex        Artículo completo (inglés, IEEE conference, bibliografía
                    embebida y figura de arquitectura en TikZ). Es el documento
                    principal.
  - IEEEtran.cls    Clase de documento IEEE requerida.

Cómo compilar
-------------
Local:
    pdflatex main.tex
    pdflatex main.tex      (segunda pasada para refs/figuras)

Overleaf:
    Subir esta carpeta (main.tex + IEEEtran.cls), compilar con pdfLaTeX.
    main.tex ya es el documento principal por defecto.

No requiere archivos .bib ni imágenes externas: todo está embebido.
