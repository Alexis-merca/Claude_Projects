/* Types de la traduction des interactions en opérations de base. */

import type { EtapeFlux } from './moteur.js';

export interface Ecriture {
  id: string;
  champs: Partial<Pick<EtapeFlux, 'role' | 'role2' | 'texte' | 'phase' | 'supports' | 'lien'>>;
}

export interface Mutation {
  /** Un UPDATE par étape touchée. */
  ecritures: Ecriture[];
  /** Liste complète des étapes dans le nouvel ordre, à passer à
      `reordonner_etapes()`. Jamais des écritures ligne à ligne : la contrainte
      d'unicité est différée et PostgREST met chaque requête dans sa propre
      transaction. Jamais un upsert partiel non plus : il viderait les colonnes
      absentes du corps. */
  ordre: string[] | null;
  /** Étape à insérer, le cas échéant. */
  creation?: Omit<EtapeFlux, 'id'>;
  /** Interaction sans effet, avec sa raison — à montrer à l'utilisateur. */
  refus?: string;
}

export function cyclerLien(etapes: EtapeFlux[], index: number): Mutation;
export function changerTexte(etapes: EtapeFlux[], index: number, texte: string): Mutation;
export function deposerEtape(
  etapes: EtapeFlux[], source: number, colonne: number, role: string, role2?: string
): Mutation;
export function renommerEchelle(
  etapes: EtapeFlux[], debut: number, span: number, libelle: string
): Mutation;
export function couperEchelle(etapes: EtapeFlux[], index: number): Mutation;
export function supprimerEchelle(etapes: EtapeFlux[], debut: number, span: number): Mutation;
export function ajouterEchelle(etapes: EtapeFlux[], roleParDefaut?: string): Mutation;
export function nomEchelleLibre(etapes: EtapeFlux[]): string;
