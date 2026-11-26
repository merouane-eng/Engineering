# APK Web Engineering — environnement TEST

Ce fichier documente les règles de séparation entre les deux projets Vercel.

- GitHub : `merouane-eng/Engineering`
- Branche de développement : `develop/apk-web-test`
- Commit de référence (production au 26/11/2026) : `1a08168aea475f43e5a13a85901f16874830ab90`
- Projet Vercel TEST : `engineering-apk-test`
- Domaine réservé à la branche TEST : https://engineering-apk-test-essais.vercel.app
- Projet Vercel PRODUCTION : `engineering-1rb3`
- Domaine PRODUCTION : https://engineering-1rb3.vercel.app
- Supabase : projet `Engineering` (`ceetfduiikmnbahpmxbp`), base commune aux deux environnements.

## Règles impératives

1. Travailler uniquement sur `develop/apk-web-test`.
2. Déployer et tester sur le projet Vercel `engineering-apk-test`, jamais sur `engineering-1rb3` pendant le développement.
3. Ne jamais modifier le schéma, les politiques RLS, les autorisations ou les migrations de la base Supabase commune sans accord explicite.
4. Les opérations d'écriture réalisées dans TEST touchent les mêmes données que la production ; tester avec précaution.
5. Ne pas merger, promouvoir ou déployer vers PRODUCTION tant que l'utilisateur n'a pas explicitement dit « C'est validé, publie en production ».
6. Avant toute publication approuvée, vérifier le commit cible ; après publication, vérifier le déploiement et conserver l'URL officielle.

Ce fichier ne change aucun composant ni aucune fonctionnalité de l'application.
