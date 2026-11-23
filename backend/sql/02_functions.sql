BEGIN;

-- Match de 0 a 100. Cada requisito pesa según el nivel mínimo solicitado.
-- Un requisito obligatorio pesa el doble y se admite crédito parcial por nivel.
-- Una vacante sin requisitos de habilidad tiene un match de 100.
CREATE OR REPLACE FUNCTION public.fn_calcular_match(
    p_estudiante_id INTEGER,
    p_vacante_id INTEGER
)
RETURNS NUMERIC(5,2)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog
AS $$
DECLARE
    v_match NUMERIC(5,2);
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.estudiantes WHERE id = p_estudiante_id) THEN
        RAISE EXCEPTION 'Estudiante % inexistente', p_estudiante_id USING ERRCODE = '22023';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.vacantes WHERE id = p_vacante_id) THEN
        RAISE EXCEPTION 'Vacante % inexistente', p_vacante_id USING ERRCODE = '22023';
    END IF;

    SELECT COALESCE(
        ROUND(100.0 * SUM(LEAST(COALESCE(actual.peso, 0), minimo.peso) * requisito.factor)
                    / NULLIF(SUM(minimo.peso * requisito.factor), 0), 2),
        100.00
    )
    INTO v_match
    FROM (
        SELECT habilidad_id, nivel_min_id,
               CASE WHEN obligatoria THEN 2 ELSE 1 END AS factor
        FROM public.vacante_habilidad
        WHERE vacante_id = p_vacante_id
    ) AS requisito
    JOIN public.niveles AS minimo ON minimo.id = requisito.nivel_min_id
    LEFT JOIN public.estudiante_habilidad AS eh
        ON eh.estudiante_id = p_estudiante_id AND eh.habilidad_id = requisito.habilidad_id
    LEFT JOIN public.niveles AS actual ON actual.id = eh.nivel_id;

    RETURN v_match;
END;
$$;

