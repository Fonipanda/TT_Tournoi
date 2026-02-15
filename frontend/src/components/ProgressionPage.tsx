"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/lib/api";
import { Trophy, Loader2, RefreshCcw } from "lucide-react";

interface Bracket {
  id: string;
  name: string;
  category: string;
}

interface Match {
  id: string;
  player1: string;
  player2: string;
  player1_name: string;
  player2_name: string;
  winner: string | null;
  bracket_name: string;
  bracket: string;
  status: string;
  round_name: string;
  round_number: number;
  table_number: number | null;
  sets_player1: number;
  sets_player2: number;
}

export default function ProgressionPage() {
  const [loading, setLoading] = useState(true);
  const [brackets, setBrackets] = useState<Bracket[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [selectedBracket, setSelectedBracket] = useState<string>("all");

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const tournaments = await api.tournaments.list();
      if (tournaments.length > 0) {
        const bracketsData = await api.brackets.list(tournaments[0].id);
        setBrackets(bracketsData);
      }
      const matchesData = await api.matches.list({});
      setMatches(matchesData);
    } catch (error) {
      console.error("Erreur chargement donnees:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredMatches = selectedBracket === "all"
    ? matches
    : matches.filter(m => m.bracket === selectedBracket);

  const poolMatches = filteredMatches.filter(m => (m.round_name || '').startsWith('Pool'));
  const elimMatches = filteredMatches.filter(m => !(m.round_name || '').startsWith('Pool'));

  const poolGroups: Record<string, Match[]> = {};
  poolMatches.forEach(m => {
    const pn = m.round_name || 'Pool';
    if (!poolGroups[pn]) poolGroups[pn] = [];
    poolGroups[pn].push(m);
  });

  const elimRounds: Record<string, Match[]> = {};
  elimMatches.forEach(m => {
    const rn = m.round_name || `Tour ${m.round_number}`;
    if (!elimRounds[rn]) elimRounds[rn] = [];
    elimRounds[rn].push(m);
  });
  const roundOrder = ['Pool', '1/64', '1/32', '1/16', '1/8', '1/4', '1/2', 'Petite Finale', 'Finale'];
  const sortedElimRounds = Object.keys(elimRounds).sort((a, b) => {
    const ai = roundOrder.indexOf(a);
    const bi = roundOrder.indexOf(b);
    return (ai === -1 ? 50 : ai) - (bi === -1 ? 50 : bi);
  });

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Trophy className="h-6 w-6" />
            Progression du Tournoi
          </h2>
          <p className="text-muted-foreground">Arbre des matchs et progression en temps reel</p>
        </div>
        <div className="flex flex-wrap gap-4">
          <Select value={selectedBracket} onValueChange={setSelectedBracket}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Tous les tableaux" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les tableaux</SelectItem>
              {brackets.map((b) => (
                <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={fetchData}>
            <RefreshCcw className="h-4 w-4 mr-2" /> Actualiser
          </Button>
        </div>
      </div>

      {filteredMatches.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <Trophy className="h-12 w-12 mx-auto text-gray-300 mb-4" />
              <p className="text-muted-foreground">Aucun match configure pour ce tableau</p>
              <p className="text-sm text-muted-foreground mt-1">Les matchs apparaitront ici une fois generes dans Admin &gt; Arbre Tournoi</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {Object.keys(poolGroups).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Phase de Poules</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {Object.keys(poolGroups).sort().map((poolName) => {
                    const pMatches = poolGroups[poolName];
                    const playerIds = new Set<string>();
                    pMatches.forEach(m => { if (m.player1) playerIds.add(m.player1); if (m.player2) playerIds.add(m.player2); });
                    const playerList = Array.from(playerIds);
                    const playerNames: Record<string, string> = {};
                    pMatches.forEach(m => {
                      if (m.player1) playerNames[m.player1] = m.player1_name || '?';
                      if (m.player2) playerNames[m.player2] = m.player2_name || '?';
                    });
                    const wins: Record<string, number> = {};
                    const matchResults: Record<string, string> = {};
                    playerList.forEach(pid => { wins[pid] = 0; });
                    pMatches.forEach(m => {
                      const k1 = `${m.player1}_${m.player2}`;
                      const k2 = `${m.player2}_${m.player1}`;
                      if (m.status === 'finished' && m.winner) {
                        wins[m.winner] = (wins[m.winner] || 0) + 1;
                        matchResults[k1] = m.winner === m.player1 ? 'V' : 'D';
                        matchResults[k2] = m.winner === m.player2 ? 'V' : 'D';
                      } else if (m.status === 'in_progress') {
                        matchResults[k1] = '...'; matchResults[k2] = '...';
                      } else { matchResults[k1] = '-'; matchResults[k2] = '-'; }
                    });
                    const ranking = [...playerList].sort((a, b) => (wins[b] || 0) - (wins[a] || 0));
                    const allDone = pMatches.every(m => m.status === 'finished');

                    return (
                      <div key={poolName} className="border rounded-lg overflow-hidden">
                        <div className={`px-4 py-2 font-bold text-white ${allDone ? 'bg-green-700' : 'bg-blue-800'}`}>
                          {poolName}{allDone && <span className="ml-2 text-xs opacity-80">- Terminee</span>}
                        </div>
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-gray-100">
                              <th className="text-left px-3 py-2 w-8">#</th>
                              <th className="text-left px-3 py-2">Joueur</th>
                              {playerList.map((_, ci) => (<th key={ci} className="text-center px-2 py-2 w-10">{ci + 1}</th>))}
                              <th className="text-center px-3 py-2 w-10">V</th>
                              <th className="text-center px-3 py-2 w-20">Rang</th>
                            </tr>
                          </thead>
                          <tbody>
                            {ranking.map((pid, ri) => (
                              <tr key={pid} className={`border-t ${ri < 2 && allDone ? 'bg-green-50' : ''}`}>
                                <td className="px-3 py-2 font-bold text-gray-500">{ri + 1}</td>
                                <td className="px-3 py-2 font-medium truncate max-w-[140px]">{playerNames[pid]}</td>
                                {playerList.map((opId, ci) => {
                                  if (playerList.indexOf(pid) === ci) return <td key={ci} className="text-center px-2 py-2 bg-gray-200">X</td>;
                                  const res = matchResults[`${pid}_${opId}`] || '-';
                                  return (
                                    <td key={ci} className={`text-center px-2 py-2 font-bold ${
                                      res === 'V' ? 'text-green-600' : res === 'D' ? 'text-red-500' : res === '...' ? 'text-orange-500' : 'text-gray-400'
                                    }`}>{res}</td>
                                  );
                                })}
                                <td className="text-center px-3 py-2 font-bold">{wins[pid] || 0}</td>
                                <td className={`text-center px-3 py-2 font-bold ${allDone ? (ri < 2 ? 'text-green-600' : 'text-red-500') : 'text-gray-400'}`}>
                                  {allDone ? (ri === 0 ? '1er' : `${ri + 1}eme`) : '-'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {sortedElimRounds.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Phase d'elimination</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto pb-4">
                  <div className="flex min-w-max items-start">
                    {sortedElimRounds.map((roundName, roundIdx) => {
                      const spacingMultiplier = Math.pow(2, roundIdx);
                      const matchHeight = 52;
                      const baseGap = 8;
                      return (
                        <div key={roundName} className="flex flex-col" style={{ minWidth: 210 }}>
                          <h4 className="text-center font-bold text-xs bg-gray-800 text-white py-1.5 rounded mx-1 mb-2">
                            {roundName}
                          </h4>
                          <div className="flex flex-col" style={{ gap: 0 }}>
                            {elimRounds[roundName].map((match, matchIdx) => {
                              const topPad = roundIdx === 0 ? 0 : (spacingMultiplier - 1) * (matchHeight + baseGap) / 2;
                              return (
                                <motion.div
                                  key={match.id}
                                  initial={{ opacity: 0, x: -10 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  transition={{ delay: matchIdx * 0.05 }}
                                  className="flex items-center"
                                  style={{ paddingTop: matchIdx === 0 ? topPad : (spacingMultiplier - 1) * (matchHeight + baseGap), paddingBottom: 0 }}
                                >
                                  {roundIdx > 0 && (
                                    <div style={{ width: 16 }}><div className="border-t-2 border-gray-400 w-full" /></div>
                                  )}
                                  <div className={`flex-1 border rounded overflow-hidden ${
                                    match.status === 'finished' ? 'border-green-500' :
                                    match.status === 'in_progress' ? 'border-red-500 ring-1 ring-red-200' : 'border-gray-300'
                                  }`} style={{ minHeight: matchHeight }}>
                                    <div className={`px-2 py-1 flex justify-between items-center border-b text-xs ${
                                      match.winner && match.winner === match.player1 ? 'bg-green-50 font-bold' : 'bg-white'
                                    }`}>
                                      <span className="truncate flex-1">{match.player1_name || 'TBD'}</span>
                                      {match.winner === match.player1 && <Trophy className="h-3 w-3 text-green-600 shrink-0" />}
                                    </div>
                                    <div className={`px-2 py-1 flex justify-between items-center text-xs ${
                                      match.winner && match.winner === match.player2 ? 'bg-green-50 font-bold' : 'bg-white'
                                    }`}>
                                      <span className="truncate flex-1">{match.player2_name || 'TBD'}</span>
                                      {match.winner === match.player2 && <Trophy className="h-3 w-3 text-green-600 shrink-0" />}
                                    </div>
                                    {match.status !== 'waiting' && (
                                      <div className={`px-1 py-0.5 text-[9px] text-center ${
                                        match.status === 'in_progress' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'
                                      }`}>
                                        {match.status === 'in_progress' ? `En cours${match.table_number ? ` T${match.table_number}` : ''}` : 'Termine'}
                                      </div>
                                    )}
                                  </div>
                                  {roundIdx < sortedElimRounds.length - 1 && (
                                    <div className="flex flex-col items-center" style={{ width: 16 }}>
                                      <div className="border-t-2 border-gray-400 w-full" />
                                      {matchIdx % 2 === 0 && (
                                        <div className="border-r-2 border-gray-400" style={{ minHeight: spacingMultiplier * (matchHeight + baseGap) / 2 }} />
                                      )}
                                    </div>
                                  )}
                                </motion.div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
