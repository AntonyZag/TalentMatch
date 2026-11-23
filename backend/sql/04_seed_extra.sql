BEGIN;

INSERT INTO public.carreras (nombre)
VALUES ('Derecho')
ON CONFLICT DO NOTHING;

-- Categorías 1, 2 y 5 según el orden de 03_seed.sql.
-- Resolver por nombre conserva la relación si las secuencias tienen otros IDs.
INSERT INTO public.habilidades (categoria_id, nombre)
SELECT c.id, h.nombre
FROM (VALUES
    ('Desarrollo de software', 'Angular'),
    ('Datos y analítica', 'Uso de IA Generativa'),
    ('Contabilidad y finanzas', 'Redacción jurídica'),
    ('Contabilidad y finanzas', 'Análisis normativo'),
    ('Contabilidad y finanzas', 'Gestión de expedientes')
) AS h(categoria, nombre)
JOIN public.categorias_habilidad AS c ON c.nombre = h.categoria
ON CONFLICT DO NOTHING;

COMMIT;
