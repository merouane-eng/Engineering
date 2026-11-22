-- Extension RH non destructive, édition du 22 novembre 2026.
-- Aucun changement des lignes de personnel existantes.
ALTER TABLE public.effectif ADD COLUMN IF NOT EXISTS date_debut_contrat date;

-- L'ancien contrôle ne connaît que CDI/CDD : il doit accepter l'apprentissage.
ALTER TABLE public.effectif DROP CONSTRAINT IF EXISTS effectif_type_contrat_check;
ALTER TABLE public.effectif ADD CONSTRAINT effectif_type_contrat_check
  CHECK (type_contrat IS NULL OR type_contrat IN ('CDI','CDD','APPRENTISSAGE','AUTRE'));

-- Les CDD conservent leur date de fin obligatoire.
-- Les apprentis et autres contrats peuvent avoir une date de fin facultative.
ALTER TABLE public.effectif DROP CONSTRAINT IF EXISTS effectif_fin_contrat_check;
ALTER TABLE public.effectif ADD CONSTRAINT effectif_fin_contrat_check
  CHECK (
    type_contrat IS NULL OR
    (type_contrat='CDD' AND date_fin_contrat IS NOT NULL) OR
    (type_contrat='CDI' AND date_fin_contrat IS NULL) OR
    type_contrat IN ('APPRENTISSAGE','AUTRE')
  );
