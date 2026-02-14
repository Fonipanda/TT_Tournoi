"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

function PaiementContent() {
  const searchParams = useSearchParams();
  const amount = searchParams.get("amount") || "0.00";

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Paiement de l'inscription</CardTitle>
          <CardDescription>Tournoi Chelles Tennis de Table 2025</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="text-center">
            <p className="text-muted-foreground mb-2">Montant total</p>
            <p className="text-4xl font-bold text-blue-600">{amount} &euro;</p>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-yellow-800 font-medium text-sm">
              Page de paiement fictive
            </p>
            <p className="text-yellow-700 text-sm mt-1">
              Le paiement en ligne sera disponible prochainement. En attendant, vous pouvez regler sur place le jour du tournoi.
            </p>
          </div>

          <div className="space-y-3">
            <h3 className="font-medium">Modes de paiement acceptes :</h3>
            <div className="space-y-2">
              <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                <Badge variant="outline">CB</Badge>
                <span className="text-sm">Carte bancaire (bientot disponible)</span>
              </div>
              <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg border border-green-200">
                <Badge className="bg-green-600">Sur place</Badge>
                <span className="text-sm">Paiement le jour du tournoi (especes, cheque ou CB)</span>
              </div>
            </div>
          </div>

          <Button className="w-full" variant="outline" onClick={() => window.close()}>
            Fermer cette page
          </Button>
        </CardContent>
      </Card>
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
