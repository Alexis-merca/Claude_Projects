# Recette navigateur — liste de contrôle ordonnée par risque

Première passe navigateur de Diagnostic OS. `INVENTAIRE-FONCTIONNEL.md` liste
158 points ; **ce document n'en retient que 24**, ordonnés non pas par écran
mais par **discrétion de la panne** : ce qui casse sans rien dire d'abord.

Le classement suit un seul critère : *si c'était cassé, combien de temps
faudrait-il pour s'en apercevoir ?* Une erreur affichée à l'écran est bénigne —
on la voit. Une donnée perdue en silence ou un chiffre faux sur un slide client
ne se découvre qu'après coup, et parfois jamais.

**Revu le 18/08/2026.** Le produit a bougé depuis la première rédaction : le
bilan est passé de trois à **quatre** positions, la comparaison à la trame
générique a été **retirée**, et trois surfaces neuves sont apparues (état des
frictions, page « Trajectoire de déploiement », page « Avant / après le
déploiement »). Les points concernés sont corrigés ci-dessous : les faire
tourner dans leur version d'origine aurait produit de **faux échecs**.

**Déjà vérifié, inutile d'y revenir** : le diagramme ne perd plus sa place à
chaque écriture (défaut F, confirmé par l'utilisateur dans le navigateur le
18/08), et l'édition d'un champ fonctionne après le passage aux écritures
gardées.

**Contexte.** Tout ce qui est écrit dans `PASSE-STATIQUE.md` vient de la
lecture du code et de mesures en base. La panne OAuth du 07/08 a montré la
limite de cette méthode : deux passes de lecture avaient produit un diagnostic
cohérent, argumenté et **faux**, qu'une seule copie d'écran a corrigé.

**Avant de commencer.** Travailler sur un diagnostic jetable — dupliquer
`Sekurit` — et **jamais sur `template-use-case` ni `cible-mercateam`**, qui
sont les trames. Ouvrir la console du navigateur et la laisser ouverte : une
partie des contrôles s'y lit.

---

## Niveau 1 — perte de données silencieuse

Le seul niveau où une panne est irréversible. À faire en premier, sur un
diagnostic jetable.

**1.1 — L'instantané avant suppression existe-t-il vraiment ?**
Supprimer un diagnostic dupliqué. Le code appelle `prendreVersion(id,
"avant_suppression_client")` **avant** `deleteClientRow`. Vérifier ensuite que
la version est bien listée et **restaurable**, alors que le client n'existe
plus.
*Signe que c'est faux :* la version n'apparaît nulle part, ou la restauration
échoue. Deux jours de visite terrain sont alors définitivement perdus, et le
dialogue de confirmation promet le contraire.

**1.2 — La restauration d'une version est-elle elle-même annulable ?**
Restaurer une version ancienne sur un diagnostic existant. `restaurer_version`
doit prendre un instantané `avant_restauration` avant d'écraser.
*Signe que c'est faux :* aucune version `avant_restauration` n'apparaît. Une
mauvaise restauration devient alors définitive.

**1.3 — Le réordonnancement n'efface-t-il aucun contenu ?**
Déplacer une étape par glisser-déposer, puis **relire le texte, le rôle, la
phase et les supports de toutes les étapes du processus**.
*Signe que c'est faux :* des champs vidés. C'est le piège documenté dans
`db/schema.sql` — PostgREST remplit par les DEFAULT les colonnes absentes d'un
`upsert`. `reordonner_etapes` ne touche que `ordre` et ne peut pas l'effacer,
mais c'est précisément ce qu'il faut confirmer à l'œil.

**1.4 — La garde de version refuse-t-elle vraiment l'écriture concurrente ?**
Ouvrir le même processus dans deux onglets. Modifier une étape dans l'onglet A,
puis modifier la même dans l'onglet B **sans recharger**.
*Signe que c'est faux :* l'onglet B écrit sans protester et la modification de
A disparaît. C'est le seul comportement que `db/README.md` déclare
« réellement inacceptable ».

