BEGIN;

INSERT INTO public.roles (nombre) VALUES
    ('ESTUDIANTE'),
    ('EMPRESA'),
    ('ADMIN')
ON CONFLICT (nombre) DO NOTHING;

INSERT INTO public.carreras (nombre) VALUES
    ('Administración'),
    ('Arquitectura'),
    ('Ciencias de la Comunicación'),
    ('Contabilidad'),
    ('Diseño Gráfico'),
    ('Economía'),
    ('Estadística'),
    ('Ingeniería Ambiental'),
    ('Ingeniería Civil'),
    ('Ingeniería de Sistemas e Informática'),
    ('Ingeniería de Software'),
    ('Ingeniería Eléctrica'),
    ('Ingeniería Industrial'),
    ('Ingeniería Mecatrónica'),
    ('Marketing'),
    ('Negocios Internacionales'),
    ('Psicología'),
    ('Trabajo Social')
ON CONFLICT (nombre) DO NOTHING;

INSERT INTO public.estados_academicos (nombre, pide_ciclo) VALUES
    ('Estudiante en curso', TRUE),
    ('Egresado', FALSE),
    ('Bachiller', FALSE),
    ('Titulado', FALSE),
    ('En pausa', FALSE)
ON CONFLICT (nombre) DO NOTHING;

INSERT INTO public.sectores (nombre) VALUES
    ('Agroindustria'),
    ('Banca y seguros'),
    ('Comercio y retail'),
    ('Construcción e infraestructura'),
    ('Consultoría y servicios profesionales'),
    ('Educación'),
    ('Energía y servicios públicos'),
    ('Industria manufacturera'),
    ('Logística y transporte'),
    ('Minería'),
    ('Organizaciones sin fines de lucro'),
    ('Salud'),
    ('Tecnología y software'),
    ('Telecomunicaciones'),
    ('Turismo y hotelería')
ON CONFLICT (nombre) DO NOTHING;

INSERT INTO public.modalidades (nombre) VALUES
    ('Presencial'),
    ('Híbrido'),
    ('Remoto')
ON CONFLICT (nombre) DO NOTHING;

INSERT INTO public.tipos_vacante (nombre) VALUES
    ('Prácticas Preprofesionales'),
    ('Prácticas Profesionales'),
    ('Primer Empleo Junior')
ON CONFLICT (nombre) DO NOTHING;

INSERT INTO public.estados_vacante (nombre) VALUES
    ('Abierta'),
    ('En evaluación'),
    ('Cerrada'),
    ('Cancelada')
ON CONFLICT (nombre) DO NOTHING;

INSERT INTO public.estados_postulacion (nombre, orden) VALUES
    ('Pendiente', 1),
    ('En revisión', 2),
    ('Entrevista', 3),
    ('Aceptada', 4),
    ('Rechazada', 5),
    ('Retirada', 6)
ON CONFLICT (nombre) DO NOTHING;

INSERT INTO public.categorias_habilidad (nombre) VALUES
    ('Desarrollo de software'),
    ('Datos y analítica'),
    ('Diseño y comunicación'),
    ('Gestión y operaciones'),
    ('Contabilidad y finanzas'),
    ('Ingeniería y construcción'),
    ('Habilidades interpersonales'),
    ('Idiomas')
ON CONFLICT (nombre) DO NOTHING;

INSERT INTO public.habilidades (categoria_id, nombre)
SELECT c.id, h.nombre
FROM (VALUES
    ('Desarrollo de software', 'Java'),
    ('Desarrollo de software', 'JavaScript'),
    ('Desarrollo de software', 'Git'),
    ('Desarrollo de software', 'Pruebas de software'),
    ('Datos y analítica', 'SQL'),
    ('Datos y analítica', 'PostgreSQL'),
    ('Datos y analítica', 'Python'),
    ('Datos y analítica', 'Microsoft Excel'),
    ('Datos y analítica', 'Power BI'),
    ('Diseño y comunicación', 'Figma'),
    ('Diseño y comunicación', 'Investigación de usuarios'),
    ('Diseño y comunicación', 'Redacción digital'),
    ('Gestión y operaciones', 'Gestión de inventarios'),
    ('Gestión y operaciones', 'Modelado de procesos'),
    ('Gestión y operaciones', 'Scrum'),
    ('Contabilidad y finanzas', 'Conciliación bancaria'),
    ('Contabilidad y finanzas', 'Análisis financiero'),
    ('Contabilidad y finanzas', 'Facturación electrónica SUNAT'),
    ('Ingeniería y construcción', 'AutoCAD'),
    ('Ingeniería y construcción', 'Modelado BIM'),
    ('Ingeniería y construcción', 'Seguridad y salud en el trabajo'),
    ('Habilidades interpersonales', 'Comunicación oral'),
    ('Habilidades interpersonales', 'Trabajo en equipo'),
    ('Habilidades interpersonales', 'Resolución de problemas'),
    ('Idiomas', 'Inglés'),
    ('Idiomas', 'Quechua')
) AS h(categoria, nombre)
JOIN public.categorias_habilidad AS c ON c.nombre = h.categoria
ON CONFLICT (nombre) DO NOTHING;

INSERT INTO public.niveles (nombre, peso) VALUES
    ('Básico', 1),
    ('Intermedio', 2),
    ('Avanzado', 3)
ON CONFLICT (nombre) DO NOTHING;

COMMIT;
