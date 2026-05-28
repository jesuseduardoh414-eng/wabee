-- =========================================================
-- MIGRACIÓN DE UNIFICACIÓN DE ESQUEMA: WABEE (Phase 3)
-- Propósito: Mover todos los modelos de dominio propio desde
-- 'public' y 'r4d_app_v1' hacia el nuevo esquema único 'wabee'.
-- =========================================================

-- 1. Crear el nuevo esquema
CREATE SCHEMA IF NOT EXISTS "wabee";

-- 2. Mover Enums de r4d_app_v1 -> wabee (31 enums)
DO $$ 
DECLARE 
    e record;
BEGIN
    FOR e IN (SELECT n.nspname as schema, t.typname as name 
              FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace 
              WHERE n.nspname = 'r4d_app_v1' AND t.typtype = 'e') 
    LOOP
        BEGIN
            EXECUTE format('ALTER TYPE r4d_app_v1.%I SET SCHEMA wabee', e.name);
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'No se pudo mover el enum %: %', e.name, SQLERRM;
        END;
    END LOOP;
END $$;

-- 3. Mover Tablas de r4d_app_v1 -> wabee (38 tablas)
DO $$ 
DECLARE 
    t record;
BEGIN
    FOR t IN (SELECT table_name FROM information_schema.tables 
              WHERE table_schema = 'r4d_app_v1') 
    LOOP
        BEGIN
            EXECUTE format('ALTER TABLE r4d_app_v1.%I SET SCHEMA wabee', t.table_name);
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'No se pudo mover la tabla %: %', t.table_name, SQLERRM;
        END;
    END LOOP;
END $$;

-- 4. Mover Tablas de public -> wabee (AuthChallenge)
-- Solo se mueve si existe en public
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'auth_challenges') THEN
        ALTER TABLE public.auth_challenges SET SCHEMA wabee;
    END IF;
END $$;

-- 5. Mover Secuencias (para preservar IDs autoincrementales)
DO $$ 
DECLARE 
    s record;
BEGIN
    FOR s IN (SELECT sequence_name FROM information_schema.sequences 
              WHERE sequence_schema = 'r4d_app_v1') 
    LOOP
        BEGIN
            EXECUTE format('ALTER SEQUENCE r4d_app_v1.%I SET SCHEMA wabee', s.sequence_name);
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'No se pudo mover la secuencia %: %', s.sequence_name, SQLERRM;
        END;
    END LOOP;
END $$;

-- 6. Verificación final
SELECT n.nspname as esquema, count(*) as total_tablas
FROM information_schema.tables t
JOIN pg_namespace n ON n.oid = t.table_schema::regnamespace
WHERE n.nspname IN ('wabee', 'r4d_app_v1', 'public')
GROUP BY n.nspname;
