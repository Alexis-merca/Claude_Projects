/* Types du moteur, pour l'hôte TypeScript. Le moteur reste en JavaScript : il
   est partagé avec le mono-fichier, qui ne compile pas. */

export interface EtapeFlux {
  /** Clé technique en base. Absente pour une étape pas encore insérée. */
  id?: string;
  ordre: number;
  role: string;
  role2?: string | null;
  texte: string;
  phase?: string | null;
  supports?: string | null;
  lien?: string | null;
}

export interface ProcessusFlux {
  /** `code` côté base ; c'est lui qui atterrit dans `data-proc`. */
  id: string;
  roles: string[];
}

/** Libellés d'interface du moteur. Tout est optionnel : ce qui manque retombe
    sur `MOTS_FR`, donc la sortie par défaut ne change pas.

    LE DICTIONNAIRE EST DU CODE, JAMAIS UNE DONNÉE : ses valeurs sont insérées
    dans le balisage sans échappement. Un dictionnaire venu de la base, d'un
    réglage utilisateur ou d'une URL ouvrirait une injection HTML. */
export interface MotsFlux {
  titre?: string;
  zoomAjuster?: string;
  zoomAjusterTitre?: string;
  zoomAria?: string;
  saisieRapide?: string;
  masquerSaisieRapide?: string;
  videTitre?: string;
  videEdition?: string;
  videLecture?: string;
  premiereEtape?: string;
  phasePlaceholder?: string;
  phaseRenommerTitre?: (n: number) => string;
  phaseSupprimerTitre?: (n: number) => string;
  phaseAjouter?: string;
  phaseAjouterTitre?: string;
  phaseCouperTitre?: string;
  roleRenommerTitre?: string;
  roleMonter?: string;
  roleDescendre?: string;
  roleSupprimer?: string;
  roleAjouter?: string;
  poigneeTitre?: string;
  etapePlaceholder?: string;
  etapeGauche?: string;
  etapeDroite?: string;
  etapeInserer?: string;
  etapeSupprimer?: string;
  etapeAjouter?: string;
  etapeAjouterTitre?: string;
  frontiereTitre?: string;
  supportAjouter?: string;
  supportAutre?: string;
  supportChoisirTitre?: string;
  supportRetirer?: (nom: string) => string;
  supportSaisirNom?: string;
  legendeAide?: string;
  flecheTitre?: (libelle: string) => string;
  /** Clés = valeurs de `etapes.lien`, qui ne se traduisent pas. */
  liens?: Record<string, string>;
  ecartMois?: string;
  ecartSemaines?: string;
  ecartJours?: string;
}

/** Dictionnaire complet, une fois les défauts appliqués. */
export type MotsFluxComplet = Required<MotsFlux>;

export interface OptionsFlux {

  /** Rôles de TOUT le client, dans l'ordre : fixe la teinte de chaque rôle et
      la garde stable d'un processus à l'autre. */
  paletteRoles?: string[];
  outils?: string[];
  edition?: boolean;
  impression?: boolean;
  zoom?: number;
  etapeActive?: number | null;
  tableauVisible?: boolean;
  /** `false` pour que l'hôte fournisse en-tête et pied. */
  entete?: boolean;
  /** `false` pour ne renvoyer que le corps, sans l'enveloppe `carte--flux` :
      c'est alors l'hôte qui la porte, et les deux ne se dupliquent pas. */
  enveloppe?: boolean;
  /** Commandes d'édition émises. Absent : toutes. Présent : seules celles à
      `true` — un contrôle que l'hôte ne traite pas ne doit pas apparaître. */
  commandes?: {
    texte?: boolean;
    phases?: boolean;
    deplacement?: boolean;
    supports?: boolean;
    roles?: boolean;
    etapes?: boolean;
    tableau?: boolean;
  };
  /** Libellés d'interface. Absent : dictionnaire français par défaut. */
  mots?: MotsFlux;
}

export function baliserFlux(arg: {
  processus: ProcessusFlux;
  etapes: EtapeFlux[];
  options?: OptionsFlux;
}): string;

export function tracerFleches(
  zone: Element | null,
  etapes: EtapeFlux[],
  options?: { edition?: boolean; mots?: MotsFlux },
): void;

export function placerCartesACheval(zone: Element | null): void;
export function ajusterZonesDeTexte(zone: Element | null): void;
/** Hauteur maximale d'une zone de saisie d'étape, en pixels. */
export const HAUTEUR_MAX_TEXTE: number;

/** Place les cartes partagées, ajuste les zones de texte, puis trace. L'ordre
    compte : le tracé lit les décalages posés par le placement. */
export function acheverRendu(
  zone: Element | null,
  etapes: EtapeFlux[],
  options?: { edition?: boolean; mots?: MotsFlux },
): void;

export function rolesCouloirs(roles: string[]): Array<{ nom: string; iRole: number }>;
export function empriseDesEtapes(
  etapes: EtapeFlux[],
  couloirs: Array<{ nom: string; iRole: number }>,
): Array<{ ligne: number; cheval: number }>;
export function groupesDePhase(
  etapes: EtapeFlux[],
): Array<{ label: string; span: number; debut: number }>;
export function gabaritColonnes(n: number, edition?: boolean): string;
export function couleursRole(role: string, paletteRoles?: string[]): [string, string];
export function chipRole(role: string, paletteRoles?: string[], variante?: string): string;
export function listeSupports(brut: string | null | undefined): string[];
export function badgeSupport(nom: string): string;
export function bandeauSupports(liste: string[]): string;
export function jalonEnJours(libelle: string): number | null;
export function ecartLisible(
  depuis: number | null,
  vers: number | null,
  mots?: MotsFlux,
): string;
export function echapper(v: unknown): string;

/** Dictionnaire français par défaut. */
export const MOTS_FR: MotsFluxComplet;
/** Défauts complétés par ce que l'hôte fournit. */
export function mots(fournis?: MotsFlux | null): MotsFluxComplet;
/** Libellé d'affichage d'une nature de lien (`''`, `'auto'`, `'manuel'`). */
export function libelleLien(nature: string, mots?: MotsFlux): string;
/** Empreinte FNV-1a 32 bits du nom normalisé. */
export function empreinteNom(nom: string): number;
/** Badge de repli d'un outil inconnu : teinte dérivée du nom, initiale. */
export function badgeDerive(nom: string): { fond: string; lettre: string };
export const PALETTE_OUTILS: string[];


export const LIENS: Record<
  string,
  {
    couleur: string;
    tirets: string;
    marqueur: string;
    libelle: string;
  }
>;
export const ORDRE_LIENS: string[];
export const PASTELS: Array<[string, string]>;
