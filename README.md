# Blog automatique NovaTech Gear

Ce projet publie automatiquement un article de blog chaque jour sur ta boutique Shopify (novatechgear-2.myshopify.com), sans que ton ordinateur ait besoin d'être allumé. Tout tourne sur les serveurs gratuits de GitHub Actions.

Chaque article contient : une introduction, six paragraphes développés, une conclusion, une FAQ de 10 questions/réponses, ainsi que les balises meta title et meta description, générés automatiquement puis publiés directement sur ta boutique.

## Étape 1 — Créer le dépôt GitHub

1. Va sur https://github.com/new
2. Crée un dépôt (public ou privé, peu importe), par exemple `novatechgear-blog-auto`
3. Sur ton ordinateur, dans ce dossier, lance :

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/TON-COMPTE/novatechgear-blog-auto.git
git push -u origin main
```

## Étape 2 — Créer une clé API Anthropic

1. Va sur https://console.anthropic.com/settings/keys
2. Crée une clé API (différente de ton abonnement Claude.ai — c'est un compte séparé avec facturation à l'usage)
3. Ajoute un peu de crédit sur le compte (quelques euros suffisent pour des mois d'articles quotidiens)

## Étape 3 — Créer un token d'accès Shopify

1. Dans ton admin Shopify → **Paramètres** → **Applications et canaux de vente** → **Développer des applications**
2. Clique sur **Créer une application**, donne-lui un nom (ex. "Blog Auto")
3. Dans **Configuration API Admin**, active les scopes :
   - `write_content`
   - `read_content`
4. Installe l'application, puis récupère le **jeton d'accès Admin API** (il ne s'affiche qu'une seule fois — copie-le immédiatement)

## Étape 4 — Ajouter les secrets dans GitHub

Dans ton dépôt GitHub → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**, ajoute ces 3 secrets :

| Nom | Valeur |
|---|---|
| `ANTHROPIC_API_KEY` | ta clé API Anthropic (étape 2) |
| `SHOPIFY_STORE_DOMAIN` | `novatechgear-2.myshopify.com` |
| `SHOPIFY_ACCESS_TOKEN` | ton jeton Shopify (étape 3) |

## Étape 5 — Tester manuellement

1. Dans ton dépôt GitHub → onglet **Actions**
2. Clique sur le workflow **"Article de blog quotidien"**
3. Clique sur **Run workflow** pour tester immédiatement, sans attendre le lendemain
4. Vérifie dans ton admin Shopify (Boutique en ligne → Blog posts) que l'article est bien apparu

## Fonctionnement automatique

Une fois configuré, le workflow se déclenche **tout seul chaque jour à 9h (heure de Paris)**, même ordinateur éteint, car tout tourne sur les serveurs GitHub. Tu peux changer l'heure en modifiant la ligne `cron` dans `.github/workflows/daily-blog.yml` (format UTC).

Le fichier `content/history.json` garde la trace des articles déjà publiés, pour éviter que l'IA ne se répète.

## Modifier les thématiques

Dans `scripts/generate-and-publish.mjs`, la liste `THEMES` en haut du fichier contient les sujets sur lesquels l'IA pioche au hasard chaque jour. Tu peux en ajouter, en retirer ou en modifier librement.

## Coût estimé

- **GitHub Actions** : gratuit (largement sous le quota gratuit pour un run/jour)
- **API Anthropic** : quelques centimes par article (~1-2€/mois pour 30 articles)
- **Shopify** : aucun coût additionnel, utilise ton plan existant
