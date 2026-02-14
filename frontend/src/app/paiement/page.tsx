"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Lock, Shield, CreditCard, Banknote, CheckCircle2 } from "lucide-react";

function CBLogo() {
  return (
    <div className="flex items-center justify-center w-12 h-8 bg-[#1A1F71] rounded px-1">
      <span className="text-white font-bold text-xs tracking-wide">CB</span>
    </div>
  );
}

function VisaLogo() {
  return (
    <div className="flex items-center justify-center w-12 h-8 bg-white border border-gray-200 rounded px-1">
      <span className="text-[#1A1F71] font-bold text-sm italic tracking-tight">VISA</span>
    </div>
  );
}

function MastercardLogo() {
  return (
    <div className="flex items-center justify-center w-12 h-8 bg-white border border-gray-200 rounded px-1">
      <div className="flex -space-x-1.5">
        <div className="w-4 h-4 rounded-full bg-red-500 opacity-90" />
        <div className="w-4 h-4 rounded-full bg-yellow-400 opacity-90" />
      </div>
    </div>
  );
}

function PaiementContent() {
  const searchParams = useSearchParams();
  const amount = searchParams.get("amount") || "0.00";
  const playerName = searchParams.get("player") || "";

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex items-center justify-center p-4">
      <div className="max-w-lg w-full space-y-6">
        <Card>
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-2xl">Paiement de l'inscription</CardTitle>
            <CardDescription>Tournoi Chelles Tennis de Table 2025</CardDescription>
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
              <span className="text-sm font-medium text-gray-600">Paiement securise</span>
              <div className="flex items-center gap-2 ml-2">
                <CBLogo />
                <VisaLogo />
                <MastercardLogo />
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="font-medium flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                Modes de paiement acceptes
              </h3>

              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <Shield className="h-5 w-5 text-yellow-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-medium text-yellow-800 text-sm">Paiement en ligne (bientot disponible)</p>
                    <p className="text-yellow-700 text-xs mt-1">
                      Le paiement par carte bancaire en ligne sera disponible prochainement.
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

              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <Banknote className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-medium text-blue-800 text-sm">Virement bancaire</p>
                    <p className="text-blue-700 text-xs mt-1">
                      Contactez le club pour obtenir les coordonnees bancaires : ttchelles@gmail.com
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

        <div className="text-center text-xs text-muted-foreground space-y-1">
          <p>Chelles Tennis de Table - Tournoi National B 2025</p>
          <p className="flex items-center justify-center gap-1">
            <Lock className="h-3 w-3" />
            Connexion securisee
          </p>
        </div>
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
