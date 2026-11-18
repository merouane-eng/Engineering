-- Attribution explicite des PM à un métier. Ajout facultatif : aucune PM historique n'est modifiée.
ALTER TABLE public.pm_programmees ADD COLUMN IF NOT EXISTS service_intervenant text NULL;
