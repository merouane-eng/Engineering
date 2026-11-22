-- Gestion centralisée des permissions. Ajout non destructif :
-- aucune modification des employés, modules, interventions ou historiques existants.
-- Ne jamais exposer cette table à l'API PostgREST publique.
CREATE SCHEMA IF NOT EXISTS engineering_private;
REVOKE ALL ON SCHEMA engineering_private FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS engineering_private.module_permissions (
  scope text NOT NULL CHECK (scope IN ('role','fonction','personne')),
  subject text NOT NULL CHECK (length(subject) BETWEEN 1 AND 180),
  rules jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(rules)='object'),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (scope,subject)
);
ALTER TABLE engineering_private.module_permissions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON engineering_private.module_permissions FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.engineering_permissions_rpc(
  p_secret text,
  p_action text,
  p_scope text DEFAULT NULL,
  p_subject text DEFAULT NULL,
  p_rules jsonb DEFAULT NULL,
  p_role text DEFAULT NULL,
  p_fonction text DEFAULT NULL,
  p_personne text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  expected_hash text;
  result jsonb;
  module_name text;
  action_name text;
  actions jsonb;
  choice jsonb;
BEGIN
  SELECT secret_hash INTO expected_hash FROM engineering_private.reference_access WHERE id=true;
  IF expected_hash IS NULL OR encode(sha256(convert_to(coalesce(p_secret,''),'UTF8')),'hex') IS DISTINCT FROM expected_hash THEN
    RAISE EXCEPTION 'Accès aux permissions refusé' USING ERRCODE='42501';
  END IF;
  IF p_action='list' THEN
    SELECT coalesce(jsonb_agg(jsonb_build_object('scope',scope,'subject',subject,'rules',rules)
      ORDER BY scope,subject),'[]'::jsonb) INTO result
    FROM engineering_private.module_permissions;
    RETURN result;
  END IF;
  IF p_action='resolve' THEN
    SELECT coalesce(jsonb_agg(jsonb_build_object('scope',scope,'subject',subject,'rules',rules)
      ORDER BY scope,subject),'[]'::jsonb) INTO result
    FROM engineering_private.module_permissions
    WHERE (scope='role' AND subject=coalesce(p_role,''))
       OR (scope='fonction' AND subject=coalesce(p_fonction,''))
       OR (scope='personne' AND subject=coalesce(p_personne,''));
    RETURN result;
  END IF;
  IF p_action<>'set' THEN
    RAISE EXCEPTION 'Action inconnue' USING ERRCODE='22023';
  END IF;
  IF p_scope NOT IN ('role','fonction','personne') OR p_subject IS NULL
    OR length(p_subject) NOT BETWEEN 1 AND 180 THEN
    RAISE EXCEPTION 'Cible invalide' USING ERRCODE='22023';
  END IF;
  IF p_scope='role' AND p_subject NOT IN ('superviseur','technicien') THEN
    RAISE EXCEPTION 'Administrateur non paramétrable' USING ERRCODE='42501';
  END IF;
  IF p_scope='personne' AND NOT EXISTS (
    SELECT 1 FROM public.effectif WHERE id::text=p_subject AND actif=true AND role<>'admin'
  ) THEN
    RAISE EXCEPTION 'Personne inexistante ou administrateur protégé' USING ERRCODE='42501';
  END IF;
  IF p_rules IS NULL OR jsonb_typeof(p_rules)<>'object' THEN
    RAISE EXCEPTION 'Règles invalides' USING ERRCODE='22023';
  END IF;
  FOR module_name,actions IN SELECT key,value FROM jsonb_each(p_rules) LOOP
    IF module_name NOT IN ('accueil','machines','effectif','saisie','liste','pm','operating','sop','stats')
       OR jsonb_typeof(actions)<>'object' THEN
      RAISE EXCEPTION 'Module non paramétrable' USING ERRCODE='22023';
    END IF;
    FOR action_name,choice IN SELECT key,value FROM jsonb_each(actions) LOOP
      IF action_name NOT IN ('view','create','edit') OR jsonb_typeof(choice)<>'boolean'
       OR (module_name IN ('accueil','stats') AND action_name<>'view')
       OR (module_name='saisie' AND action_name='edit')
       OR (module_name='liste' AND action_name='create')
      THEN RAISE EXCEPTION 'Action non paramétrable' USING ERRCODE='22023'; END IF;
    END LOOP;
  END LOOP;
  IF p_rules='{}'::jsonb THEN
    DELETE FROM engineering_private.module_permissions WHERE scope=p_scope AND subject=p_subject;
    RETURN jsonb_build_object('scope',p_scope,'subject',p_subject,'rules','{}'::jsonb);
  END IF;
  INSERT INTO engineering_private.module_permissions(scope,subject,rules)
    VALUES(p_scope,p_subject,p_rules)
  ON CONFLICT(scope,subject) DO UPDATE SET rules=excluded.rules,updated_at=now();
  RETURN jsonb_build_object('scope',p_scope,'subject',p_subject,'rules',p_rules);
END
$function$;

REVOKE ALL ON FUNCTION public.engineering_permissions_rpc(text,text,text,text,jsonb,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.engineering_permissions_rpc(text,text,text,text,jsonb,text,text,text) TO anon,authenticated;
