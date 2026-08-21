# Le glossaire métier FR / EN

*Écrit le 21/08/2026, au moment du premier versement de vocabulaire.*

Ce document dit **d'où vient chaque terme anglais** du glossaire, et pourquoi
c'est la seule question qui compte. Il n'est pas la liste — la liste vit en base,
dans `reglages.glossaire`, et s'édite dans `/admin`. Il est la **règle de
provenance**, celle qu'une session neuve doit appliquer avant d'ajouter un mot.

---

## 1. Ce que le glossaire est, et ce qu'il n'est pas

Deux magasins, longtemps confondus :

- **le cache** (`reglages.traductions`) range des **chaînes entières** déjà
  traduites. Son rôle est la stabilité : deux ouvertures du même diagnostic
  doivent donner le même libellé, sinon deux captures d'écran de la restitution
  ne coïncident pas. C'est de la machinerie ;
- **le glossaire** (`reglages.glossaire`) range des **termes métier** choisis à
  la main. Il entre dans la consigne du modèle. Son rôle est la fiabilité.

Le glossaire ne remplace jamais un mot dans la sortie du modèle : un
remplacement mécanique casserait les accords (« des usines » → « des plants »).
On demande au modèle d'employer le terme ; la grammaire reste son travail.

**Le glossaire ne contient que des mots et des termes composés courts.** Décision
de l'utilisateur, 21/08 : « je ne veux pas retrouver des groupes de mots et
phrases dans la bibliothèque ». Un libellé de trame (« Reporting de
conformité ») n'y a rien à faire — `libelleIT` s'en occupe à l'affichage.

---

## 2. LA RÈGLE DE PROVENANCE

Trois sources, dans cet ordre de force. Un terme ajouté sans pouvoir nommer sa
source est un terme inventé, et ça ne se voit pas.

### A. Le code livré tranche

`LIBELLES_IT_EN` (`src/lib/mots/envit.ts`), `ECHELLES_EN`, `PERIMETRES_EN`
(`src/lib/maturite.ts`) portent déjà des centaines de mots anglais, **relus par
l'utilisateur et vus à l'écran** lors de la passe navigateur du 21/08.

Quand ces tables donnent un terme, il n'y a rien à arbitrer : le glossaire ne
choisit pas, il **aligne le modèle sur ce qui est déjà en salle**. Sans ça, le
même écran affiche « Workstation framework » dans le bloc IT et « station » dans
l'étape juste dessous.

### B. Le cache, quand il est constant

Si les 363 rendus du cache donnent le même mot plusieurs fois sans variation, le
poser en glossaire ne change rien à l'écran — ça garantit qu'il ne dérivera pas
au prochain lot. Coût nul, bénéfice réel.

### C. Le terme courant de l'industrie, déclaré comme tel

Les mots qu'un consultant écrira au prochain audit et qu'aucune des deux
premières sources ne couvre. Ceux-là **sont une proposition**, et doivent être
présentés comme telle à l'utilisateur, séparés des deux autres catégories. Un
clic dans `/admin` les corrige, et la correction invalide les chaînes du cache
qui les portent.

### Ce qu'on n'ajoute pas

- **Les cognats évidents** — *qualité* → *quality*, *audit* → *audit*,
  *maintenance*, *certification*, *traçabilité*, *capacité*. Un terme que le
  modèle produirait de toute façon n'ajoute rien et coûte une ligne de consigne.
- **Les mots de l'interface.** Le glossaire n'agit que sur le contenu saisi, qui
  seul passe par le modèle. Les mots de l'interface vivent dans `src/lib/mots/`.
- **`Transverse`, `manuel`, `auto`** et tout ce qui est une **valeur en base**.
- **Les termes qui demandent un arbitrage** (§4).

---

## 3. Ce que la mesure du 21/08 a montré

Six termes où le code livré et le modèle se contredisaient, sur le même écran :

| Français | Le code affiche | Le modèle rendait |
|---|---|---|
| charge | workload | load |
| effectif | headcount | staffing |
| aléa | disruption | contingency |
| recyclage | refresher | retraining |
| mode opératoire | work instruction | operating procedure |
| compagnonnage | buddying | shadowing |

