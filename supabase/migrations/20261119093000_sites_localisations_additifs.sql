-- Migration additive : conserver les clés unite / groupe historiques utilisées par les modules desktop.
-- La nouvelle application affiche "Localisation" et utilise des codes distincts par site.
ALTER TABLE public.machines ADD COLUMN IF NOT EXISTS site text;
UPDATE public.machines
SET site = CASE WHEN upper(trim(unite)) IN ('U6','U06','SG02')
                      OR upper(trim(unite)) LIKE '%__S02'
                THEN 'Site 02' ELSE 'Site 01' END
WHERE site IS NULL OR btrim(site)='';
INSERT INTO engineering_private.ref_listes(type_liste,valeur,parent,ordre,actif)
VALUES
 ('unite','MICROBIOLOGIE__S01',NULL,200,true),
 ('unite','MICROBIOLOGIE__S02',NULL,201,true),
 ('unite','QC__S01',NULL,202,true),
 ('unite','QC__S02',NULL,203,true)
ON CONFLICT DO NOTHING;
-- Aucune suppression et aucun changement des codes d'unités existants.
