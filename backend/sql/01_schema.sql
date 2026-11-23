CREATE TABLE roles (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(30) NOT NULL UNIQUE
);

CREATE TABLE usuarios (
    id SERIAL PRIMARY KEY,
    rol_id INTEGER NOT NULL,
    correo VARCHAR(254) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (rol_id) REFERENCES roles (id)
);

CREATE TABLE carreras (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(120) NOT NULL UNIQUE
);

CREATE TABLE estados_academicos (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL UNIQUE,
    pide_ciclo BOOLEAN NOT NULL
);

CREATE TABLE sectores (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE modalidades (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(30) NOT NULL UNIQUE
);

CREATE TABLE tipos_vacante (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(60) NOT NULL UNIQUE
);

CREATE TABLE estados_vacante (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(30) NOT NULL UNIQUE
);

CREATE TABLE estados_postulacion (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(30) NOT NULL UNIQUE,
    orden SMALLINT NOT NULL UNIQUE,
    CONSTRAINT estados_postulacion_orden_chk CHECK (orden > 0)
);

CREATE TABLE categorias_habilidad (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE habilidades (
    id SERIAL PRIMARY KEY,
    categoria_id INTEGER NOT NULL,
    nombre VARCHAR(100) NOT NULL UNIQUE,
    FOREIGN KEY (categoria_id) REFERENCES categorias_habilidad (id)
);

CREATE TABLE niveles (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(30) NOT NULL UNIQUE,
    peso SMALLINT NOT NULL UNIQUE,
    CONSTRAINT niveles_peso_chk CHECK (peso > 0)
);

CREATE TABLE estudiantes (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER NOT NULL UNIQUE,
    dni CHAR(8) NOT NULL UNIQUE,
    nombres VARCHAR(120) NOT NULL,
    apellido_pat VARCHAR(80) NOT NULL,
    apellido_mat VARCHAR(80),
    dni_validado BOOLEAN NOT NULL DEFAULT FALSE,
    telefono VARCHAR(25),
    carrera_id INTEGER NOT NULL,
    estado_academico_id INTEGER NOT NULL,
    ciclo SMALLINT,
    anio_egreso SMALLINT,
    bio TEXT,
    github_url TEXT,
    linkedin_url TEXT,
    CONSTRAINT estudiantes_dni_chk CHECK (LENGTH(dni) = 8 AND TRANSLATE(dni, '0123456789', '') = ''),
    CONSTRAINT estudiantes_ciclo_chk CHECK (ciclo >= 1 AND ciclo <= 12),
    CONSTRAINT estudiantes_anio_chk CHECK (anio_egreso >= 1900 AND anio_egreso <= 9999),
    FOREIGN KEY (usuario_id) REFERENCES usuarios (id),
    FOREIGN KEY (carrera_id) REFERENCES carreras (id),
    FOREIGN KEY (estado_academico_id) REFERENCES estados_academicos (id)
);

CREATE TABLE empresas (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER NOT NULL UNIQUE,
    ruc CHAR(11) NOT NULL UNIQUE,
    razon_social VARCHAR(160) NOT NULL,
    nombre_comercial VARCHAR(160),
    direccion TEXT,
    estado_sunat VARCHAR(40),
    ruc_validado BOOLEAN NOT NULL DEFAULT FALSE,
    sector_id INTEGER NOT NULL,
    telefono VARCHAR(25),
    web TEXT,
    descripcion TEXT,
    CONSTRAINT empresas_ruc_chk CHECK (LENGTH(ruc) = 11 AND TRANSLATE(ruc, '0123456789', '') = ''),
    FOREIGN KEY (usuario_id) REFERENCES usuarios (id),
    FOREIGN KEY (sector_id) REFERENCES sectores (id)
);

CREATE TABLE proyectos (
    id SERIAL PRIMARY KEY,
    estudiante_id INTEGER NOT NULL,
    titulo VARCHAR(160) NOT NULL,
    descripcion TEXT NOT NULL,
    curso VARCHAR(120),
    repo_url TEXT,
    demo_url TEXT,
    imagen_url TEXT,
    fecha DATE NOT NULL,
    visible BOOLEAN NOT NULL DEFAULT TRUE,
    FOREIGN KEY (estudiante_id) REFERENCES estudiantes (id)
);

CREATE TABLE vacantes (
    id SERIAL PRIMARY KEY,
    empresa_id INTEGER NOT NULL,
    tipo_id INTEGER NOT NULL,
    modalidad_id INTEGER NOT NULL,
    estado_id INTEGER NOT NULL,
    carrera_id INTEGER,
    titulo VARCHAR(160) NOT NULL,
    descripcion TEXT NOT NULL,
    ubicacion VARCHAR(160),
    sueldo NUMERIC(10,2),
    cupos SMALLINT NOT NULL,
    fecha_cierre DATE NOT NULL,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT vacantes_sueldo_chk CHECK (sueldo >= 0 AND sueldo <> 'NaN'),
    CONSTRAINT vacantes_cupos_chk CHECK (cupos >= 0),
    FOREIGN KEY (empresa_id) REFERENCES empresas (id),
    FOREIGN KEY (tipo_id) REFERENCES tipos_vacante (id),
    FOREIGN KEY (modalidad_id) REFERENCES modalidades (id),
    FOREIGN KEY (estado_id) REFERENCES estados_vacante (id),
    FOREIGN KEY (carrera_id) REFERENCES carreras (id)
);

CREATE TABLE estudiante_habilidad (
    estudiante_id INTEGER NOT NULL,
    habilidad_id INTEGER NOT NULL,
    nivel_id INTEGER NOT NULL,
    PRIMARY KEY (estudiante_id, habilidad_id),
    FOREIGN KEY (estudiante_id) REFERENCES estudiantes (id) ON DELETE CASCADE,
    FOREIGN KEY (habilidad_id) REFERENCES habilidades (id),
    FOREIGN KEY (nivel_id) REFERENCES niveles (id)
);

CREATE TABLE proyecto_habilidad (
    proyecto_id INTEGER NOT NULL,
    habilidad_id INTEGER NOT NULL,
    PRIMARY KEY (proyecto_id, habilidad_id),
    FOREIGN KEY (proyecto_id) REFERENCES proyectos (id) ON DELETE CASCADE,
    FOREIGN KEY (habilidad_id) REFERENCES habilidades (id)
);

CREATE TABLE vacante_habilidad (
    vacante_id INTEGER NOT NULL,
    habilidad_id INTEGER NOT NULL,
    nivel_min_id INTEGER NOT NULL,
    obligatoria BOOLEAN NOT NULL DEFAULT TRUE,
    PRIMARY KEY (vacante_id, habilidad_id),
    FOREIGN KEY (vacante_id) REFERENCES vacantes (id) ON DELETE CASCADE,
    FOREIGN KEY (habilidad_id) REFERENCES habilidades (id),
    FOREIGN KEY (nivel_min_id) REFERENCES niveles (id)
);

CREATE TABLE postulaciones (
    id SERIAL PRIMARY KEY,
    vacante_id INTEGER NOT NULL,
    estudiante_id INTEGER NOT NULL,
    estado_id INTEGER NOT NULL,
    proyecto_id INTEGER,
    mensaje TEXT,
    match_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT postulaciones_match_chk CHECK (match_pct >= 0 AND match_pct <= 100),
    UNIQUE (vacante_id, estudiante_id),
    FOREIGN KEY (vacante_id) REFERENCES vacantes (id),
    FOREIGN KEY (estudiante_id) REFERENCES estudiantes (id),
    FOREIGN KEY (estado_id) REFERENCES estados_postulacion (id),
    FOREIGN KEY (proyecto_id) REFERENCES proyectos (id) ON DELETE SET NULL
);

CREATE TABLE historial_postulacion (
    id SERIAL PRIMARY KEY,
    postulacion_id INTEGER NOT NULL,
    estado_anterior_id INTEGER,
    estado_nuevo_id INTEGER NOT NULL,
    usuario_id INTEGER NOT NULL,
    nota TEXT,
    fecha TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT historial_cambio_chk CHECK (estado_anterior_id <> estado_nuevo_id),
    FOREIGN KEY (postulacion_id) REFERENCES postulaciones (id),
    FOREIGN KEY (estado_anterior_id) REFERENCES estados_postulacion (id),
    FOREIGN KEY (estado_nuevo_id) REFERENCES estados_postulacion (id),
    FOREIGN KEY (usuario_id) REFERENCES usuarios (id)
);
