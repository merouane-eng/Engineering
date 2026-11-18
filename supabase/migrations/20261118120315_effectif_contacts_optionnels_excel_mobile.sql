-- Champs contact déjà présents dans Engineering PC, maintenant facultatifs sur mobile.
-- Aucune donnée existante ni aucun droit utilisateur n'est modifié.
ALTER TABLE public.effectif
  ADD COLUMN IF NOT EXISTS telephone text NULL,
  ADD COLUMN IF NOT EXISTS email text NULL;