Et « poste » sortait en **quatre** rendus : *station* (15 fois), *workstation*
(2), *shift* (1), *on-the-job* (1).

**Une variante orthographique, aussi.** Sur les 363 rendus, 22 portaient une
forme en `-ize` (*authorization*, *standardization*, *capitalization*,
*organized*, *formalized*, *annualized*), plus *organizational* et *program*.
Les 5 formes en `-ise` étaient toutes des mots qui s'écrivent ainsi dans les
deux variantes (*exercise*, *expertise*, *revised*) : le cache était
**uniformément américain**, le code livré **uniformément britannique**. Le bloc
IT affichait « Authorisations » pendant qu'une étape dessous disait « no station
assignment without authorization ».

Ce n'était pas une affaire de glossaire mais une **règle manquante dans la
consigne** — et elle ne se voyait pas terme par terme, seulement en comptant.
Corrigée dans la consigne, puis le cache automatique purgé : toutes ses entrées
avaient été produites sous l'ancienne consigne.

---

## 4. Ce qui attend l'arbitrage de l'utilisateur

Ces termes sont fréquents dans le corpus et **volontairement absents du
glossaire** : leur anglais est un choix métier, pas une déduction.

| Terme | Le problème | Ce que le modèle fait aujourd'hui |
|---|---|---|
| **gamme** | *routing* (gamme de fabrication) ou *product range* ? | « changement de gamme » → « range change », qui se lit mal |
| **îlot** | *cell* est le terme d'atelier, mais rien ne le confirme dans le code | absent du corpus |
| **équipe** | *team* (le collectif) ou *shift* (l'équipe du matin) — les deux sens sont présents dans le corpus | *team* dans les deux cas |
| **geste** | « le geste » au sens du savoir-faire d'exécution : *the task* aplatit le sens | « reconstituer le geste réel » → « reconstruct the actual task » |
| **UP** | unité de production → *production unit (PU)* ? | « selon l'UP » → « depending on PU », non explicité |
| **poste** (sens équipe) | traité par une précision attachée au terme, à confirmer à l'usage | *shift* quand le contexte le porte |

Six mots. Chacun coûte une phrase à l'utilisateur et se pose ensuite une fois
pour toutes.

---

## 5. Les deux métiers de la note

Une entrée du glossaire porte deux textes qui ne se ressemblent pas :

- **`note`** — *pourquoi ce choix*. « Le modèle rendait *load*. » C'est ce qui
  évite de rediscuter le terme dans six mois. Affichée dans `/admin`, **jamais
  envoyée au modèle** : dans une consigne, c'est du bruit.
- **`precision`** — *comment employer le terme*. « Quand « poste » désigne une
  équipe de travail, c'est *shift*. » **Envoyée au modèle**, entre parenthèses.
  Vide dans la grande majorité des cas.

Les confondre marchait à deux termes. À cent trente, la consigne se remplit de
commentaires d'historique.

---

## 6. Les deux pièges du mécanisme

**Le glossaire entier part dans chaque lot.** Il est donc borné, et une borne
dépassée ne doit **jamais** faire perdre la traduction — seulement dégrader la
terminologie. Le premier état du code levait sur dépassement, l'erreur était
avalée par le repli, et **tout le diagnostic restait en français, sans message**.
Un consultant qui ajoute un terme de trop cassait la bascule pour tout le monde.
Si cette borne rebouge un jour, la propriété à préserver est celle-là.

**La reconnaissance d'un terme dans le cache est en base**, pas dans le client :
poser un terme doit rendre caduques les chaînes qui le portent **dans la même
transaction** que l'écriture du terme (`motif_terme`, `invalider_cache_terme`),
sinon un ajout laisse derrière lui un cache qui contredit la consigne.

`motif_terme` tolère deux lettres finales par mot — ce qui attrape les pluriels
et, assumé, quelques faux positifs (« usiner »). La borne de mot est
indispensable : **« business » contient « usine »**.
