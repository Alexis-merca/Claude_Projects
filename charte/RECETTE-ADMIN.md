# Recette de l'écran d'administration

*Écrite le 24/08/2026, après la livraison des quatre onglets.*

Version cliquable, avec suivi de progression :
<https://claude.ai/code/artifact/a7a73cf4-e808-4757-9f45-8f05c2ef7594>

Vingt-six vérifications, dans l'ordre. Chacune dit **ce qu'on fait** et **ce
qu'on doit voir**. Ce document est la copie durable : l'artifact peut
disparaître, le dépôt reste.

---

## Avant de commencer

- Ouvrir `mercaudit.lovable.app`, puis l'écran d'administration par le bouton
  **Réglages**, en haut à droite de la liste des clients.
- **Quelqu'un d'autre travaille peut-être dans la base en même temps.** Un
  compte qui ne tombe pas juste à une unité près n'est pas forcément un défaut —
  c'est le premier endroit à regarder avant de le signaler.
- **Trois vérifications touchent une donnée réelle** (5, 16, 17, plus 22 dont la
  remise en état est la 24). Chacune dit quoi remettre. Toutes sont enregistrées
  dans l'historique des versions.

---

## Traductions — 1 à 6

1. **L'écran s'ouvre.** Liste des clients → *Réglages*. → Quatre onglets :
   Traductions, Outils, Clients et sites, Trames et maturité.
2. **Deux colonnes.** Onglet *Traductions*. → **135 termes**, et seulement
   *Français* et *Anglais*. Les colonnes « Pourquoi ce choix » et « Comment
   l'employer » ne sont plus dans la liste.
3. **La recherche.** Chercher `poste`. → Au moins *poste*, *fiche de poste*,
   *prise de poste*, *fin de poste*.
4. **Les deux champs ne sont pas perdus.** Crayon sur `poste`. → Sous la ligne,
   deux champs étiquetés ; celui de droite porte « quand « poste » désigne une
   équipe de travail […] c'est « shift » ». C'est lui qui part au modèle.
   Refermer sans modifier.
5. **Corriger dit ce que ça invalide.** Passer l'anglais de `tableur` à
   *spreadsheets*. → Un message chiffre les chaînes du cache devenues caduques.
   **À remettre : `tableur` → *spreadsheet*.**
6. **La carte d'entretien du cache.** La regarder, **sans cliquer sur la
   purge**. → Un compte très bas, 2 ou 3. Des centaines seraient un défaut.

## Outils — 7 à 12

7. **La bibliothèque est vide, et c'est voulu.** → Aucune entrée : tant qu'elle
   est vide, le classement est exactement celui d'avant.
8. **La liste de travail.** Les outils non classés, tous sites confondus. → Les
   huit de Décathlon : *Decathlon University, Effitime, EFIplan, MyGame,
   GPLine, PeopleSync, Info Sociale, Site des formateurs*.
9. **Ranger un outil.** `Effitime` → bloc *SIRH & GTA*, activité *Absences*. →
   Il quitte la liste. Bloc et activité se choisissent dans des listes, jamais
   en texte libre.
10. **Le rangement se voit chez le client.** `Décathlon / Retail` →
    *Environnement IT*. → *Effitime* dans *SIRH & GTA*, ligne *Absences*.
    **Garder ce rangement** : il est juste.
11. **Le travail à la main n'est pas écrasé.** `Danone / Bailleul` →
    *Environnement IT*. → *AWMS*, *Pixid*, *Kahoot*, *Master Data* là où ils
    avaient été rangés à la main.
12. **Un motif trop court est refusé.** Tenter le motif `it`. → Refus avec une
    raison lisible.

## Clients et sites — 13 à 18

13. **Cinq clients, pas neuf lignes.** → *Danone*, *Décathlon*, *Safran*,
    *Saint gobain*, *Test 06/08*. Les deux trames à part.
14. **Les sites se déplient.** → Saint gobain : un site, *Sekurit float
    france*. Safran : deux, *Fougères* et *Montluçon*, avec leurs dates.
15. **L'adresse n'a pas suivi le renommage.** Ouvrir Sekurit depuis l'onglet. →
    `/clients/sekurit-float-france`. Voulu : 54 instantanés d'historique y
    pointent.
16. **Renommer un client emporte tous ses sites.** *Safran* → `Safran Group`. →
    Les **deux** sites suivent d'un coup, jamais un seul. **À remettre tout de
    suite : `Safran`.**
17. **Renommer un site.** *Montluçon* → `Montluçon 2`. → Seul ce site change.
    **À remettre tout de suite : `Montluçon`.**
18. **Le client n'est plus un champ libre.** *Nouveau client* → choisir
    *Saint gobain*, taper `Sekurit float france`. → Le client se choisit dans
    une liste, et le doublon de site est signalé **avant** l'envoi. **Fermer
    sans créer.**

## Trames et maturité — 19 à 24

19. **Les deux trames.** → *Template use case* et *… cible Mercateam*, avec ce
    qu'elles portent (10 use cases, 141 et 109 étapes). Le lien les ouvre comme
    des diagnostics ordinaires.
20. **Une échelle, deux langues.** Choisir `uc1`. → FR et EN côte à côte :
    intitulé, cinq niveaux numérotés 1 à 5, périmètre. **Les numéros ne se
    modifient pas.**
21. **La mesure de départ.** Avant toute modification : `Test 06/08`, onglet
    « Planification des opérateurs et gestion des aléas », bascule FR → EN. →
    Le nom devient *Operator scheduling and disruption handling*.
22. **Le piège — la vérification qui compte le plus.** Dans l'admin, ajouter
    ` (test)` à l'intitulé français de `uc1`. Rouvrir `Test 06/08`, basculer
    FR → EN. → **Le nom suit toujours la langue.** S'il reste figé en français,
    c'est le défaut : le signaler et ne plus corriger aucun intitulé.
23. **Les notes de maturité n'ont pas bougé.** `Danone / Bailleul`, use case 1.
    → Toujours **3**. La note est un entier, réécrire les textes ne l'atteint
    pas.
24. **Revenir au libellé livré.** Sur `uc1`. → Le ` (test)` disparaît partout,
    le repère de retouche s'efface, et `Test 06/08` retrouve son nom d'origine.

## Transverse — 25 et 26

25. **L'écran lui-même est traduit.** Basculer en anglais, reparcourir les
    quatre onglets. → Tout est traduit. Les **termes** du glossaire restent
    tels quels : c'est de la donnée, pas de l'interface.
26. **Rien n'a bougé dans les diagnostics.** Ouvrir Sekurit, Danone,
    Décathlon. → Relevés intacts. Le seul changement voulu de la passe est
    *Effitime*, rangé à la vérification 10.

---

## Ce qui n'est pas un défaut

- Dans les deux **trames**, les processus s'appellent « UC 1 — … ». Ces noms ont
  été saisis à la main : l'application les traite comme du contenu et ne les
  traduit pas. C'est la règle de `nomProcessusAffiche`, pas une panne.
- Chez **Décathlon**, le use case 1 s'appelle « Operational planning and
  workload and capacity management » — renommé à la main, donc affiché tel quel
  dans les deux langues.
- Un **compte qui diffère d'une unité** : quelqu'un d'autre travaille peut-être
  dans la base pendant la passe.
- Un **libellé anglais perfectible** : c'est un arbitrage de vocabulaire, pas un
  défaut. À noter à part — il se corrige en un clic dans l'onglet Traductions,
  et une seule fois pour tous les sites.