**Le contrepoids, tout aussi important :** dans un **seul** onglet, enchaîner
deux modifications sur deux étapes différentes, puis ajouter une friction, puis
la supprimer. *Attendu :* aucun bandeau de conflit. Les écritures gardées
renvoient la version fraîche précisément pour qu'un consultant seul ne se bloque
jamais lui-même ; un bandeau ici voudrait dire que la garde est trop serrée et
l'outil inutilisable à une personne. **Les deux moitiés de ce contrôle valent
ensemble** : l'une sans l'autre ne prouve rien.

**1.5 — La suppression d'une étape détache-t-elle la friction sans l'emporter ?**
Rattacher une friction à une étape, puis supprimer l'étape.
*Signe que c'est faux :* la friction disparaît. La clé composite est en
`on delete set null` sur `etape_id` : le constat de terrain doit survivre à la
carte qu'il désignait.

**1.6 — Une trame ne peut pas être supprimée par mégarde.**
Sur `template-use-case`, la corbeille doit être **désactivée** avec son
infobulle. Tenter ensuite de marquer un second diagnostic en trame « existant ».
*Attendu :* refus, avec le message « "Template use case" est déjà la trame
"existant". Sortez-la des trames avant d'en désigner une autre. »

---

## Niveau 2 — le livrable est faux sans le dire

Ce qui part en restitution client. Une erreur ici ne se voit pas à l'écran :
elle se voit dans la salle, devant l'industriel.

**2.1 — Le schéma d'échanges est-il déterministe ?**
Ouvrir un diagnostic, capturer le schéma, **recharger la page**, comparer.
Recommencer dans un autre navigateur ou une fenêtre privée.
*Signe que c'est faux :* les boîtes ont bougé. `schema-outils.ts` s'ouvre sur
un engagement explicite de reproductibilité — « les mêmes données doivent
produire exactement la même image, à chaque chargement et sur chaque poste ».
Jamais vérifié.

**2.2 — L'estompage survit-il à l'impression ?**
Sur `template-use-case`, la mosaïque doit montrer **6 outils estompés sur 14**
(Excel, Mail, Oral, Papier, Word, PowerPoint) et la légende « Les outils
estompés servent dans plusieurs blocs. » Passer en aperçu avant impression.
*Signe que c'est faux :* l'estompage disparaît (opacité souvent perdue à
l'impression) ou la légende saute. Le lecteur voit alors six fois le même outil
sans savoir que c'est le même.

**2.3 — L'estompage et la légende survivent-ils au PPTX ?**
Même contrôle après export.
*Signe que c'est faux :* même conséquence, sur le support qui circule le plus.

**2.4 — L'« après déploiement » montre-t-il encore l'ERP ?**
**Le contrôle le plus important de cette liste** : ce code a été changé le
07/08 et **une seule étape est marquée dans toute la base**. Marquer en
« Mercateam » quelques étapes portant `Logiciel (ERP)` ou
`Logiciel (SIRH / GTA)`, puis regarder la mosaïque « Après déploiement
Mercateam ».
*Attendu :* l'ERP et le SIRH **restent visibles**, à côté de Mercateam, et une
flèche `Mercateam ↔ Logiciel (ERP)` apparaît dans le schéma.
*Signe que c'est faux :* il ne reste que Mercateam. C'est le défaut corrigé
(§28) — un site sans ERP, ce qu'un industriel repère immédiatement.

**2.5 — Les quatre positions du bilan font-elles ce qu'elles annoncent ?**
« supprimée » : l'étape disparaît de l'« après ». « inchangée » : elle reste
**avec ses supports d'origine**. **« en cours » : elle reste elle aussi avec ses
supports d'origine**, exactement comme « inchangée » — c'est délibéré, la
projection ne montre que l'acquis.
*Signe que c'est faux :* une « inchangée » ou une « en cours » perd ses outils,
une « supprimée » subsiste, ou une « en cours » est traitée comme migrée — ce
qui gonflerait l'« après » et le rendrait flatteur et faux.

**2.5 bis — La distinction tient-elle SANS la couleur ?** Imprimer une page
portant les quatre marques, **en noir et blanc**. *Attendu :* « Mercateam »
contour plein, « en cours » contour **pointillé**, « supprimée » texte
**barré**, « inchangée » sans contour.
*Signe que c'est faux :* deux états indiscernables. C'est l'invariant le plus
ancien du projet, et le seul que l'impression peut casser sans que l'écran le
montre.

**2.10 — La page « Avant / après le déploiement » dit-elle vrai ?**
Poser une maturité d'audit **et** une maturité de bilan sur un processus, y
marquer des étapes, puis imprimer.
*Attendu :* la ligne de maturité affiche deux valeurs **différentes** — celle de
l'audit puis celle du bilan.
*Signe que c'est faux :* « 2 → 2 ». La page comparerait alors la maturité
d'audit avec elle-même. **Ce chemin n'a jamais été exercé** : aucun processus ne
porte les deux maturités, la ligne ne s'affiche donc jamais.

**2.11 — La page « Trajectoire de déploiement » reste-t-elle lisible ?**
Renseigner une dizaine de cibles, dont une longue, puis imprimer.
*Attendu :* une page par tranche de 12 étapes, corps lisible.
*Signe que c'est faux :* texte minuscule. Le seuil de 12 lignes est un **calcul,
jamais une mesure**, et le texte de l'étape n'y est pas tronqué.

**2.12 — L'état des frictions sort-il à l'impression ?**
Marquer des frictions « résolue » et « toujours d'actualité », puis imprimer.
*Attendu :* les résolues barrées et étiquetées, les persistantes étiquetées.
*Signe que c'est faux :* aucune distinction sur le papier — la couleur seule
n'aurait pas survécu.

**2.6 — Le multi-blocs se voit-il correctement dans la mosaïque ?**
Sur `template-use-case`, Excel doit apparaître dans **6 blocs**, Mail 5, Oral
5, Papier 5, Word 4, PowerPoint 2 — et **une seule boîte Excel** dans le schéma
d'échanges.
*Signe que c'est faux :* Excel dans un seul bloc (le correctif n'a pas pris),
ou six boîtes Excel dans le schéma (les flèches deviennent illisibles et
mentent).

