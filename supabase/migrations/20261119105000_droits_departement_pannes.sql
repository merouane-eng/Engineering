-- Migration non destructive : droits par département et propriété des pannes.
-- Les machines existantes restent des équipements partagés (departement NULL).
-- Les pannes historiques gardent leur créateur non renseigné : aucun faux propriétaire.
ALTER TABLE public.machines ADD COLUMN IF NOT EXISTS departement text NULL;
ALTER TABLE public.pannes ADD COLUMN IF NOT EXISTS cree_par_effectif_id uuid NULL;
CREATE INDEX IF NOT EXISTS idx_machines_departement_unite ON public.machines (departement,unite);
CREATE INDEX IF NOT EXISTS idx_pannes_owner ON public.pannes (cree_par_effectif_id);
