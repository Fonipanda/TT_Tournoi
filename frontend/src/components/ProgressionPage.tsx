"use client";

import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/lib/api";
import { Trophy, Loader2, RefreshCcw } from "lucide-react";

interface Bracket { id: string; name: string; category: string; }

interface Match {
  id: string;
  player1: string;
  player2: string;
  player1_name: string;
  player2_name: string;
  player1_ranking: number | null;
  player2_ranking: number | null;
  winner: string | null;
  bracket_name: string;
  bracket: string;
  status: string;
  round_name: string;
  round_number: number;
  table_number: number | null;
  sets_player1: number;
  sets_player2: number;
  is_forfeit: boolean;
}

const ROUND_ORDER = ['Pool', '1/64', '1/32', '1/16', '1/8', '1/4', '1/2', 'Petite Finale', 'Finale'];
const MATCH_H = 66;
const MATCH_GAP = 14;
const COL_W = 230;
const CONN_W = 36;
const HEADER_H = 32;
const TOURNAMENT_COEF = 0.5;

const FFTT_TABLE = [
  { max: 24, vN: 6, vP: 6, dN: 5, dC: 5 },
  { max: 49, vN: 5.5, vP: 7, dN: 4.5, dC: 6 },
  { max: 99, vN: 5, vP: 8, dN: 4, dC: 7 },
  { max: 149, vN: 4, vP: 10, dN: 3, dC: 8 },
  { max: 199, vN: 3, vP: 13, dN: 2, dC: 10 },
  { max: 299, vN: 2, vP: 17, dN: 1, dC: 12.5 },
  { max: 399, vN: 1, vP: 22, dN: 0, dC: 16 },
  { max: 499, vN: 0.5, vP: 28, dN: 0, dC: 22 },
  { max: Infinity, vN: 0, vP: 40, dN: 0, dC: 29 },
];

function calcFFTTResult(winnerPts: number, loserPts: number) {
  const ecart = Math.abs(winnerPts - loserPts);
  const isPerf = winnerPts < loserPts && ecart >= 25;
  const row = FFTT_TABLE.find(r => ecart <= r.max)!;
  const gain = isPerf ? row.vP : row.vN;
  const loss = isPerf ? row.dC : row.dN;
  return {
    gain: Math.round(gain * TOURNAMENT_COEF * 10) / 10,
    loss: Math.round(loss * TOURNAMENT_COEF * 10) / 10,
    isPerf,
  };
}