**2.7 — « Non classé » contient-il bien ce qu'il doit ?**
Sur `template-use-case` : `Au jugé` et `Logiciel` doivent y rester ; PowerPoint
**ne doit plus y être**.
*Corrigé le 18/08 :* l'attendu citait aussi `TV / écran atelier`, **qui n'existe
pas dans `template-use-case`** — l'unique étape qui le porte est dans
`cible-mercateam`. Erreur de la recette, pas du produit ; c'est la passe
elle-même qui l'a mise au jour.
*Signe que c'est faux :* PowerPoint en « Non classé » — la collision
`erp` / Pow**erp**oint serait revenue.

**2.8 — L'échelle d'impression converge-t-elle ?**
Imprimer un diagnostic à 10 processus. Vérifier qu'aucun diagramme n'est coupé
ni réduit au point d'être illisible.
*Signe que c'est faux :* texte des cartes illisible, ou colonnes tronquées.

**2.9 — Les lignes vides disparaissent-elles à l'impression ?**
`sansLignesVides` doit retirer lignes et blocs sans outil.
*Signe que c'est faux :* des lignes « aucun outil » sur le document client —
elles diraient « ce site ne le fait pas », ce qui est faux.

---

## Niveau 3 — la fonctionnalité ne marche pas, et ça se voit

Panne visible, donc moins grave : on la découvre en l'utilisant. À faire quand
même, car ce sont les chemins les plus fréquents.

**3.1 — Créer un site depuis la trame.** « Nouveau client », cocher 3 use
cases. *Attendu :* trois onglets pré-remplis avec les étapes de la trame, leurs
rôles et leurs supports. **Sans maturité ni bilan** — ils appartiennent au
site, pas à la trame.

**3.2 — Le renommage d'un processus ne casse pas le rattachement.** Renommer
« UC 7 » en « Habilitations Sekurit », recharger, puis créer un nouveau site en
cochant ce use case : il doit se pré-remplir depuis la trame. Le rattachement
passe par `use_case`, jamais par le nom.
*Note :* ce point testait à l'origine la comparaison à la trame cible,
**retirée le 18/08** — un audit Mercateam n'est pas générique.

**3.10 — Les deux boutons d'ajout fonctionnent-ils ?** « Ajouter une friction »
et « ajouter un chiffre clé ». *Attendu :* une ligne apparaît, portant
« À préciser ».
*Signe que c'est faux :* une erreur. Ces deux boutons **n'ont jamais pu
fonctionner** jusqu'au 17/08 — les contraintes de base rejetaient les champs
vides qu'ils envoyaient, et personne ne s'en était aperçu.

