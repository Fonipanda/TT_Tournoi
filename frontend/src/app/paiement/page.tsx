"use client";

import { useSearchParams } from "next/navigation";
import { useState, useEffect, Suspense } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Lock, Shield, CreditCard, Banknote, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { api } from "@/lib/api";

function PaiementContent() {
  const searchParams = useSearchParams();
  const paymentStatus = searchParams.get("status");
  const sessionId = searchParams.get("session_id");
  const amount = searchParams.get("amount") || "0.00";
  const playerName = searchParams.get("player") || "";

  const [sessionData, setSessionData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (sessionId && paymentStatus === 'success') {
      setLoading(true);
      api.payments.sessionStatus(sessionId)
        .then(setSessionData)
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [sessionId, paymentStatus]);

  if (paymentStatus === 'success') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-green-50 to-white flex items-center justify-center p-4">
        <div className="max-w-lg w-full">
          <Card>
            <CardHeader className="text-center pb-2">
              <CheckCircle2 className="h-16 w-16 text-green-600 mx-auto mb-4" />
              <CardTitle className="text-2xl text-green-700">Paiement reussi !</CardTitle>
              <CardDescription>Votre inscription a ete confirmee et payee</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-center">
              {loading ? (
                <Loader2 className="h-8 w-8 animate-spin mx-auto text-green-600" />
              ) : sessionData?.success ? (
                <div className="space-y-2">
                  <p className="text-3xl font-bold text-green-600">
                    {((sessionData.amount_total || 0) / 100).toFixed(2)} &euro;
                  </p>
                  <Badge variant="success" className="text-sm">
                    {sessionData.registrations_count} inscription(s) payee(s)
                  </Badge>
                </div>
              ) : (
                <p className="text-green-600 font-medium">Paiement confirme</p>
              )}
              <Button className="w-full mt-4" onClick={() => window.location.href = '/'}>
                Retourner a l&apos;accueil
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (paymentStatus === 'cancel') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-orange-50 to-white flex items-center justify-center p-4">
        <div className="max-w-lg w-full">
          <Card>
            <CardHeader className="text-center pb-2">
              <XCircle className="h-16 w-16 text-orange-500 mx-auto mb-4" />
              <CardTitle className="text-2xl text-orange-700">Paiement annule</CardTitle>
              <CardDescription>Vous pouvez reessayer ou payer sur place le jour du tournoi</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-medium text-green-800 text-sm">Votre inscription est enregistree</p>
                    <p className="text-green-700 text-xs mt-1">
                      Vous pourrez regler sur place le jour du tournoi par carte, especes ou cheque.
                    </p>
                  </div>
                </div>
              </div>
              <Button className="w-full" onClick={() => window.location.href = '/'}>
                Retourner a l&apos;accueil
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex items-center justify-center p-4">
      <div className="max-w-lg w-full space-y-6">
        <Card>
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-2xl">Paiement de l&apos;inscription</CardTitle>
            <CardDescription>Tournoi Chelles Tennis de Table</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {playerName && (
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Joueur</p>
                <p className="font-medium">{decodeURIComponent(playerName)}</p>
              </div>
            )}

            <div className="text-center py-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-muted-foreground mb-1">Montant total a regler</p>
              <p className="text-4xl font-bold text-blue-600">{amount} &euro;</p>
            </div>

            <div className="flex items-center justify-center gap-3 py-3 px-4 bg-gray-50 rounded-lg border">
              <Lock className="h-4 w-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-600">Paiement securise via Stripe</span>
            </div>

            <div className="space-y-3">
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <CreditCard className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-medium text-blue-800 text-sm">Paiement par carte bancaire</p>
                    <p className="text-blue-700 text-xs mt-1">
                      CB, Visa, Mastercard - Paiement securise avec 3D Secure
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-medium text-green-800 text-sm">Paiement sur place</p>
                    <p className="text-green-700 text-xs mt-1">
                      Reglez le jour du tournoi par carte bancaire, especes ou cheque.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-2 space-y-2">
              <Button className="w-full" variant="outline" onClick={() => window.close()}>
                Fermer cette page
              </Button>
              <p className="text-xs text-center text-muted-foreground">
                Votre inscription est enregistree. Vous pourrez regler sur place le jour du tournoi.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function PaiementPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Chargement...</div>}>
      <PaiementContent />
    </Suspense>
  );
}
