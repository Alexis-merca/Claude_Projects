#!/usr/bin/env node
// ============================================================================
// Diagnostic OS — migration d'un export JSON vers la base partagée
//
//   node db/migrer.mjs diagnostic-sekurit.json > charger.sql
//   psql "$DATABASE_URL" -f charger.sql
//
// Lit le paquet produit par « Exporter en JSON » et écrit le SQL qui le
// charge. Le SQL n'est pas exécuté ici : il est imprimé, donc relisible avant
// d'être appliqué à une base partagée.
//
// Rejouable : chaque client est supprimé par son `code` avant d'être réinséré,
// et le tout tient dans une transaction. Une migration interrompue ne laisse
// pas la base à moitié chargée.
//
// Le script ne fait confiance à rien : il ne recopie que les champs attendus,
// dans la forme attendue. Un fichier bancal donne un chargement incomplet,
// jamais du SQL malformé.
// ============================================================================

import { readFileSync } from 'node:fs';

const net = (v) => (v == null ? '' : String(v)).trim();

/** Littéral texte. Le doublement de l'apostrophe est la seule échappe requise :
    `standard_conforming_strings` est actif par défaut depuis PostgreSQL 9.1,
    l'antislash n'a donc pas de sens particulier. */
const txt = (v) => `'${net(v).replace(/'/g, "''")}'`;

/** `array[...]::text[]` plutôt qu'un littéral `'{...}'` : pas de question
    d'échappement des virgules, des accolades ni des guillemets. */
const tableau = (liste) => {
  const items = (Array.isArray(liste) ? liste : []).map(net).filter(Boolean);
  return items.length ? `array[${items.map(txt).join(', ')}]::text[]` : `'{}'::text[]`;
};

const json = (v) => (v == null ? 'null' : `${txt(JSON.stringify(v))}::jsonb`);

const LIENS = ['', 'manuel', 'auto'];

function clientsDuPaquet(donnees) {
  if (Array.isArray(donnees)) return donnees;
  if (!donnees || typeof donnees !== 'object') return [];
  if (Array.isArray(donnees.clients)) return donnees.clients;
  if (donnees.client && typeof donnees.client === 'object') return [donnees.client];
  return [donnees];
}

function etapesDe(brut) {
  return (Array.isArray(brut.etapes) ? brut.etapes : [])
    .map((et) => {
      if (!et || typeof et !== 'object') return null;
      const role = net(et.role);
      const texte = net(et.texte);
      if (!role && !texte) return null;
      const role2 = net(et.role2);
      const lien = net(et.lien);
      return {
        role,
        texte,
        role2: role2 === role ? '' : role2,
        phase: net(et.phase),
        supports: Array.isArray(et.supports)
          ? et.supports.map(net).filter(Boolean).join(', ')
          : net(et.supports),
        lien: LIENS.includes(lien) ? lien : ''
      };
    })
    .filter(Boolean);
}

function sqlProcessus(brut, rang, lignes) {
  const etapes = etapesDe(brut);

  // Les couloirs du diagramme sont bâtis sur `roles` : tout rôle cité par une
  // étape doit y figurer. La base le vérifie et refuserait le chargement — on
  // complète ici plutôt que d'échouer sur un export ancien.
  const roles = [];
  const noter = (r) => { const v = net(r); if (v && !roles.includes(v)) roles.push(v); };
  (Array.isArray(brut.roles) ? brut.roles : []).forEach(noter);
  etapes.forEach((et) => { noter(et.role); noter(et.role2); });

  const nom = net(brut.nom) || 'Processus importé';
  lignes.push(
    `  insert into processus (client_id, code, nom, soustitre, roles, rang)`,
    `  values (v_client, ${txt(net(brut.id) || nom)}, ${txt(nom)}, ${txt(brut.soustitre)},`,
    `          ${tableau(roles.length ? roles : ['RH'])}, ${rang})`,
    `  returning id into v_proc;`
  );

  if (etapes.length) {
    lignes.push(`  insert into etapes (processus_id, ordre, role, role2, texte, phase, supports, lien) values`);
    lignes.push(etapes.map((et, i) =>
      `    (v_proc, ${i + 1}, ${txt(et.role)}, ${txt(et.role2)}, ${txt(et.texte)},`
      + ` ${txt(et.phase)}, ${txt(et.supports)}, ${txt(et.lien)})`).join(',\n') + ';');
  }

  const frictions = (Array.isArray(brut.frictions) ? brut.frictions : [])
    .map((f) => (f && typeof f === 'object'
      ? { role: net(f.role) || 'Transverse', texte: net(f.texte) } : null))
    .filter((f) => f && f.texte);
  if (frictions.length) {
    lignes.push(`  insert into frictions (processus_id, rang, role, texte) values`);
    lignes.push(frictions.map((f, i) =>
      `    (v_proc, ${i + 1}, ${txt(f.role)}, ${txt(f.texte)})`).join(',\n') + ';');
  }

  const chiffres = (Array.isArray(brut.chiffres) ? brut.chiffres : [])
    .map((x) => (x && typeof x === 'object'
      ? { valeur: net(x.valeur), libelle: net(x.libelle) } : null))
    .filter((x) => x && (x.valeur || x.libelle));
  if (chiffres.length) {
    lignes.push(`  insert into chiffres (processus_id, rang, valeur, libelle) values`);
    lignes.push(chiffres.map((x, i) =>
      `    (v_proc, ${i + 1}, ${txt(x.valeur)}, ${txt(x.libelle)})`).join(',\n') + ';');
  }
  lignes.push('');
}

function sqlClient(brut) {
  const nom = net(brut.nom) || net(brut.client) || 'Diagnostic importé';
  const code = net(brut.id) || nom.toLowerCase().normalize('NFD')
    .replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

  const lignes = [
    `-- ${nom}${net(brut.site) ? ' — ' + net(brut.site) : ''}`,
    `delete from clients where code = ${txt(code)};`,
    `do $migration$`,
    `declare`,
    `  v_client uuid;`,
    `  v_proc   uuid;`,
    `begin`,
    `  insert into clients (code, nom, site, date_visite, notes, outils, si)`,
    `  values (${txt(code)}, ${txt(nom)}, ${txt(brut.site)},`,
    `          ${txt(net(brut.date) || net(brut.date_visite))}, ${txt(brut.notes)},`,
    `          ${tableau(brut.outils)}, ${json(brut.si)})`,
    `  returning id into v_client;`,
    ''
  ];

  (Array.isArray(brut.processus) ? brut.processus : [])
    .forEach((p, i) => { if (p && typeof p === 'object') sqlProcessus(p, i + 1, lignes); });

  lignes.push(`end`, `$migration$;`, '');
  return lignes.join('\n');
}

const chemin = process.argv[2];
if (!chemin) {
  console.error('usage : node db/migrer.mjs <export.json>  >  charger.sql');
  process.exit(2);
}

const clients = clientsDuPaquet(JSON.parse(readFileSync(chemin, 'utf8')));
if (!clients.length) {
  console.error(`aucun diagnostic exploitable dans ${chemin}`);
  process.exit(1);
}

process.stdout.write([
  '-- Généré par db/migrer.mjs — ne pas modifier à la main.',
  `-- Source : ${chemin}`,
  `-- ${clients.length} diagnostic(s).`,
  '',
  'begin;',
  '',
  clients.map(sqlClient).join('\n'),
  'commit;',
  ''
].join('\n'));