export default function ProgressionPage() {
  const [loading, setLoading] = useState(true);
  const [brackets, setBrackets] = useState<Bracket[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [selectedBracket, setSelectedBracket] = useState<string>("");

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const tournaments = await api.tournaments.list();
      if (tournaments.length > 0) {
        const bracketsData = await api.brackets.list(tournaments[0].id);
        const sorted = [...bracketsData].sort((a: Bracket, b: Bracket) => a.name.localeCompare(b.name, 'fr'));
        setBrackets(sorted);
        if (sorted.length > 0 && !selectedBracket) {
          setSelectedBracket(sorted[0].id);
        }
      }
      const matchesData = await api.matches.list({});
      setMatches(matchesData);
    } catch (error) {
      console.error("Erreur chargement donnees:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredMatches = selectedBracket
    ? matches.filter(m => m.bracket === selectedBracket)
    : [];

  const { poolGroups, sortedPoolNames, mainElimRounds, sortedMainElim, petiteFinaleMatches, finaleMatches } = useMemo(() => {
    const poolM = filteredMatches.filter(m => (m.round_name || '').startsWith('Pool'));
    const elimM = filteredMatches.filter(m => !(m.round_name || '').startsWith('Pool'));

    const pg: Record<string, Match[]> = {};
    poolM.forEach(m => {
      const pn = m.round_name || 'Pool';
      if (!pg[pn]) pg[pn] = [];
      pg[pn].push(m);
    });

    const er: Record<string, Match[]> = {};
    elimM.forEach(m => {
      const rn = m.round_name || `Tour ${m.round_number}`;
      if (!er[rn]) er[rn] = [];
      er[rn].push(m);
    });

    const allElimKeys = Object.keys(er).sort((a, b) => {
      const ai = ROUND_ORDER.indexOf(a);
      const bi = ROUND_ORDER.indexOf(b);
      return (ai === -1 ? 50 : ai) - (bi === -1 ? 50 : bi);
    });

    const mainKeys = allElimKeys.filter(k => k !== 'Petite Finale');
    const pf = er['Petite Finale'] || [];
    const fin = er['Finale'] || [];

    return {
      poolGroups: pg,
      sortedPoolNames: Object.keys(pg).sort(),
      mainElimRounds: er,
      sortedMainElim: mainKeys,
      petiteFinaleMatches: pf,
      finaleMatches: fin,
    };
  }, [filteredMatches]);

  const bracketPositions = useMemo(() => {
    if (sortedMainElim.length === 0) return {};
    const pos: Record<string, number[]> = {};
    const r0 = sortedMainElim[0];
    const c0 = mainElimRounds[r0].length;
    pos[r0] = Array.from({ length: c0 }, (_, i) => i * (MATCH_H + MATCH_GAP));

    for (let ri = 1; ri < sortedMainElim.length; ri++) {
      const round = sortedMainElim[ri];
      const prev = sortedMainElim[ri - 1];
      const prevP = pos[prev];
      const count = mainElimRounds[round].length;
      pos[round] = Array.from({ length: count }, (_, j) => {
        const ti = j * 2;
        const bi = j * 2 + 1;
        const topY = prevP[ti] ?? prevP[prevP.length - 1] ?? 0;
        const botY = bi < prevP.length ? prevP[bi] : topY;
        return (topY + botY) / 2;
      });
    }
    return pos;
  }, [sortedMainElim, mainElimRounds]);

  const totalH = useMemo(() => {
    if (sortedMainElim.length === 0) return 300;
    const r0 = sortedMainElim[0];
    const p = bracketPositions[r0];
    if (!p || p.length === 0) return 300;
    return p[p.length - 1] + MATCH_H + 40;
  }, [bracketPositions, sortedMainElim]);

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
              <SelectValue placeholder="Selectionnez un tableau" />
            </SelectTrigger>
            <SelectContent>
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
              <p className="text-sm text-muted-foreground mt-1">
                Les matchs apparaitront ici une fois generes dans Admin &gt; Arbre Tournoi
              </p>
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
              <div className="inline-flex items-start">

                {sortedMainElim.map((roundName, rIdx) => {
                  const roundMatches = mainElimRounds[roundName];
                  const positions = bracketPositions[roundName] || [];
                  const isLast = rIdx === sortedMainElim.length - 1;
                  const nextRound = !isLast ? sortedMainElim[rIdx + 1] : null;
                  const showPF = isLast && petiteFinaleMatches.length > 0;

                  return (
                    <div key={roundName} className="flex items-start">
                      <div style={{ width: COL_W }}>
                        <RoundHeader name={roundName} />
                        <div className="relative" style={{ minHeight: totalH }}>
                          {roundMatches.map((match, mIdx) => (
                            <motion.div
                              key={match.id}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: mIdx * 0.04 }}
                              style={{
                                position: 'absolute',
                                top: positions[mIdx] ?? 0,
                                left: 4,
                                width: COL_W - 8,
                              }}
                            >
                              <BracketMatchCard match={match} />
                            </motion.div>
                          ))}
                          {showPF && petiteFinaleMatches.map((match, i) => {
                            const pfY = (positions[positions.length - 1] ?? 0) + MATCH_H + 40;
                            return (
                              <div
                                key={match.id}
                                style={{
                                  position: 'absolute',
                                  top: pfY + i * (MATCH_H + 8),
                                  left: 4,
                                  width: COL_W - 8,
                                }}
                              >
                                <div className="bg-orange-600 text-white text-center font-bold text-[10px] py-1 rounded mb-1">
                                  Petite Finale (3e place)
                                </div>
                                <BracketMatchCard match={match} />
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {!isLast && nextRound && (
                        <BracketConnector
                          prevPositions={positions}
                          nextPositions={bracketPositions[nextRound] || []}
                          totalH={totalH}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {sortedPoolNames.length > 0 && (
              <PoolDetailSection
                poolGroups={poolGroups}
                sortedPoolNames={sortedPoolNames}
              />
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function RoundHeader({ name }: { name: string }) {
  const bg =
    name === 'Finale' ? 'bg-yellow-600' :
    name === 'Petite Finale' ? 'bg-orange-600' :
    name.startsWith('Pool') ? 'bg-blue-900' :
    'bg-gray-800';
  return (
    <div className={`${bg} text-white text-center font-bold text-xs py-1.5 rounded mx-1 mb-3`}
         style={{ height: HEADER_H, lineHeight: `${HEADER_H - 6}px` }}>
      {name}
    </div>
  );
}

function BracketMatchCard({ match }: { match: Match }) {
  const fin = match.status === 'finished';
  const live = match.status === 'in_progress';
  const p1W = match.winner === match.player1;
  const p2W = match.winner === match.player2;
  const hasRankings = match.player1_ranking && match.player2_ranking;

  const renderPoints = (isThisPlayer1: boolean) => {
    if (!fin || !match.winner || !hasRankings) return null;
    const isW = isThisPlayer1 ? p1W : p2W;
    const myPts = Number(isThisPlayer1 ? match.player1_ranking : match.player2_ranking);
    const oppPts = Number(isThisPlayer1 ? match.player2_ranking : match.player1_ranking);
    const winnerPts = isW ? myPts : oppPts;
    const loserPts = isW ? oppPts : myPts;
    const r = calcFFTTResult(winnerPts, loserPts);
    return (
      <span className={isW ? 'text-green-600' : 'text-red-500'}>
        {isW ? ` +${r.gain}` : ` -${r.loss}`}
        {r.isPerf && <span className="font-bold ml-0.5">{isW ? 'P' : 'C'}</span>}
      </span>
    );
  };

  return (
    <div
      className={`rounded-lg overflow-hidden border-2 shadow-sm ${
        fin ? 'border-green-400' :
        live ? 'border-red-400 shadow-md shadow-red-100' :
        'border-gray-200'
      }`}
      style={{ height: MATCH_H }}
    >
      <div className={`flex items-center justify-between px-2 border-b text-xs ${
        p1W ? 'bg-green-50 font-bold text-green-900' : 'bg-white text-gray-700'
      }`} style={{ height: 24 }}>
        <span className="truncate flex-1">{match.player1_name || 'TBD'}</span>
        <span className="text-[9px] text-gray-500 ml-1 shrink-0 flex items-center gap-0.5">
          {match.player1_ranking ? `${match.player1_ranking}` : ''}
          {renderPoints(true)}
        </span>
        {p1W && <Trophy className="h-3 w-3 text-green-600 shrink-0" />}
      </div>
      <div className={`flex items-center justify-between px-2 text-xs ${
        p2W ? 'bg-green-50 font-bold text-green-900' : 'bg-white text-gray-700'
      }`} style={{ height: 24 }}>
        <span className="truncate flex-1">{match.player2_name || 'TBD'}</span>
        <span className="text-[9px] text-gray-500 ml-1 shrink-0 flex items-center gap-0.5">
          {match.player2_ranking ? `${match.player2_ranking}` : ''}
          {renderPoints(false)}
        </span>
        {p2W && <Trophy className="h-3 w-3 text-green-600 shrink-0" />}
      </div>
      <div
        className={`text-[10px] text-center ${
          live ? 'bg-red-500 text-white font-medium' :
          fin ? 'bg-green-100 text-green-700' :
          'bg-gray-50 text-gray-400'
        }`}
        style={{ height: MATCH_H - 48, lineHeight: `${MATCH_H - 48}px` }}
      >
        {live
          ? `En cours${match.table_number ? ` - Table ${match.table_number}` : ''}`
          : fin ? 'Termine' : 'A venir'}
      </div>
    </div>
  );
}

function BracketConnector({
  prevPositions,
  nextPositions,
  totalH,
}: {
  prevPositions: number[];
  nextPositions: number[];
  totalH: number;
}) {
  return (
    <div style={{ width: CONN_W, marginTop: HEADER_H + 12 }}>
      <svg width={CONN_W} height={totalH} style={{ display: 'block' }}>
        {nextPositions.map((nextY, j) => {
          const ti = j * 2;
          const bi = j * 2 + 1;

          if (ti >= prevPositions.length) return null;

          const topY = prevPositions[ti] + MATCH_H / 2;
          const botY = bi < prevPositions.length
            ? prevPositions[bi] + MATCH_H / 2
            : topY;
          const midY = nextY + MATCH_H / 2;
          const vx = CONN_W * 0.45;

          if (bi >= prevPositions.length) {
            return (
              <line key={j} x1={0} y1={topY} x2={CONN_W} y2={midY}
                    stroke="#CBD5E1" strokeWidth="2" />
            );
          }

          return (
            <g key={j}>
              <line x1={0} y1={topY} x2={vx} y2={topY} stroke="#CBD5E1" strokeWidth="2" />
              <line x1={0} y1={botY} x2={vx} y2={botY} stroke="#CBD5E1" strokeWidth="2" />
              <line x1={vx} y1={topY} x2={vx} y2={botY} stroke="#CBD5E1" strokeWidth="2" />
              <line x1={vx} y1={midY} x2={CONN_W} y2={midY} stroke="#CBD5E1" strokeWidth="2" />
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function PoolColumn({
  poolGroups,
  sortedPoolNames,
  totalH,
}: {
  poolGroups: Record<string, Match[]>;
  sortedPoolNames: string[];
  totalH: number;
}) {
  const poolCardH = (pn: string) => {
    const pm = poolGroups[pn] || [];
    const ids = new Set<string>();
    pm.forEach(m => { if (m.player1) ids.add(m.player1); if (m.player2) ids.add(m.player2); });
    return 22 + ids.size * 18;
  };
  const totalPoolsH = sortedPoolNames.reduce((s, pn) => s + poolCardH(pn), 0);
  const gap = sortedPoolNames.length > 1
    ? Math.max(4, (totalH - totalPoolsH) / (sortedPoolNames.length - 1))
    : 0;

  let cumY = 0;
  const poolPositions = sortedPoolNames.map((pn) => {
    const y = cumY;
    cumY += poolCardH(pn) + gap;
    return y;
  });

  return (
    <div style={{ width: COL_W }}>
      <RoundHeader name="Poules" />
      <div className="relative" style={{ height: totalH }}>
        {sortedPoolNames.map((poolName, pIdx) => {
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
          const ffttPts: Record<string, number> = {};
          playerList.forEach(pid => { wins[pid] = 0; ffttPts[pid] = 0; });
          pMatches.forEach(m => {
            if (m.status === 'finished' && m.winner) {
              wins[m.winner] = (wins[m.winner] || 0) + 1;
              ffttPts[m.winner] = (ffttPts[m.winner] || 0) + 2;
              const loser = m.winner === m.player1 ? m.player2 : m.player1;
              if (loser) ffttPts[loser] = (ffttPts[loser] || 0) + 1;
            }
          });
          const ranking = [...playerList].sort((a, b) => (ffttPts[b] || 0) - (ffttPts[a] || 0));
          const allDone = pMatches.every(m => m.status === 'finished');
          const inProg = pMatches.some(m => m.status === 'in_progress');

          return (
            <motion.div
              key={poolName}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: pIdx * 0.03 }}
              style={{
                position: 'absolute',
                top: poolPositions[pIdx],
                left: 4,
                width: COL_W - 8,
              }}
            >
              <div className={`rounded-lg overflow-hidden border-2 text-xs ${
                allDone ? 'border-green-400' : inProg ? 'border-orange-300' : 'border-gray-200'
              }`}>
                <div className={`px-2 py-1 font-bold text-white text-[11px] ${
                  allDone ? 'bg-green-700' : 'bg-blue-800'
                }`}>
                  {poolName}
                  {allDone && <span className="ml-1 font-normal opacity-75">OK</span>}
                  {inProg && <span className="ml-1 text-yellow-300">...</span>}
                </div>
                <div className="bg-white">
                  {ranking.map((pid, ri) => (
                    <div key={pid} className={`flex justify-between items-center px-2 py-[2px] border-b last:border-b-0 ${
                      ri < 2 && allDone ? 'bg-green-50 text-green-800 font-semibold' :
                      ri >= 2 && allDone ? 'text-gray-400 line-through' : 'text-gray-700'
                    }`}>
                      <span className="truncate">{ri + 1}. {playerNames[pid]}</span>
                      <span className="ml-2 font-bold text-[10px]">{ffttPts[pid]}pt{ffttPts[pid] > 1 ? 's' : ''}</span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

function PoolToElimConnector({
  poolNames,
  poolGroups,
  firstElimPositions,
  totalH,
}: {
  poolNames: string[];
  poolGroups: Record<string, Match[]>;
  firstElimPositions: number[];
  totalH: number;
}) {
  const poolCardH = (pn: string) => {
    const pm = poolGroups[pn] || [];
    const ids = new Set<string>();
    pm.forEach(m => { if (m.player1) ids.add(m.player1); if (m.player2) ids.add(m.player2); });
    return 22 + ids.size * 18;
  };
  const totalPoolsH = poolNames.reduce((s, pn) => s + poolCardH(pn), 0);
  const gap = poolNames.length > 1
    ? Math.max(4, (totalH - totalPoolsH) / (poolNames.length - 1))
    : 0;

  let cumY = 0;
  const poolCenters = poolNames.map((pn) => {
    const h = poolCardH(pn);
    const center = cumY + h / 2;
    cumY += h + gap;
    return center;
  });

  const elimCenters = firstElimPositions.map(y => y + MATCH_H / 2);

  return (
    <div style={{ width: CONN_W, marginTop: HEADER_H + 12 }}>
      <svg width={CONN_W} height={totalH} style={{ display: 'block' }}>
        {poolCenters.map((py, pIdx) => {
          const targetIdx = Math.min(
            Math.floor(pIdx * elimCenters.length / Math.max(poolCenters.length, 1)),
            elimCenters.length - 1
          );
          const ey = elimCenters[targetIdx] ?? py;
          return (
            <path
              key={pIdx}
              d={`M 0 ${py} C ${CONN_W * 0.5} ${py} ${CONN_W * 0.5} ${ey} ${CONN_W} ${ey}`}
              fill="none"
              stroke="#CBD5E1"
              strokeWidth="1.5"
              strokeDasharray="4 2"
            />
          );
        })}
      </svg>
    </div>
  );
}

function PoolDetailSection({
  poolGroups,
  sortedPoolNames,
}: {
  poolGroups: Record<string, Match[]>;
  sortedPoolNames: string[];
}) {
  return (
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
          const ffttPts: Record<string, number> = {};
          const matchResults: Record<string, string> = {};
          playerList.forEach(pid => { wins[pid] = 0; ffttPts[pid] = 0; });
          pMatches.forEach(m => {
            const k1 = `${m.player1}_${m.player2}`;
            const k2 = `${m.player2}_${m.player1}`;
            if (m.status === 'finished' && m.winner) {
              wins[m.winner] = (wins[m.winner] || 0) + 1;
              ffttPts[m.winner] = (ffttPts[m.winner] || 0) + 2;
              const loser = m.winner === m.player1 ? m.player2 : m.player1;
              if (loser) ffttPts[loser] = (ffttPts[loser] || 0) + 1;
              matchResults[k1] = m.winner === m.player1 ? 'V' : 'D';
              matchResults[k2] = m.winner === m.player2 ? 'V' : 'D';
            } else if (m.status === 'in_progress') {
              matchResults[k1] = '...'; matchResults[k2] = '...';
            } else { matchResults[k1] = '-'; matchResults[k2] = '-'; }
          });
          const ranking = [...playerList].sort((a, b) => (ffttPts[b] || 0) - (ffttPts[a] || 0));
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
                    {playerList.map((_, ci) => (
                      <th key={ci} className="text-center px-2 py-2 w-10">{ci + 1}</th>
                    ))}
                    <th className="text-center px-3 py-2 w-10">Pts</th>
                    <th className="text-center px-3 py-2 w-20">Rang</th>
                  </tr>
                </thead>
                <tbody>
                  {ranking.map((pid, ri) => (
                    <tr key={pid} className={`border-t ${ri < 2 && allDone ? 'bg-green-50' : ''}`}>
                      <td className="px-3 py-2 font-bold text-gray-500">{ri + 1}</td>
                      <td className="px-3 py-2 font-medium truncate max-w-[140px]">{playerNames[pid]}</td>
                      {playerList.map((opId, ci) => {
                        if (playerList.indexOf(pid) === ci)
                          return <td key={ci} className="text-center px-2 py-2 bg-gray-200">X</td>;
                        const res = matchResults[`${pid}_${opId}`] || '-';
                        return (
                          <td key={ci} className={`text-center px-2 py-2 font-bold ${
                            res === 'V' ? 'text-green-600' :
                            res === 'D' ? 'text-red-500' :
                            res === '...' ? 'text-orange-500' : 'text-gray-400'
                          }`}>{res}</td>
                        );
                      })}
                      <td className="text-center px-3 py-2 font-bold">{ffttPts[pid] || 0}</td>
                      <td className={`text-center px-3 py-2 font-bold ${
                        allDone ? (ri < 2 ? 'text-green-600' : 'text-red-500') : 'text-gray-400'
                      }`}>
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
  );
}
