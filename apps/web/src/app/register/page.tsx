'use client';

import { useState, Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { TextField } from '@/components/ui/fields';
import { PasswordField } from '@/components/ui/password-field';
import { isPasswordStrong, PASSWORD_POLICY_MESSAGE } from '@tt/auth/password-policy';
import { toast, ToastViewport } from '@/components/ui/toast';
import { apiPost, apiGet, ApiError } from '@/lib/api-client';
import { suggestDomainFix, validateEmailOffline } from '@/lib/email-validation.shared';

function RegisterForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [submitting, setSubmitting] = useState(false);
  const [looking, setLooking] = useState(false);
  const [licenseFound, setLicenseFound] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initialLicence = params.get('licence') ?? '';
  const reason = params.get('reason'); // 'fftt-not-found' si redirigé du login

  const [form, setForm] = useState({
    licenseNumber: initialLicence,
    firstName: '',
    lastName: '',
    club: '',
    email: '',
    phone: '',
  });

  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');

  // L'erreur d'email ne s'affiche qu'après une première sortie du champ, pour
  // ne pas signaler « invalide » dès la première lettre saisie.
  const [emailTouched, setEmailTouched] = useState(false);
  const emailCheck = validateEmailOffline(form.email);
  const emailSuggestion = emailCheck.ok ? suggestDomainFix(form.email) : null;
  const emailError = emailTouched && !emailCheck.ok ? emailCheck.message : null;

  const passwordsMatch = password === passwordConfirm;
  const canSubmit =
    !submitting &&
    emailCheck.ok &&
    isPasswordStrong(password) &&
    passwordsMatch &&
    passwordConfirm.length > 0;

  const update = <K extends keyof typeof form>(key: K, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  // Auto-lookup FFTT au chargement si licence pré-remplie
  useEffect(() => {
    if (initialLicence && /^\d{6,10}$/.test(initialLicence)) {
      void doLookup(initialLicence);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const doLookup = async (licence: string) => {
    if (!/^\d{6,10}$/.test(licence)) return;
    setLooking(true);
    setLicenseFound(false);
    setError(null);
    try {
      const data = await apiGet<{ nom: string; prenom: string; club: string | null }>(
        `/api/fftt/lookup/${licence}`,
      );
      setForm((f) => ({
        ...f,
        firstName: data.prenom,
        lastName: data.nom,
        club: data.club ?? '',
      }));
      setLicenseFound(true);
      toast.success(`Licence trouvée : ${data.prenom} ${data.nom}`);
    } catch {
      setLicenseFound(false);
      // On ne bloque pas — l'utilisateur peut saisir manuellement
      toast.info('Licence non trouvée — saisis tes informations manuellement');
    } finally {
      setLooking(false);
    }
  };

  const onLicenseBlur = () => {
    if (form.licenseNumber && /^\d{6,10}$/.test(form.licenseNumber)) {
      void doLookup(form.licenseNumber);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!emailCheck.ok) {
      setEmailTouched(true);
      setError(emailCheck.message);
      return;
    }
    if (!isPasswordStrong(password)) {
      setError(PASSWORD_POLICY_MESSAGE);
      return;
    }
    if (!passwordsMatch) {
      setError('Les deux mots de passe ne correspondent pas.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const res = await apiPost<{ emailVerificationRequired: boolean; email: string }>(
        '/api/auth/register',
        { ...form, password },
      );
      // Pas d'auto-connexion : le compte doit d'abord être activé via le lien
      // envoyé à l'adresse email saisie.
      if (res.emailVerificationRequired) {
        toast.success('Compte créé · Confirme ton adresse email');
        router.push(`/verifier-email?sent=1&email=${encodeURIComponent(res.email)}`);
      } else {
        toast.success('Compte créé · Connecte-toi pour choisir tes tableaux');
        router.push('/login');
      }
      router.refresh();
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'Erreur réseau';
      setError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-12">
      <h1 className="font-heading text-3xl uppercase tracking-wide mb-3 text-center">
        Créer un compte
      </h1>
      <p className="text-center text-foreground-muted text-sm mb-6">
        Inscris-toi pour pouvoir t'inscrire au tournoi ChellesTT.
      </p>

      {reason === 'not_registered' && (
        <div className="card border-warning bg-warning-soft text-warning mb-4 text-sm rounded-xl">
          ℹ️ Aucun compte trouvé avec cette licence. Crée ton compte pour t'inscrire au tournoi.
        </div>
      )}
      {reason === 'fftt-not-found' && (
        <div className="card border-warning bg-warning-soft text-warning mb-4 text-sm rounded-xl">
          ⚠ Licence FFTT introuvable. Vérifie ton numéro ou crée un compte sans licence.
        </div>
      )}

      <div className="card">
        <form onSubmit={submit} className="space-y-3" data-testid="register-form">
          <div className="flex gap-2 items-end">
            <TextField
              label="N° licence FFTT"
              required
              value={form.licenseNumber}
              onChange={(e) => update('licenseNumber', e.target.value.replace(/\D/g, ''))}
              onBlur={onLicenseBlur}
              inputMode="numeric"
              maxLength={10}
              placeholder="7711100001"
              className="flex-1"
              helper="Sert à retrouver tes informations FFTT (nom, prénom, club)."
            />
            <button
              type="button"
              onClick={() => doLookup(form.licenseNumber)}
              disabled={looking || !form.licenseNumber}
              className="btn-secondary text-sm whitespace-nowrap disabled:opacity-50 mb-0"
              data-testid="fftt-lookup"
            >
              {looking ? '…' : 'Vérifier'}
            </button>
          </div>

          {licenseFound && (
            <p className="text-xs text-success">✓ Licence vérifiée auprès de la FFTT</p>
          )}

          <div className="grid grid-cols-2 gap-3">
            <TextField
              label="Prénom"
              required
              value={form.firstName}
              onChange={(e) => update('firstName', e.target.value)}
              helper={licenseFound ? 'Auto-rempli FFTT' : undefined}
            />
            <TextField
              label="Nom"
              required
              value={form.lastName}
              onChange={(e) => update('lastName', e.target.value.toUpperCase())}
              helper={licenseFound ? 'Auto-rempli FFTT' : undefined}
            />
          </div>

          <TextField
            label="Club"
            value={form.club}
            onChange={(e) => update('club', e.target.value)}
            placeholder="Chelles TT"
            helper={licenseFound ? 'Auto-rempli FFTT' : 'Optionnel'}
          />

          <TextField
            label="Email"
            type="email"
            required
            value={form.email}
            onChange={(e) => update('email', e.target.value)}
            onBlur={() => setEmailTouched(true)}
            autoComplete="email"
            placeholder="prenom.nom@exemple.fr"
            error={emailError}
            data-testid="register-email"
            helper={
              emailError
                ? undefined
                : "Sert d'identifiant de connexion. Un lien d'activation y sera envoyé — les adresses jetables sont refusées."
            }
          />

          {emailSuggestion && (
            <p className="text-xs text-warning -mt-2" data-testid="email-suggestion">
              Voulais-tu écrire{' '}
              <button
                type="button"
                className="underline font-medium"
                onClick={() =>
                  update('email', `${form.email.split('@')[0]}@${emailSuggestion}`)
                }
              >
                {form.email.split('@')[0]}@{emailSuggestion}
              </button>
               ?
            </p>
          )}

          <TextField
            label="Téléphone (pour SMS du tournoi)"
            type="tel"
            value={form.phone}
            onChange={(e) => update('phone', e.target.value)}
            placeholder="+33612345678"
            autoComplete="tel"
            helper="Format international (+33...)"
          />

          <PasswordField
            data-testid="password"
            label="Mot de passe"
            value={password}
            onChange={setPassword}
            autoComplete="new-password"
            helper={PASSWORD_POLICY_MESSAGE}
            showChecklist
          />

          <PasswordField
            data-testid="password-confirm"
            label="Confirmer le mot de passe"
            value={passwordConfirm}
            onChange={setPasswordConfirm}
            autoComplete="new-password"
            error={
              passwordConfirm.length > 0 && !passwordsMatch
                ? 'Les deux mots de passe ne correspondent pas.'
                : null
            }
          />

          {error && (
            <p className="text-danger text-sm" data-testid="register-error">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={!canSubmit}
            className="btn-primary w-full disabled:opacity-50"
            data-testid="submit-register"
          >
            {submitting ? '…' : 'Créer mon compte'}
          </button>
        </form>

        <p className="text-xs text-foreground-muted text-center mt-4">
          Tu as déjà un compte ?{' '}
          <Link href="/login" className="text-primary underline">
            Se connecter
          </Link>
        </p>
      </div>

      <ToastViewport />
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<p className="text-center mt-12">Chargement…</p>}>
      <RegisterForm />
    </Suspense>
  );
}
