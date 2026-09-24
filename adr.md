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

## 2026-09-24 — Export du rapport en Word (.doc) et PDF sans nouvelle dépendance

**Décision** : ajouter deux exports supplémentaires à côté du `.txt` existant — un fichier `.doc` (enveloppe HTML compatible Word/LibreOffice, générée à partir du `innerHTML` déjà rendu par `react-markdown`) et un export PDF via `window.print()`, qui réutilise la feuille de style `@media print` déjà en place.

**Contexte** : le `.txt` exporte la chaîne Markdown brute (`**`, `##`...), illisible telle quelle. Le rapport doit ensuite être "relu, corrigé et validé" par le professionnel (souvent dans Word) avant envoi à un magistrat — il faut donc au moins un format éditable qui conserve la mise en forme, et idéalement un format figé pour un envoi/archivage.

**Alternatives considérées** :
- Bibliothèque de génération `.docx` réelle (ex. `docx`, `html-to-docx`) : format plus propre et standard, mais nouvelle dépendance non négligeable pour un besoin déjà couvert par un format plus simple.
- Bibliothèque de génération PDF côté client (ex. `jspdf`, `pdfmake`) : dupliquerait la mise en forme déjà définie en CSS d'impression, dépendance supplémentaire pour un résultat pas forcément meilleur que "Imprimer → Enregistrer en PDF".
- Astuce HTML "Office" (choisie pour le .doc) : `<html>` avec les espaces de noms `urn:schemas-microsoft-com:office:*` et un BOM UTF-8, servi avec le type MIME `application/msword` — Word et LibreOffice l'ouvrent nativement en préservant titres, gras, listes et le surlignage des `[à compléter par le professionnel]`. Aucune dépendance, réutilise le DOM déjà rendu.
- `window.print()` (choisi pour le PDF) : réutilise la feuille `@media print` déjà écrite pour l'impression papier ; l'utilisateur choisit "Enregistrer au format PDF" comme destination dans la boîte de dialogue native du navigateur.

**Conséquences** : le fichier `.doc` produit n'est pas un vrai OOXML (juste un déguisement HTML reconnu par Word) — suffisant pour de l'édition ponctuelle, mais à ne pas présenter comme un `.docx` "propre" si l'équipe veut un jour l'intégrer à un pipeline documentaire plus large. Le PDF dépend de la boîte de dialogue d'impression du navigateur du visiteur (pas de bouton "télécharger" direct) ; c'est un compromis accepté pour éviter toute nouvelle dépendance.
