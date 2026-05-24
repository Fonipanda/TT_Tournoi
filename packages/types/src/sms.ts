/**
 * Types pour le moteur SMS multi-adaptateur.
 */

export type AdapterType = 'test' | 'ovh' | 'twilio' | 'free_mobile' | 'smpp';

export interface AdapterField {
  name: string;
  label: string;
  type: 'text' | 'password' | 'number';
  secret?: boolean;
  required?: boolean;
  placeholder?: string;
  help?: string;
}

export interface SmsSendResult {
  success: boolean;
  providerId?: string;
  error?: string;
  rawResponse?: unknown;
}

/**
 * Contrat commun à tous les adaptateurs SMS.
 * (cf. backend/tournament/sms/base.py du dépôt A)
 */
export interface SmsAdapter {
  type: AdapterType;
  name: string;

  /** Champs de configuration attendus (rendus dans l'UI admin SMS) */
  requiredFields(): AdapterField[];

  /** Validation early-fail côté serveur avant `send` */
  validateConfig(cfg: Record<string, unknown>): void;

  /** Envoi unitaire d'un SMS (un destinataire, un message) */
  send(to: string, message: string, sender?: string): Promise<SmsSendResult>;
}

export interface SmsTemplateContext {
  joueur?: string;
  table?: string | number;
  tableau?: string;
  adversaire?: string;
  heure?: string;
  salle?: string;
  message?: string;
  [key: string]: string | number | undefined;
}

export interface BulkRecipient {
  phone: string;
  name?: string;
  playerId?: string;
}

export interface BulkSendResult {
  sent: number;
  failed: number;
  total: number;
  jobIds: string[];
}

export const SMS_TEMPLATE_VARIABLES: Array<{
  name: keyof SmsTemplateContext;
  label: string;
  example: string;
}> = [
  { name: 'joueur', label: 'Nom du joueur', example: 'DUPONT Martin' },
  { name: 'table', label: 'Numéro de table', example: '5' },
  { name: 'tableau', label: 'Nom du tableau', example: 'Tableau A' },
  { name: 'adversaire', label: "Nom de l'adversaire", example: 'MARTIN Paul' },
  { name: 'heure', label: 'Heure actuelle', example: '14:30' },
  { name: 'salle', label: 'Nom de la salle', example: 'Salle Principale' },
  { name: 'message', label: 'Message libre', example: 'Information importante' },
];
