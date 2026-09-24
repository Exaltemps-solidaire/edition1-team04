# Architecture Decision Record

## 2026-09-24 — Rendu Markdown du rapport via `react-markdown`

**Décision** : afficher le rapport généré par le LLM avec `react-markdown` plutôt qu'en texte brut (`white-space: pre-wrap`).

**Contexte** : le prompt système demande au modèle une sortie structurée en Markdown (titres `#`/`##`, gras, listes, séparateurs `---`). Affichée en texte brut, cette syntaxe restait visible telle quelle (`**`, `##`...), illisible pour l'utilisateur final.

**Alternatives considérées** :
- `dangerouslySetInnerHTML` avec un parseur Markdown → HTML côté client : rejeté, la sortie vient d'un LLM (contenu non fiable), risque XSS direct.
- Écrire un mini-parseur Markdown maison pour le sous-ensemble utilisé (titres, gras, listes) : évite une dépendance mais duplique un problème déjà résolu, fragile si le modèle varie son formatage.
- `react-markdown` (choisi) : rendu en arbre React (pas d'`innerHTML`), pas de faille XSS par construction, dépendance légère et largement maintenue.

**Conséquences** : nouvelle dépendance `react-markdown` (~84 paquets transitifs). Le surlignage des placeholders `[à compléter par le professionnel...]` est implémenté via un `components` override (`p`, `li`, `strong`, `em`) plutôt qu'un plugin `rehype-raw`, pour ne jamais interpréter de HTML brut renvoyé par le modèle.

## 2026-09-24 — Brouillon des notes persisté en `localStorage`

**Décision** : sauvegarder automatiquement (debounce 500 ms) le contenu de la zone de notes dans le `localStorage` du navigateur, et le restaurer au chargement de la page.

**Contexte** : une perte accidentelle de la zone de notes (fermeture d'onglet, rechargement) forçait l'utilisateur à ressaisir tout son travail de terrain — aucune sauvegarde côté serveur n'existe pour ce brouillon avant génération.

**Alternatives considérées** :
- Persistance côté serveur (base de données) : hors périmètre du MVP, nécessite authentification/session pour associer un brouillon à un utilisateur.
- Pas de persistance : rejeté, perte de données trop coûteuse pour l'utilisateur (notes de terrain potentiellement longues).

**Conséquences** : les notes de terrain (données sensibles concernant des mineurs) restent uniquement dans le navigateur de l'utilisateur, jamais transmises tant que "Générer" n'est pas cliqué — pas de nouvelle surface d'exposition réseau. Le brouillon est effacé automatiquement dès que la zone de notes est vidée.
