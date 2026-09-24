# edition1-team04

Hackathon — application de l'équipe edition1-team04.

## Le problème

Les travailleurs sociaux (AEMO/MJIE) de La Sauvegarde du Nord passent un temps
disproportionné à transformer leurs notes de terrain en rapports structurés
pour le magistrat. Backlog complet : voir la « passation » de l'équipe (hors
de ce dépôt).

## MVP livré : première version de rapport (story P1-1)

Une seule page : on colle ses notes de terrain, on clique sur « Générer une
première version », et un brouillon de rapport structuré (contexte, faits
observés, analyse, préconisations) est généré par un LLM — sans jamais
inventer de fait absent des notes, et en marquant `[à compléter par le
professionnel]` quand une information manque. Ce brouillon n'est jamais présenté
comme final : il doit être relu et validé par le professionnel.

## Stack

Next.js 16 (App Router) + React 19 + TypeScript strict. Le même code sert le
front (port 8080) et l'API (port 8081) — deux instances du même process,
conformément aux deux ports exposés par l'infrastructure de ce hackathon.

- `src/app/page.tsx` — l'écran unique (notes → génération).
- `src/app/api/v1/rapports/generate/route.ts` — endpoint de génération.
- `src/lib/anthropic.ts` — appel au LLM (API Anthropic Messages native,
  `POST $ANTHROPIC_BASE_URL/v1/messages`).
- `src/app/api/health`, `src/app/api/ready` — contrôles de santé.

## Développement local

```bash
npm install
npm run lint
npm test
npm run build
```

Nécessite `ANTHROPIC_BASE_URL` et `ANTHROPIC_API_KEY` dans l'environnement
(fournis par `/etc/hackathon/env` sur la machine du hackathon — jamais commités).

## Lancer les deux ports

```bash
set -a; source /etc/hackathon/env; set +a
npx next start -p 8080 &   # front
npx next start -p 8081 &   # API (même app)
```

Accessible ensuite via `https://edition1-team04.vmxxx.exalt-space.com/` (front)
et `.../api/` (API), une fois le routage de l'infrastructure vérifié.
