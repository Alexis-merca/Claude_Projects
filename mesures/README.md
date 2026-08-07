# Mesures

Scripts qui rejouent la logique de l'application **hors de l'application**,
pour produire les chiffres attendus d'une recette avant de l'envoyer à Lovable.

Le principe est toujours le même : recopier la règle depuis le code source,
la rejouer sur les données réelles, et comparer. Une recette dont les chiffres
sortent du code qu'elle est censée vérifier ne vérifie rien.

## `multibloc.py`

Rejoue `classer()` de `src/lib/environnement-it.ts` — tables A et B, liste des
génériques, correspondance en début de mot — et compte, diagnostic par
diagnostic, les outils qui **tomberaient dans plusieurs blocs** si le placement
n'était pas unique.

```
python3 multibloc.py rows.json
```

`rows.json` : `[{client, processus, supports}, …]`, une entrée par étape.

## `recette.py`

Compare deux états du classement sur les trois diagnostics de référence :

- **avant** — placement unique, bloc deviné depuis le nom du processus ;
- **après** — placement par couple (outil, bloc), bloc du processus catalogué
  tiré de sa clef de use case.

Il reconstruit la trame des blocs et le remplissage de `vueEnvIT` pour rendre
les six chiffres de la recette : outils, placements, placements « Non classé »,
activités, activités renseignées, boîtes du schéma.

```
python3 recette.py
```

Les données viennent de `../trames/*.json` pour `template-use-case` et
`cible-mercateam` ; celles de `sekurit-float-france` sont relevées en base et
recopiées dans le script, faute d'export.

## Ce qu'ils ne font pas

Ils ne lisent pas le code de l'application : les tables y sont **recopiées à la
main**. C'est délibéré — une divergence entre la copie et l'original est
exactement ce qu'on veut voir apparaître à la relecture. En contrepartie, il
faut les remettre à jour quand `environnement-it.ts` change.
