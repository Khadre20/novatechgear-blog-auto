import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const SHOPIFY_STORE = process.env.SHOPIFY_STORE_DOMAIN; // ex: novatechgear-2.myshopify.com
const SHOPIFY_CLIENT_ID = process.env.SHOPIFY_CLIENT_ID;
const SHOPIFY_CLIENT_SECRET = process.env.SHOPIFY_CLIENT_SECRET;
const BLOG_GID = process.env.SHOPIFY_BLOG_GID || 'gid://shopify/Blog/104173011174';

// Récupère un jeton d'accès temporaire (valable 24h) via le flux client_credentials,
// le système d'authentification standard pour les apps Dev Dashboard depuis 2026.
async function getShopifyAccessToken() {
  const res = await fetch(`https://${SHOPIFY_STORE}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: SHOPIFY_CLIENT_ID,
      client_secret: SHOPIFY_CLIENT_SECRET,
    }),
  });

  if (!res.ok) {
    throw new Error(`Erreur d'authentification Shopify: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  return data.access_token;
}

const HISTORY_PATH = path.join(__dirname, '..', 'content', 'history.json');

const THEMES = [
  'accessoires tech pour smartphone',
  'astuces batterie et autonomie mobile',
  'actualités et tendances MagSafe / charge sans fil',
  'guide d\'achat powerbank magnétique',
  'voyage et tech nomade',
  'comparatif charge rapide vs charge sans fil',
  'entretien et durée de vie des batteries',
  'accessoires bureau et télétravail tech',
  'accessoires voiture et charge en mobilité',
  'tendances gadgets tech du moment',
];

function loadHistory() {
  try {
    return JSON.parse(fs.readFileSync(HISTORY_PATH, 'utf-8'));
  } catch {
    return [];
  }
}

function saveHistory(history) {
  fs.writeFileSync(HISTORY_PATH, JSON.stringify(history, null, 2));
}

async function generateArticle(history) {
  const recentTitles = history.slice(-30).map((h) => h.title).join(' | ') || 'Aucun';
  const theme = THEMES[Math.floor(Math.random() * THEMES.length)];

  const systemPrompt = `Tu es un rédacteur SEO senior pour NovaTech Gear, une boutique Shopify française (novatechgear-2.myshopify.com) spécialisée dans les powerbanks magnétiques MagSafe et accessoires tech mobiles. Ton style est premium, technique mais accessible, en français, ton de marque expert et rassurant.

Thématique du jour : ${theme}.
Titres déjà publiés récemment (ne répète pas les mêmes angles) : ${recentTitles}

Réponds UNIQUEMENT avec un objet JSON valide (aucun texte avant/après, pas de balises markdown), avec exactement cette structure :
{
  "title": "titre H1 de l'article, accrocheur, SEO, max 70 caractères",
  "meta_title": "balise title SEO, max 60 caractères",
  "meta_description": "balise meta description SEO, 150-160 caractères, incitant au clic",
  "slug": "url-slug-en-minuscules-avec-tirets",
  "tags": ["tag1", "tag2", "tag3"],
  "body_html": "le corps complet de l'article en HTML valide : une introduction (<p>...</p>), six sections de développement chacune avec un sous-titre <h2> suivi de 2-4 paragraphes <p> de contenu utile et concret, une conclusion (<h2>Conclusion</h2><p>...</p>), puis une section FAQ (<h2>FAQ</h2>) avec exactement 10 questions en <h3> suivies chacune d'une réponse en <p>. Contenu réel, informatif, naturellement optimisé SEO, sans bourrage de mots-clés, sans placeholder."
}`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 8000,
      system: systemPrompt,
      messages: [{ role: 'user', content: "Génère l'article du jour au format JSON demandé." }],
    }),
  });

  if (!res.ok) {
    throw new Error(`Erreur API Anthropic: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  const textBlock = data.content.find((b) => b.type === 'text');
  if (!textBlock) throw new Error('Pas de réponse texte de Claude');

  let jsonText = textBlock.text.trim();
  jsonText = jsonText.replace(/^```json\s*/i, '').replace(/```\s*$/i, '');

  return JSON.parse(jsonText);
}

async function publishToShopify(article, accessToken) {
  const mutation = `
    mutation articleCreate($article: ArticleCreateInput!) {
      articleCreate(article: $article) {
        article { id title handle }
        userErrors { field message }
      }
    }
  `;

  const variables = {
    article: {
      blogId: BLOG_GID,
      title: article.title,
      handle: article.slug,
      body: article.body_html,
      tags: article.tags,
      isPublished: true,
      author: { name: 'NovaTech Gear' },
      metafields: [
        {
          namespace: 'global',
          key: 'title_tag',
          type: 'single_line_text_field',
          value: article.meta_title,
        },
        {
          namespace: 'global',
          key: 'description_tag',
          type: 'single_line_text_field',
          value: article.meta_description,
        },
      ],
    },
  };

  const res = await fetch(`https://${SHOPIFY_STORE}/admin/api/2024-10/graphql.json`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'X-Shopify-Access-Token': accessToken,
    },
    body: JSON.stringify({ query: mutation, variables }),
  });

  const data = await res.json();

  if (data.errors) {
    throw new Error(`Erreurs GraphQL: ${JSON.stringify(data.errors)}`);
  }

  const errors = data.data?.articleCreate?.userErrors;
  if (errors && errors.length > 0) {
    throw new Error(`Erreurs Shopify: ${JSON.stringify(errors)}`);
  }

  return data.data.articleCreate.article;
}

async function main() {
  if (!ANTHROPIC_API_KEY || !SHOPIFY_STORE || !SHOPIFY_CLIENT_ID || !SHOPIFY_CLIENT_SECRET) {
    throw new Error(
      "Variables d'environnement manquantes: ANTHROPIC_API_KEY, SHOPIFY_STORE_DOMAIN, SHOPIFY_CLIENT_ID, SHOPIFY_CLIENT_SECRET"
    );
  }

  const history = loadHistory();

  console.log("Génération de l'article...");
  const article = await generateArticle(history);

  console.log("Authentification Shopify...");
  const accessToken = await getShopifyAccessToken();

  console.log(`Publication de "${article.title}" sur Shopify...`);
  const published = await publishToShopify(article, accessToken);

  history.push({
    date: new Date().toISOString(),
    title: article.title,
    handle: published.handle,
    id: published.id,
  });
  saveHistory(history);

  console.log(`✅ Article publié: ${published.handle}`);
}

main().catch((err) => {
  console.error('❌ Erreur:', err.message);
  process.exit(1);
});