-- El plazo de postulación incluye la fecha de cierre en la zona de Perú.
-- El proyecto opcional debe pertenecer al estudiante que postula.
CREATE OR REPLACE FUNCTION public.fn_registrar_postulacion(
    p_estudiante_id INTEGER,
    p_vacante_id INTEGER,
    p_proyecto_id INTEGER DEFAULT NULL,
    p_mensaje TEXT DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $$
DECLARE
    v_usuario_id INTEGER;
    v_estado_vacante_id INTEGER;
    v_estado_vacante TEXT;
    v_cupos SMALLINT;
    v_fecha_cierre DATE;
    v_pendiente_id INTEGER;
    v_postulacion_id INTEGER;
BEGIN
    SELECT u.id INTO v_usuario_id
    FROM public.estudiantes AS e
    JOIN public.usuarios AS u ON u.id = e.usuario_id
    JOIN public.roles AS r ON r.id = u.rol_id
    WHERE e.id = p_estudiante_id AND u.activo AND r.nombre = 'ESTUDIANTE';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Estudiante % sin cuenta activa de estudiante', p_estudiante_id
            USING ERRCODE = '22023';
    END IF;

    SELECT v.estado_id, v.cupos, v.fecha_cierre
    INTO v_estado_vacante_id, v_cupos, v_fecha_cierre
    FROM public.vacantes AS v
    WHERE v.id = p_vacante_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Vacante % inexistente', p_vacante_id USING ERRCODE = '22023';
    END IF;

    SELECT nombre INTO STRICT v_estado_vacante
    FROM public.estados_vacante WHERE id = v_estado_vacante_id;

    IF v_estado_vacante <> 'Abierta' OR v_cupos = 0
       OR v_fecha_cierre < (statement_timestamp() AT TIME ZONE 'America/Lima')::DATE THEN
        RAISE EXCEPTION 'Vacante % sin postulaciones habilitadas', p_vacante_id
            USING ERRCODE = '55000';
    END IF;

    IF p_proyecto_id IS NOT NULL THEN
        PERFORM 1 FROM public.proyectos
        WHERE id = p_proyecto_id AND estudiante_id = p_estudiante_id
        FOR SHARE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Proyecto % ajeno al estudiante o inexistente', p_proyecto_id
                USING ERRCODE = '22023';
        END IF;
    END IF;

    SELECT id INTO STRICT v_pendiente_id
    FROM public.estados_postulacion WHERE nombre = 'Pendiente';

    INSERT INTO public.postulaciones (
        vacante_id, estudiante_id, estado_id, proyecto_id, mensaje, match_pct
    ) VALUES (
        p_vacante_id, p_estudiante_id, v_pendiente_id, p_proyecto_id, p_mensaje,
        public.fn_calcular_match(p_estudiante_id, p_vacante_id)
    )
    ON CONFLICT (vacante_id, estudiante_id) DO NOTHING
    RETURNING id INTO v_postulacion_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'El estudiante % ya postuló a la vacante %', p_estudiante_id, p_vacante_id
            USING ERRCODE = '23505';
    END IF;

    INSERT INTO public.historial_postulacion (
        postulacion_id, estado_anterior_id, estado_nuevo_id, usuario_id, nota
    ) VALUES (v_postulacion_id, NULL, v_pendiente_id, v_usuario_id, 'Postulación registrada');

    RETURN v_postulacion_id;
END;
$$;

-- Las rutinas de escritura bloquean primero la vacante. Una aceptación es definitiva.
-- La empresa titular o un administrador cambian estados. El estudiante puede retirar su postulación.
-- Repetir el estado actual es idempotente. La auditoría registra cambios efectivos.
CREATE OR REPLACE PROCEDURE public.sp_cambiar_estado_postulacion(
    p_postulacion_id INTEGER,
    p_estado_id INTEGER,
    p_usuario_id INTEGER,
    p_nota TEXT DEFAULT NULL
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $$
DECLARE
    v_vacante_id INTEGER;
    v_empresa_id INTEGER;
    v_empresa_usuario_id INTEGER;
    v_estudiante_id INTEGER;
    v_estudiante_usuario_id INTEGER;
    v_cupos SMALLINT;
    v_estado_vacante_id INTEGER;
    v_estado_vacante TEXT;
    v_estado_anterior_id INTEGER;
    v_estado_anterior TEXT;
    v_estado_nuevo TEXT;
    v_cerrada_id INTEGER;
    v_rol TEXT;
BEGIN
    SELECT vacante_id INTO v_vacante_id
    FROM public.postulaciones WHERE id = p_postulacion_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Postulación % inexistente', p_postulacion_id USING ERRCODE = '22023';
    END IF;

    SELECT v.cupos, v.estado_id, v.empresa_id
    INTO v_cupos, v_estado_vacante_id, v_empresa_id
    FROM public.vacantes AS v
    WHERE v.id = v_vacante_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Vacante % inexistente', v_vacante_id USING ERRCODE = '22023';
    END IF;

    SELECT p.estado_id, p.estudiante_id
    INTO v_estado_anterior_id, v_estudiante_id
    FROM public.postulaciones AS p
    WHERE p.id = p_postulacion_id AND p.vacante_id = v_vacante_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'La postulación % cambió o ya no existe', p_postulacion_id
            USING ERRCODE = '55000';
    END IF;

    SELECT usuario_id INTO STRICT v_empresa_usuario_id FROM public.empresas WHERE id = v_empresa_id;
    SELECT usuario_id INTO STRICT v_estudiante_usuario_id FROM public.estudiantes WHERE id = v_estudiante_id;
    SELECT nombre INTO STRICT v_estado_anterior FROM public.estados_postulacion WHERE id = v_estado_anterior_id;

    SELECT nombre INTO v_estado_nuevo
    FROM public.estados_postulacion WHERE id = p_estado_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Estado de postulación % inexistente', p_estado_id USING ERRCODE = '22023';
    END IF;

    SELECT r.nombre INTO v_rol
    FROM public.usuarios AS u
    JOIN public.roles AS r ON r.id = u.rol_id
    WHERE u.id = p_usuario_id AND u.activo;

    IF v_rol IS NULL OR NOT (
        v_rol = 'ADMIN'
        OR (v_rol = 'EMPRESA' AND p_usuario_id = v_empresa_usuario_id)
        OR (v_rol = 'ESTUDIANTE' AND p_usuario_id = v_estudiante_usuario_id
            AND v_estado_nuevo = 'Retirada')
    ) THEN
        RAISE EXCEPTION 'Cuenta sin permiso para cambiar el estado de la postulación'
            USING ERRCODE = '42501';
    END IF;

    IF p_estado_id = v_estado_anterior_id THEN
        RETURN;
    END IF;

    IF v_estado_anterior = 'Aceptada' THEN
        RAISE EXCEPTION 'Una aceptación confirmada es definitiva' USING ERRCODE = '55000';
    END IF;

    IF v_estado_nuevo = 'Aceptada' THEN
        SELECT nombre INTO STRICT v_estado_vacante
        FROM public.estados_vacante WHERE id = v_estado_vacante_id;

        IF v_cupos = 0 OR v_estado_vacante NOT IN ('Abierta', 'En evaluación') THEN
            RAISE EXCEPTION 'Vacante % sin cupos habilitados para aceptación', v_vacante_id
                USING ERRCODE = '55000';
        END IF;

        IF v_cupos = 1 THEN
            SELECT id INTO STRICT v_cerrada_id FROM public.estados_vacante WHERE nombre = 'Cerrada';
        END IF;

        UPDATE public.vacantes
        SET cupos = cupos - 1, estado_id = COALESCE(v_cerrada_id, estado_id)
        WHERE id = v_vacante_id;
    END IF;

    UPDATE public.postulaciones SET estado_id = p_estado_id WHERE id = p_postulacion_id;

    INSERT INTO public.historial_postulacion (
        postulacion_id, estado_anterior_id, estado_nuevo_id, usuario_id, nota
    ) VALUES (p_postulacion_id, v_estado_anterior_id, p_estado_id, p_usuario_id, p_nota);
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_metricas_impacto()
RETURNS TABLE (
    estudiantes_verificados BIGINT,
    empresas_verificadas BIGINT,
    proyectos BIGINT,
    vacantes_abiertas BIGINT,
    estudiantes_aceptados BIGINT
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog
AS $$
BEGIN
    RETURN QUERY SELECT
        (SELECT COUNT(*) FROM public.estudiantes AS e WHERE e.dni_validado),
        (SELECT COUNT(*) FROM public.empresas AS e WHERE e.ruc_validado),
        (SELECT COUNT(*) FROM public.proyectos AS p),
        (SELECT COUNT(*)
         FROM public.vacantes AS v
         JOIN public.estados_vacante AS ev ON ev.id = v.estado_id
         WHERE ev.nombre = 'Abierta' AND v.cupos > 0
           AND v.fecha_cierre >= (statement_timestamp() AT TIME ZONE 'America/Lima')::DATE),
        (SELECT COUNT(DISTINCT p.estudiante_id)
         FROM public.postulaciones AS p
         JOIN public.estados_postulacion AS ep ON ep.id = p.estado_id
         WHERE ep.nombre = 'Aceptada');
END;
$$;

-- Protege las tablas creadas por SQL en Supabase. Durante esta fase se ejecuta como propietario.
-- Los roles anon y authenticated quedan sin acceso a tablas, secuencias ni rutinas de TalentMatch.
REVOKE EXECUTE ON FUNCTION public.fn_calcular_match(INTEGER, INTEGER) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fn_registrar_postulacion(INTEGER, INTEGER, INTEGER, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON PROCEDURE public.sp_cambiar_estado_postulacion(INTEGER, INTEGER, INTEGER, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fn_metricas_impacto() FROM PUBLIC;

DO $$
DECLARE
    v_tabla REGCLASS;
    v_secuencia TEXT;
    v_rol NAME;
BEGIN
    FOREACH v_tabla IN ARRAY ARRAY[
        'public.roles', 'public.usuarios', 'public.carreras', 'public.estados_academicos',
        'public.sectores', 'public.modalidades', 'public.tipos_vacante', 'public.estados_vacante',
        'public.estados_postulacion', 'public.categorias_habilidad', 'public.habilidades',
        'public.niveles', 'public.estudiantes', 'public.empresas', 'public.proyectos',
        'public.vacantes', 'public.estudiante_habilidad', 'public.proyecto_habilidad',
        'public.vacante_habilidad', 'public.postulaciones', 'public.historial_postulacion'
    ]::REGCLASS[] LOOP
        EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', v_tabla);
        EXECUTE format('REVOKE ALL ON TABLE %s FROM PUBLIC', v_tabla);

        IF EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = v_tabla AND attname = 'id' AND NOT attisdropped) THEN
            v_secuencia := pg_get_serial_sequence(v_tabla::TEXT, 'id');
            IF v_secuencia IS NOT NULL THEN
                EXECUTE format('REVOKE ALL ON SEQUENCE %s FROM PUBLIC', v_secuencia);
            END IF;
        ELSE
            v_secuencia := NULL;
        END IF;

        FOR v_rol IN SELECT rolname FROM pg_roles WHERE rolname IN ('anon', 'authenticated') LOOP
            EXECUTE format('REVOKE ALL ON TABLE %s FROM %I', v_tabla, v_rol);
            IF v_secuencia IS NOT NULL THEN
                EXECUTE format('REVOKE ALL ON SEQUENCE %s FROM %I', v_secuencia, v_rol);
            END IF;
        END LOOP;
    END LOOP;

    FOR v_rol IN SELECT rolname FROM pg_roles WHERE rolname IN ('anon', 'authenticated') LOOP
        EXECUTE format('REVOKE EXECUTE ON FUNCTION public.fn_calcular_match(INTEGER, INTEGER) FROM %I', v_rol);
        EXECUTE format('REVOKE EXECUTE ON FUNCTION public.fn_registrar_postulacion(INTEGER, INTEGER, INTEGER, TEXT) FROM %I', v_rol);
        EXECUTE format('REVOKE EXECUTE ON PROCEDURE public.sp_cambiar_estado_postulacion(INTEGER, INTEGER, INTEGER, TEXT) FROM %I', v_rol);
        EXECUTE format('REVOKE EXECUTE ON FUNCTION public.fn_metricas_impacto() FROM %I', v_rol);
    END LOOP;
END;
$$;

COMMIT;
