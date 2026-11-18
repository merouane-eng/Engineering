-- Migration versionnée des listes de référence Engineering Mobile.
-- Administrateur vérifié par la passerelle Express. Clé serveur hors dépôt.
-- Exécutée d'abord dans Supabase : 20261118122734.
CREATE SCHEMA IF NOT EXISTS engineering_private;
REVOKE ALL ON SCHEMA engineering_private FROM PUBLIC, anon, authenticated;
CREATE TABLE IF NOT EXISTS engineering_private.reference_access (
 id boolean PRIMARY KEY DEFAULT true CHECK(id),
 secret_hash text NOT NULL
);
ALTER TABLE engineering_private.reference_access ENABLE ROW LEVEL SECURITY;
INSERT INTO engineering_private.reference_access(id,secret_hash)
VALUES (true,'d48dc6dd6c939012a08a8c8df517dba0de3fecc93905ed59e775db26e239d372')
ON CONFLICT (id) DO NOTHING;
CREATE TABLE IF NOT EXISTS engineering_private.ref_listes (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 type_liste text NOT NULL CHECK(type_liste IN ('service','fonction','zone','unite','groupe','frequence_pm','statut_pm','statut_panne','area_SG01','area_SG02','equipement_SG01','equipement_SG02')),
 valeur text NOT NULL CHECK(char_length(trim(valeur)) BETWEEN 1 AND 120),
 parent text, ordre integer NOT NULL DEFAULT 0,
 actif boolean NOT NULL DEFAULT true,
 date_creation timestamptz NOT NULL DEFAULT now(),
 date_modification timestamptz
);
ALTER TABLE engineering_private.ref_listes ENABLE ROW LEVEL SECURITY;
CREATE UNIQUE INDEX IF NOT EXISTS ref_listes_unique_type_value_ci ON engineering_private.ref_listes(type_liste,lower(valeur));
INSERT INTO engineering_private.ref_listes(type_liste,valeur,parent,ordre,actif) VALUES
('area_SG01','Magasin',NULL,0,true),
('area_SG01','QMS Office',NULL,1,true),
('area_SG01','Administration',NULL,2,true),
('area_SG01','Réception',NULL,3,true),
('area_SG01','RH',NULL,4,true),
('area_SG01','Réfectoire',NULL,5,true),
('area_SG01','Parking',NULL,6,true),
('area_SG01','Locaux techniques',NULL,7,true),
('area_SG01','Sanitaires',NULL,8,true),
('area_SG01','Salle de réunion',NULL,9,true),
('area_SG01','Extérieurs',NULL,10,true),
('area_SG02','Magasin',NULL,0,true),
('area_SG02','QMS Office',NULL,1,true),
('area_SG02','Administration',NULL,2,true),
('area_SG02','Réception',NULL,3,true),
('area_SG02','RH',NULL,4,true),
('area_SG02','Réfectoire',NULL,5,true),
('area_SG02','Parking',NULL,6,true),
('area_SG02','Locaux techniques',NULL,7,true),
('area_SG02','Sanitaires',NULL,8,true),
('area_SG02','Salle de réunion',NULL,9,true),
('area_SG02','Extérieurs',NULL,10,true),
('equipement_SG01','Sans machine de production',NULL,0,true),
('equipement_SG01','Climatisation',NULL,1,true),
('equipement_SG01','Installation électrique',NULL,2,true),
('equipement_SG02','Sans machine de production',NULL,0,true),
('equipement_SG02','Climatisation',NULL,1,true),
('equipement_SG02','Installation électrique',NULL,2,true),
('fonction','Apprenti',NULL,0,true),
('fonction','Black Utilities Shift Leader',NULL,0,true),
('fonction','Black Utilities Technicien 1',NULL,0,true),
('fonction','Black Utilities Technicien 2',NULL,0,true),
('fonction','Civil Work Technicien 1',NULL,0,true),
('fonction','Civil Work technicien 2',NULL,0,true),
('fonction','Clean Utilities Shift Leader',NULL,0,true),
('fonction','Clean Utilities Technicien 1',NULL,0,true),
('fonction','Clean Utilities Technicien 2',NULL,0,true),
('fonction','Electrical Shift Leader',NULL,0,true),
('fonction','Electrical Supervisor',NULL,0,true),
('fonction','Electrical Technician 2',NULL,0,true),
('fonction','Electrical Technicien 1',NULL,0,true),
('fonction','Hygiène & Entretien Officer 2',NULL,0,true),
('fonction','Ingénieur Maintenance Machines Industrielles',NULL,0,true),
('fonction','Instrumentation Manager',NULL,0,true),
('fonction','Instrumentation Technicien 2',NULL,0,true),
('fonction','Maintenance Manager of Sterille',NULL,0,true),
('fonction','Maintenance Shift Leader',NULL,0,true),
('fonction','Maintenance Shift Leader Process',NULL,0,true),
('fonction','Maintenance Supervisor',NULL,0,true),
('fonction','Maintenance Supervisor Process',NULL,0,true),
('fonction','Maintenance Technicien 1',NULL,0,true),
('fonction','Maintenance Technicien 2',NULL,0,true),
('fonction','Manager Engineering OSD',NULL,0,true),
('fonction','technicien 2 climatisation',NULL,0,true),
('fonction','Technicien L1',NULL,0,true),
('fonction','Utilities Manager',NULL,0,true),
('fonction','Technicien L2',NULL,1,true),
('fonction','Shift leader',NULL,2,true),
('fonction','Manager',NULL,3,true),
('fonction','Directeur',NULL,4,true),
('frequence_pm','WEEKLY',NULL,0,true),
('frequence_pm','MONTHLY',NULL,1,true),
('frequence_pm','QUARTERLY',NULL,2,true),
('frequence_pm','HALF YEARLY',NULL,3,true),
('frequence_pm','YEARLY',NULL,4,true),
('groupe','Process',NULL,0,true),
('groupe','OSD',NULL,1,true),
('service','Maintenance',NULL,0,true),
('service','Utilities',NULL,0,true),
('service','Instrumentation',NULL,1,true),
('service','Électricité',NULL,2,true),
('statut_panne','Clos',NULL,0,true),
('statut_panne','Open',NULL,0,true),
('statut_panne','Close',NULL,1,true),
('statut_pm','Planifiée',NULL,0,true),
('statut_pm','Réalisée',NULL,1,true),
('statut_pm','Annulée',NULL,2,true),
('statut_pm','Reportée',NULL,3,true),
('statut_pm','Non conforme',NULL,4,true),
('unite','Traitement D''eau',NULL,0,true),
('unite','U1','Process',0,true),
('unite','U4','Process',1,true),
('unite','U5','Process',2,true),
('unite','U6','Process',3,true),
('unite','U2','OSD',4,true),
('unite','U3-1','OSD',5,true),
('unite','U3-2','OSD',6,true),
('unite','SG01',NULL,7,true),
('unite','SG02',NULL,8,true),
('zone','MICROBIOLOGY',NULL,0,true),
('zone','PACKAGING',NULL,0,true),
('zone','Process',NULL,0,true),
('zone','QUALITY MANAGEMENT SYSTEM',NULL,0,true),
('zone','Primary packing',NULL,1,true),
('zone','Secondary packing',NULL,2,true),
('zone','HVAC',NULL,3,true),
('zone','Microbiologie',NULL,4,true),
('zone','QC',NULL,5,true),
('zone','Utility',NULL,6,true),
('zone','Physico chimie',NULL,7,true)
ON CONFLICT DO NOTHING;
CREATE OR REPLACE FUNCTION public.engineering_references_rpc(p_secret text, p_action text, p_type text DEFAULT NULL::text, p_id bigint DEFAULT NULL::bigint, p_valeur text DEFAULT NULL::text, p_parent text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
 expected_hash text;
 old_record engineering_private.ref_listes%ROWTYPE;
 n integer := 0;
 clean_value text := nullif(trim(p_valeur),'');
 clean_parent text := nullif(trim(p_parent),'');
 result jsonb;
BEGIN
 SELECT secret_hash INTO expected_hash FROM engineering_private.reference_access WHERE id=true;
 IF expected_hash IS NULL OR encode(sha256(convert_to(coalesce(p_secret,''),'UTF8')),'hex') IS DISTINCT FROM expected_hash THEN
   RAISE EXCEPTION 'Accès aux paramètres refusé' USING ERRCODE='42501';
 END IF;
 IF p_action='list' THEN
   SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.ordre,r.valeur),'[]'::jsonb)
   INTO result FROM engineering_private.ref_listes r;
   RETURN result;
 END IF;
 IF p_action NOT IN ('add','edit','delete') THEN
   RAISE EXCEPTION 'Action inconnue' USING ERRCODE='22023';
 END IF;
 IF p_action='add' THEN
   IF p_type NOT IN ('service','fonction','zone','unite','groupe','frequence_pm','statut_pm','statut_panne','area_SG01','area_SG02','equipement_SG01','equipement_SG02')
     OR clean_value IS NULL OR char_length(clean_value)>120
     OR (p_type='unite' AND clean_parent IS NOT NULL AND NOT EXISTS(SELECT 1 FROM engineering_private.ref_listes WHERE type_liste='groupe' AND valeur=clean_parent))
   THEN RAISE EXCEPTION 'Valeur ou groupe invalide' USING ERRCODE='22023'; END IF;
   INSERT INTO engineering_private.ref_listes(type_liste,valeur,parent,ordre)
     VALUES(p_type,clean_value,CASE WHEN p_type='unite' THEN clean_parent ELSE NULL END,
      (SELECT coalesce(max(ordre),-1)+1 FROM engineering_private.ref_listes WHERE type_liste=p_type))
     RETURNING to_jsonb(engineering_private.ref_listes.*) INTO result;
   RETURN result;
 END IF;
 SELECT * INTO old_record FROM engineering_private.ref_listes WHERE id=p_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Référence introuvable' USING ERRCODE='22023'; END IF;
 SELECT
 CASE old_record.type_liste
 WHEN 'service' THEN (SELECT count(*) FROM public.effectif WHERE service=old_record.valeur)+(SELECT count(*) FROM public.pannes WHERE service=old_record.valeur)+(SELECT count(*) FROM public.pm_programmees WHERE service_intervenant=old_record.valeur)
 WHEN 'fonction' THEN (SELECT count(*) FROM public.effectif WHERE fonction=old_record.valeur)
 WHEN 'zone' THEN (SELECT count(*) FROM public.machines WHERE zone=old_record.valeur)+(SELECT count(*) FROM public.pannes WHERE area=old_record.valeur)
 WHEN 'unite' THEN (SELECT count(*) FROM public.machines WHERE unite=old_record.valeur)+(SELECT count(*) FROM public.pannes WHERE unite=old_record.valeur)+(SELECT count(*) FROM public.pm_programmees WHERE unite=old_record.valeur)+(SELECT count(*) FROM public.pm_realisees WHERE unite=old_record.valeur)+(SELECT count(*) FROM public.effectif_unites WHERE unite=old_record.valeur)
 WHEN 'groupe' THEN (SELECT count(*) FROM public.machines WHERE groupe=old_record.valeur)+(SELECT count(*) FROM public.pm_programmees WHERE groupe=old_record.valeur)+(SELECT count(*) FROM engineering_private.ref_listes WHERE type_liste='unite' AND parent=old_record.valeur)
 WHEN 'frequence_pm' THEN (SELECT count(*) FROM public.pm_programmees WHERE frequence=old_record.valeur)
 WHEN 'statut_pm' THEN (SELECT count(*) FROM public.pm_programmees WHERE statut=old_record.valeur)+(SELECT count(*) FROM public.pm_realisees WHERE statut=old_record.valeur)
 WHEN 'statut_panne' THEN (SELECT count(*) FROM public.pannes WHERE statut=old_record.valeur)
 WHEN 'area_SG01' THEN (SELECT count(*) FROM public.pannes WHERE unite='SG01' AND area=old_record.valeur)
 WHEN 'area_SG02' THEN (SELECT count(*) FROM public.pannes WHERE unite='SG02' AND area=old_record.valeur)
 WHEN 'equipement_SG01' THEN (SELECT count(*) FROM public.pannes WHERE unite='SG01' AND machine=old_record.valeur)
 WHEN 'equipement_SG02' THEN (SELECT count(*) FROM public.pannes WHERE unite='SG02' AND machine=old_record.valeur)
 ELSE 0 END INTO n;
 IF p_action='delete' THEN
   IF n>0 THEN RAISE EXCEPTION 'Référence utilisée : suppression interdite (% usages)',n USING ERRCODE='22023'; END IF;
   DELETE FROM engineering_private.ref_listes WHERE id=p_id;
   RETURN jsonb_build_object('deleted',true,'id',p_id);
 END IF;
 IF clean_value IS NULL OR char_length(clean_value)>120 THEN
   RAISE EXCEPTION 'Valeur invalide' USING ERRCODE='22023';
 END IF;
 IF old_record.type_liste='unite' AND clean_parent IS NOT NULL AND NOT EXISTS(SELECT 1 FROM engineering_private.ref_listes WHERE type_liste='groupe' AND valeur=clean_parent) THEN
   RAISE EXCEPTION 'Groupe parent inconnu' USING ERRCODE='22023';
 END IF;
 -- Prudence: ne pas renommer automatiquement les données historiques.
 -- Une référence utilisée nécessite une réaffectation préalable dans les modules concernés.
 IF n>0 AND clean_value IS DISTINCT FROM old_record.valeur THEN
    RAISE EXCEPTION 'Référence utilisée : renommer les affectations avant de changer ce libellé (% usages)',n USING ERRCODE='22023';
 END IF;
 UPDATE engineering_private.ref_listes
 SET valeur=clean_value,
     parent=CASE WHEN type_liste='unite' THEN clean_parent ELSE parent END,
     date_modification=now()
 WHERE id=p_id RETURNING to_jsonb(engineering_private.ref_listes.*) INTO result;
 RETURN result;
END
$function$

REVOKE ALL ON FUNCTION public.engineering_references_rpc(text,text,text,bigint,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.engineering_references_rpc(text,text,text,bigint,text,text) TO anon,authenticated;