**3.3 — Les pastilles de friction sur les cartes du diagramme.** Jamais
vérifiées (§17.6). Rattacher une friction à une étape, la pastille doit
apparaître sur la bonne carte.

**3.4 — La maturité.** Poser un niveau 1 à 5 sur un processus : le libellé de
l'échelle du use case doit s'afficher. Sur un processus **sans** use case,
aucun libellé ne doit apparaître — pas de repli inventé.

**3.5 — Éditer l'environnement IT.** Déplacer un outil d'une ligne à l'autre,
en ajouter un à la main, en retirer un. Recharger : les trois doivent tenir.
**Aucun diagnostic ne porte de correction aujourd'hui** — ce chemin n'a jamais
été exercé sur des données réelles.

**3.6 — « Recalculer ».** Doit effacer les corrections et les ajustements de
flèches, **garder la structure et les positions**. Un instantané de version
doit être pris avant.

**3.7 — Déplacer une boîte du schéma.** Le placement manuel doit survivre au
rechargement, et « Replacer automatiquement » doit tout remettre au calcul
après confirmation.

**3.8 — Le glisser-déposer des étapes.** Contrôle d'usage, distinct de 1.3 qui
portait sur la perte de contenu.

**3.9 — L'import / export JSON.** Exporter un diagnostic, le réimporter en
nouveau. *Attendu :* même nombre de processus, d'étapes, de frictions et de
chiffres.

---

## Ce que cette liste ne couvre pas

**La concurrence réelle à deux personnes.** 1.4 la simule avec deux onglets,
ce qui teste la garde de version mais pas l'usage à deux consultants sur site.

**Le rendu sur petit écran.** Aucun contrôle ici : l'outil est conçu pour un
portable en salle, ce qui reste à confirmer.

**Les 134 autres points de `INVENTAIRE-FONCTIONNEL.md`**, volontairement.
Cette liste est une première passe ordonnée par risque, pas un inventaire
exhaustif — un inventaire exhaustif ne se fait pas, et c'est pour cela qu'il
n'a jamais été fait.

---

## Pourquoi l'agent Lovable ne peut pas faire cette passe — 20/08/2026

Chaque rapport d'envoi se termine par `LOVABLE_BROWSER_AUTH_STATUS = signed_out`.
Ce n'est pas un incident passager : **c'est structurel**, et il faut cesser de
l'espérer d'un envoi à l'autre.

L'application n'a qu'une seule porte d'entrée, `CarteConnexion.tsx` : un bouton
**« Continuer avec Google »**, plus une liste d'adresses autorisées — un compte
hors liste reçoit « adresse refusée ». Il n'y a ni mot de passe, ni lien magique.
Or :

- **OAuth Google ne s'automatise pas** depuis un navigateur sans tête : Google
  détecte l'automatisation, exige souvent un second facteur, et le parcours
  quitte le domaine de l'application. Il n'y a aucune chaîne à taper.
- **Se connecter soi-même ne sert à rien** : l'agent tourne son propre
  navigateur, dans son bac à sable, avec son propre pot à cookies. La session
  ouverte sur le poste de l'utilisateur ne l'atteint pas.

Trois issues, avec leur coût :

1. **L'utilisateur fait la passe.** C'est l'objet de ce document. Coût : son
   temps. Aucun risque.
2. **Lui transmettre une session vivante** (le jeton Supabase du navigateur, à
   réinjecter dans le stockage local de l'agent). Techniquement possible, mais
   c'est remettre un identifiant valide donnant accès à des données clients, et
   il expire en une heure.
3. **Ouvrir une connexion par mot de passe pour un compte de service**, limité
   à la liste d'autorisation. C'est la seule voie durable vers une recette
   automatisée — et elle ajoute une surface d'authentification à un outil qui
   porte des relevés clients. À ne faire que si la recette automatisée devient
   un vrai besoin, pas pour dépanner une passe.

**En attendant, la règle de lecture des rapports d'envoi ne change pas** :
tout ce qui est annoncé sans copie d'écran est établi *par lecture*. Cette
passe reste due.
