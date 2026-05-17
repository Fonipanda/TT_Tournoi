"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/lib/api";
import {
  ClipboardCheck, Search, Loader2, CheckCircle, XCircle,
  AlertCircle, QrCode, Hash, Users, RotateCw
} from "lucide-react";

interface CheckinPlayer {
  registration_id: string;
  player_id: string;
  name: string;
  club: string;
  points: number;
  license_number: string;
  checkin_status: string;
  dossard_number: number | null;
  qr_token: string;
  payment_status: string;
}

interface JugeArbitrePageProps {
  tournamentId?: string;
}

export default function JugeArbitrePage({ tournamentId }: JugeArbitrePageProps) {
  const [brackets, setBrackets] = useState<any[]>([]);
  const [selectedBracket, setSelectedBracket] = useState("");
  const [players, setPlayers] = useState<CheckinPlayer[]>([]);
  const [loading, setLoading] = useState(false);
  const [scanToken, setScanToken] = useState("");
  const [scanResult, setScanResult] = useState<any>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanHistory, setScanHistory] = useState<any[]>([]);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    fetchBrackets();
  }, [tournamentId]);

  const fetchBrackets = async () => {
    try {
      const data = await api.brackets.list(tournamentId);
      setBrackets(data);
    } catch {}
  };

  const fetchCheckinList = async (bracketId: string) => {
    if (!bracketId) return;
    setLoading(true);
    try {
      const data = await api.brackets.checkinList(bracketId);
      setPlayers(data);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleBracketChange = (id: string) => {
    setSelectedBracket(id);
    fetchCheckinList(id);
  };

  const handleScan = async () => {
    if (!scanToken.trim()) return;
    setScanning(true);
    setScanError(null);
    setScanResult(null);
    try {
      const res = await api.checkin.scan(scanToken.trim());
      setScanResult(res);
      setScanHistory(prev => [{ ...res, time: new Date().toLocaleTimeString() }, ...prev.slice(0, 19)]);
      setScanToken("");
      if (selectedBracket) fetchCheckinList(selectedBracket);
    } catch (err: any) {
      setScanError(err.message);
    } finally {
      setScanning(false);
    }
  };

  const updateCheckin = async (registrationId: string, val: string) => {
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api'}/player-bracket-registrations/${registrationId}/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checkin_status: val })
      });
      if (selectedBracket) fetchCheckinList(selectedBracket);
    } catch {}
  };

  const handleAssignDossards = async () => {
    if (!selectedBracket) return;
    try {
      const res = await api.brackets.assignDossards(selectedBracket);
      if (res.success) {
        setSuccess(res.message);
        setTimeout(() => setSuccess(null), 3000);
        fetchCheckinList(selectedBracket);
      }
    } catch (err: any) {
      setScanError(err.message);
    }
  };

  const present = players.filter(p => p.checkin_status === 'P').length;
  const absent = players.filter(p => p.checkin_status === 'A').length;
  const notChecked = players.filter(p => !p.checkin_status).length;

  const sortedBrackets = [...brackets].sort((a: any, b: any) => a.name.localeCompare(b.name, 'fr'));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5" />
              Scan QR Code / Check-in
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                value={scanToken}
                onChange={(e) => setScanToken(e.target.value)}
                placeholder="Saisir ou scanner le token QR..."
                onKeyDown={(e) => e.key === 'Enter' && handleScan()}
                className="flex-1"
              />
              <Button onClick={handleScan} disabled={scanning || !scanToken.trim()}>
                {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              </Button>
            </div>

            {scanResult && (
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
                className={`p-4 rounded-lg border-2 ${scanResult.already_checked_in ? 'bg-yellow-50 border-yellow-300' : 'bg-green-50 border-green-300'}`}>
                <div className="flex items-center gap-3">
                  <CheckCircle className={`h-6 w-6 ${scanResult.already_checked_in ? 'text-yellow-600' : 'text-green-600'}`} />
                  <div>
                    <p className="font-bold text-lg">{scanResult.player_name}</p>
                    <p className="text-sm text-muted-foreground">{scanResult.bracket_name}</p>
                    {scanResult.dossard_number && <Badge className="mt-1">Dossard #{scanResult.dossard_number}</Badge>}
                    {scanResult.already_checked_in && <p className="text-xs text-yellow-700 mt-1">Deja pointe</p>}
                  </div>
                </div>
              </motion.div>
            )}

            {scanError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-red-600" />
                <span className="text-sm text-red-600">{scanError}</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Historique des scans</CardTitle>
          </CardHeader>
          <CardContent>
            {scanHistory.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Aucun scan</p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {scanHistory.map((s, i) => (
                  <div key={i} className="text-xs p-2 bg-gray-50 rounded flex justify-between">
                    <span className="font-medium">{s.player_name}</span>
                    <span className="text-muted-foreground">{s.time}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5" />
            Pointage par tableau
          </CardTitle>
          <CardDescription>Selectionnez un tableau pour gerer le pointage des joueurs</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4 items-end flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <Label>Tableau</Label>
              <Select value={selectedBracket} onValueChange={handleBracketChange}>
                <SelectTrigger><SelectValue placeholder="Selectionnez un tableau" /></SelectTrigger>
                <SelectContent>
                  {sortedBrackets.map((b: any) => (
                    <SelectItem key={b.id} value={b.id}>{b.name} ({b.category})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedBracket && (
              <>
                <Button variant="outline" onClick={() => fetchCheckinList(selectedBracket)}>
                  <RotateCw className="h-4 w-4 mr-1" /> Rafraichir
                </Button>
                <Button onClick={handleAssignDossards} className="bg-purple-600 hover:bg-purple-700">
                  <Hash className="h-4 w-4 mr-1" /> Attribuer les dossards
                </Button>
              </>
            )}
          </div>

          {success && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-3 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm text-green-600 flex items-center gap-1"><CheckCircle className="h-4 w-4" />{success}</p>
            </motion.div>
          )}

          {selectedBracket && (
            <div className="grid grid-cols-4 gap-4">
              <div className="p-3 bg-blue-50 rounded-lg text-center">
                <p className="text-2xl font-bold text-blue-600">{players.length}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
              <div className="p-3 bg-green-50 rounded-lg text-center">
                <p className="text-2xl font-bold text-green-600">{present}</p>
                <p className="text-xs text-muted-foreground">Presents</p>
              </div>
              <div className="p-3 bg-red-50 rounded-lg text-center">
                <p className="text-2xl font-bold text-red-600">{absent}</p>
                <p className="text-xs text-muted-foreground">Absents</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg text-center">
                <p className="text-2xl font-bold text-gray-600">{notChecked}</p>
                <p className="text-xs text-muted-foreground">Non pointes</p>
              </div>
            </div>
          )}

          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>
          ) : players.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-2">Dossard</th>
                    <th className="text-left py-2 px-2">Nom</th>
                    <th className="text-left py-2 px-2">Club</th>
                    <th className="text-center py-2 px-2">Points</th>
                    <th className="text-left py-2 px-2">Licence</th>
                    <th className="text-center py-2 px-2">Paiement</th>
                    <th className="text-center py-2 px-2">Pointage</th>
                  </tr>
                </thead>
                <tbody>
                  {players.map((player) => (
                    <tr key={player.registration_id} className={`border-b transition-colors ${
                      player.checkin_status === 'P' ? 'bg-green-50' :
                      player.checkin_status === 'A' ? 'bg-red-50' : 'hover:bg-gray-50'
                    }`}>
                      <td className="py-2 px-2">
                        {player.dossard_number ? (
                          <Badge variant="outline" className="font-mono">#{player.dossard_number}</Badge>
                        ) : <span className="text-gray-400">-</span>}
                      </td>
                      <td className="py-2 px-2 font-medium">{player.name}</td>
                      <td className="py-2 px-2 text-sm text-muted-foreground">{player.club}</td>
                      <td className="py-2 px-2 text-center"><Badge variant="outline">{player.points}</Badge></td>
                      <td className="py-2 px-2 text-sm">{player.license_number}</td>
                      <td className="py-2 px-2 text-center">
                        <Badge variant={player.payment_status === 'paid' ? 'success' : 'secondary'} className="text-xs">
                          {player.payment_status === 'paid' ? 'Paye' : 'En attente'}
                        </Badge>
                      </td>
                      <td className="py-2 px-2 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => updateCheckin(player.registration_id, player.checkin_status === 'P' ? '' : 'P')}
                            className={`w-8 h-8 rounded flex items-center justify-center font-bold text-sm transition-all ${
                              player.checkin_status === 'P' ? 'bg-green-500 text-white shadow-md' : 'bg-gray-200 text-gray-400 hover:bg-green-200'
                            }`}
                            title="Present"
                          >
                            {'\u2713'}
                          </button>
                          <button
                            onClick={() => updateCheckin(player.registration_id, player.checkin_status === 'A' ? '' : 'A')}
                            className={`w-8 h-8 rounded flex items-center justify-center font-bold text-sm transition-all ${
                              player.checkin_status === 'A' ? 'bg-red-500 text-white shadow-md' : 'bg-gray-200 text-gray-400 hover:bg-red-200'
                            }`}
                            title="Absent"
                          >
                            {'\u2717'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : selectedBracket ? (
            <p className="text-center text-muted-foreground py-8">Aucun joueur inscrit dans ce tableau</p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
