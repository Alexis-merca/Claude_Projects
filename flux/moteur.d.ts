/* Types du moteur, pour l'hôte TypeScript. Le moteur reste en JavaScript : il
   est partagé avec le mono-fichier, qui ne compile pas. */

export interface EtapeFlux {
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
}

export function baliserFlux(arg: {
  processus: ProcessusFlux;
  etapes: EtapeFlux[];
  options?: OptionsFlux;
}): string;

export function tracerFleches(
  zone: Element | null,
  etapes: EtapeFlux[],
  options?: { edition?: boolean }
): void;

export function placerCartesACheval(zone: Element | null): void;
export function ajusterZonesDeTexte(zone: Element | null): void;

/** Place les cartes partagées, ajuste les zones de texte, puis trace. L'ordre
    compte : le tracé lit les décalages posés par le placement. */
export function acheverRendu(
  zone: Element | null,
  etapes: EtapeFlux[],
  options?: { edition?: boolean }
): void;

export function rolesCouloirs(roles: string[]): Array<{ nom: string; iRole: number }>;
export function empriseDesEtapes(
  etapes: EtapeFlux[],
  couloirs: Array<{ nom: string; iRole: number }>
): Array<{ ligne: number; cheval: number }>;
export function groupesDePhase(
  etapes: EtapeFlux[]
): Array<{ label: string; span: number; debut: number }>;
export function gabaritColonnes(n: number, edition?: boolean): string;
export function couleursRole(role: string, paletteRoles?: string[]): [string, string];
export function chipRole(role: string, paletteRoles?: string[], variante?: string): string;
export function listeSupports(brut: string | null | undefined): string[];
export function badgeSupport(nom: string): string;
export function bandeauSupports(liste: string[]): string;
export function jalonEnJours(libelle: string): number | null;
export function ecartLisible(depuis: number | null, vers: number | null): string;
export function echapper(v: unknown): string;

export const LIENS: Record<string, {
  couleur: string; tirets: string; marqueur: string; libelle: string;
}>;
export const ORDRE_LIENS: string[];
export const PASTELS: Array<[string, string]>;
