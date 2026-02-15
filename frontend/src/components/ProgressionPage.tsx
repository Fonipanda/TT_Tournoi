"use client";

import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

const ROUND_ORDER = ['Pool', '1/64', '1/32', '1/16', '1/8', '1/4', '1/2', 'Petite Finale', 'Finale'];
const MATCH_H = 52;
const BASE_GAP = 8;
const COL_W = 210;
const EDGE_W = 24;

function MatchCard({ match }: { match: Match }) {
  return (
    <div className={`border rounded overflow-hidden ${
      match.status === 'finished' ? 'border-green-500' :
      match.status === 'in_progress' ? 'border-red-500 ring-1 ring-red-200' : 'border-gray-300'
    }`} style={{ minHeight: MATCH_H }}>
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
  );
}

function PoolCard({ poolName, pMatches }: { poolName: string; pMatches: Match[] }) {
  const playerIds = new Set<string>();
  pMatches.forEach(m => { if (m.player1) playerIds.add(m.player1); if (m.player2) playerIds.add(m.player2); });
  const playerList = Array.from(playerIds);
  const playerNames: Record<string, string> = {};
  pMatches.forEach(m => {
    if (m.player1) playerNames[m.player1] = m.player1_name || '?';
    if (m.player2) playerNames[m.player2] = m.player2_name || '?';
  });
  const wins: Record<string, number> = {};
  playerList.forEach(pid => { wins[pid] = 0; });
  pMatches.forEach(m => {
    if (m.status === 'finished' && m.winner) {
      wins[m.winner] = (wins[m.winner] || 0) + 1;
    }
  });
  const ranking = [...playerList].sort((a, b) => (wins[b] || 0) - (wins[a] || 0));
  const allDone = pMatches.every(m => m.status === 'finished');
  const inProgress = pMatches.some(m => m.status === 'in_progress');

  return (
    <div className={`border rounded-lg overflow-hidden text-xs ${
      allDone ? 'border-green-500' : inProgress ? 'border-orange-400' : 'border-gray-300'
    }`} style={{ minHeight: MATCH_H, width: '100%' }}>
      <div className={`px-2 py-1 font-bold text-white text-[10px] ${allDone ? 'bg-green-700' : 'bg-blue-800'}`}>
        {poolName}
        {allDone && <span className="ml-1 font-normal opacity-80">OK</span>}
        {inProgress && <span className="ml-1 font-normal text-yellow-200">...</span>}
      </div>
      <div className="px-2 py-1 space-y-0.5">
        {ranking.map((pid, ri) => (
          <div key={pid} className={`flex justify-between items-center ${
            ri < 2 && allDone ? 'text-green-700 font-semibold' : ri >= 2 && allDone ? 'text-red-400 line-through' : ''
          }`}>
            <span className="truncate">{ri + 1}. {playerNames[pid]?.split(' ').map(n => n[0]).join('.') || '?'}</span>
            <span className="ml-1">{wins[pid]}V</span>
          </div>
        ))}
      </div>
    </div>
  );
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

  const { poolGroups, elimRounds, sortedPoolNames, sortedElimRounds, allColumns } = useMemo(() => {
    const poolMatches = filteredMatches.filter(m => (m.round_name || '').startsWith('Pool'));
    const elimMatches = filteredMatches.filter(m => !(m.round_name || '').startsWith('Pool'));

    const pg: Record<string, Match[]> = {};
    poolMatches.forEach(m => {
      const pn = m.round_name || 'Pool';
      if (!pg[pn]) pg[pn] = [];
      pg[pn].push(m);
    });
    const spn = Object.keys(pg).sort();

    const er: Record<string, Match[]> = {};
    elimMatches.forEach(m => {
      const rn = m.round_name || `Tour ${m.round_number}`;
      if (!er[rn]) er[rn] = [];
      er[rn].push(m);
    });
    const ser = Object.keys(er).sort((a, b) => {
      const ai = ROUND_ORDER.indexOf(a);
      const bi = ROUND_ORDER.indexOf(b);
      return (ai === -1 ? 50 : ai) - (bi === -1 ? 50 : bi);
    });

    const cols: { type: 'pool' | 'elim'; name: string; items: Match[] | string[] }[] = [];
    if (spn.length > 0) cols.push({ type: 'pool', name: 'Poules', items: spn });
    ser.forEach(rn => cols.push({ type: 'elim', name: rn, items: er[rn] }));

    return { poolGroups: pg, elimRounds: er, sortedPoolNames: spn, sortedElimRounds: ser, allColumns: cols };
  }, [filteredMatches]);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const hasPool = sortedPoolNames.length > 0;
  const elimStartIdx = hasPool ? 1 : 0;

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
              {[...brackets].sort((a, b) => a.name.localeCompare(b.name, 'fr')).map((b) => (
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
        <Card>
          <CardHeader>
            <CardTitle>Arbre du tournoi</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto pb-4">
              <div className="flex min-w-max items-start">
                {allColumns.map((col, colIdx) => {
                  if (col.type === 'pool') {
                    const poolNames = col.items as string[];
                    const poolCount = poolNames.length;
                    const firstElimCount = sortedElimRounds.length > 0 ? elimRounds[sortedElimRounds[0]].length : 0;
                    const poolCardH = 80;
                    const poolGap = 6;
                    return (
                      <div key="pools" className="flex items-start">
                        <div className="flex flex-col" style={{ minWidth: COL_W }}>
                          <h4 className="text-center font-bold text-xs bg-blue-900 text-white py-1.5 rounded mx-1 mb-2">
                            Poules
                          </h4>
                          <div className="flex flex-col" style={{ gap: poolGap }}>
                            {poolNames.map((poolName, pIdx) => (
                              <motion.div
                                key={poolName}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: pIdx * 0.03 }}
                              >
                                <PoolCard poolName={poolName} pMatches={poolGroups[poolName]} />
                              </motion.div>
                            ))}
                          </div>
                        </div>
                        {sortedElimRounds.length > 0 && (
                          <svg
                            width={EDGE_W}
                            style={{ 
                              marginTop: 30,
                              height: Math.max(
                                poolCount * (poolCardH + poolGap),
                                firstElimCount * (MATCH_H + BASE_GAP) + (firstElimCount > 0 ? 0 : MATCH_H)
                              )
                            }}
                            className="shrink-0"
                          >
                            {poolNames.map((_, pIdx) => {
                              const poolY = pIdx * (poolCardH + poolGap) + poolCardH / 2;
                              const targetIdx = Math.floor(pIdx * firstElimCount / Math.max(poolCount, 1));
                              const elimY = targetIdx * (MATCH_H + BASE_GAP) + MATCH_H / 2;
                              return (
                                <path
                                  key={pIdx}
                                  d={`M 0 ${poolY} C ${EDGE_W / 2} ${poolY} ${EDGE_W / 2} ${elimY} ${EDGE_W} ${elimY}`}
                                  fill="none"
                                  stroke="#9CA3AF"
                                  strokeWidth="1.5"
                                />
                              );
                            })}
                          </svg>
                        )}
                      </div>
                    );
                  }

                  const roundName = col.name;
                  const roundIdx = colIdx - elimStartIdx;
                  const roundMatches = col.items as Match[];
                  const spacingMultiplier = Math.pow(2, roundIdx);
                  const isLast = colIdx === allColumns.length - 1;

                  return (
                    <div key={roundName} className="flex items-start">
                      <div className="flex flex-col" style={{ minWidth: COL_W }}>
                        <h4 className={`text-center font-bold text-xs py-1.5 rounded mx-1 mb-2 ${
                          roundName === 'Finale' ? 'bg-yellow-600 text-white' :
                          roundName === 'Petite Finale' ? 'bg-orange-600 text-white' :
                          'bg-gray-800 text-white'
                        }`}>
                          {roundName}
                        </h4>
                        <div className="flex flex-col" style={{ gap: 0 }}>
                          {roundMatches.map((match, matchIdx) => {
                            const topPad = roundIdx === 0 ? 0 : (spacingMultiplier - 1) * (MATCH_H + BASE_GAP) / 2;
                            const matchPad = matchIdx === 0 ? topPad : (spacingMultiplier - 1) * (MATCH_H + BASE_GAP);
                            return (
                              <motion.div
                                key={match.id}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: matchIdx * 0.05 }}
                                style={{ paddingTop: matchPad }}
                              >
                                <MatchCard match={match} />
                              </motion.div>
                            );
                          })}
                        </div>
                      </div>
                      {!isLast && (
                        <svg
                          width={EDGE_W}
                          style={{
                            marginTop: 30,
                            height: roundMatches.length * spacingMultiplier * (MATCH_H + BASE_GAP) + MATCH_H
                          }}
                          className="shrink-0"
                        >
                          {roundMatches.map((_, matchIdx) => {
                            const topPad = roundIdx === 0 ? 0 : (spacingMultiplier - 1) * (MATCH_H + BASE_GAP) / 2;
                            const yPos = topPad + matchIdx * spacingMultiplier * (MATCH_H + BASE_GAP) + MATCH_H / 2;
                            const nextSpacing = spacingMultiplier * 2;
                            const nextTopPad = (nextSpacing - 1) * (MATCH_H + BASE_GAP) / 2;
                            const nextMatchIdx = Math.floor(matchIdx / 2);
                            const nextY = nextTopPad + nextMatchIdx * nextSpacing * (MATCH_H + BASE_GAP) + MATCH_H / 2;

                            return (
                              <g key={matchIdx}>
                                <line x1="0" y1={yPos} x2={EDGE_W / 3} y2={yPos} stroke="#9CA3AF" strokeWidth="1.5" />
                                <line x1={EDGE_W / 3} y1={yPos} x2={EDGE_W / 3} y2={nextY} stroke="#9CA3AF" strokeWidth="1.5" />
                                {matchIdx % 2 === 1 && (
                                  <line x1={EDGE_W / 3} y1={nextY} x2={EDGE_W} y2={nextY} stroke="#9CA3AF" strokeWidth="1.5" />
                                )}
                                {matchIdx % 2 === 0 && (
                                  <line x1={EDGE_W / 3} y1={yPos} x2={EDGE_W} y2={yPos} stroke="#9CA3AF" strokeWidth="1.5" />
                                )}
                              </g>
                            );
                          })}
                        </svg>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {Object.keys(poolGroups).length > 0 && (
              <div className="mt-8 border-t pt-6">
                <h3 className="text-lg font-bold mb-4">Detail des Poules</h3>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {sortedPoolNames.map((poolName) => {
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
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
