"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { Radio, Clock, Loader2, Maximize, Minimize } from "lucide-react";

interface TableData {
  id: string;
  table_number: number;
  room: { id: string; name: string };
  status: string;
  orientation: string;
  player1: { id: string; name: string; club: string; ranking: string } | null;
  player2: { id: string; name: string; club: string; ranking: string } | null;
  match_start_time: string | null;
}

interface Room {
  id: string;
  name: string;
  rows: number;
  tables_per_row: number;
  entrance_markers?: {side: string; pct: number}[];
  buvette_markers?: {side: string; pct: number}[];
  wc_markers?: {side: string; pct: number}[];
  arrow_markers?: {side: string; pct: number; angle: number}[];
  rotation?: number;
}

export default function LivePage({ tournamentId }: { tournamentId?: string }) {
  const [tables, setTables] = useState<TableData[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentRoomIdx, setCurrentRoomIdx] = useState(0);
  const [autoScroll, setAutoScroll] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const fullscreenRef = useRef<HTMLDivElement>(null);

  const fetchData = async () => {
    try {
      const [tablesData, roomsData] = await Promise.all([
        api.live.tables(tournamentId),
        api.rooms.list(tournamentId)
      ]);
      setTables(tablesData);
      setRooms(roomsData);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [tournamentId]);

  const toggleFullscreen = useCallback(() => {
    if (!fullscreenRef.current) return;
    if (!document.fullscreenElement) {
      fullscreenRef.current.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }, []);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  const roomNames = Object.keys(
    tables.reduce((acc, t) => { acc[t.room?.name || "Sans salle"] = true; return acc; }, {} as Record<string, boolean>)
  );

  useEffect(() => {
    if (!autoScroll || roomNames.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentRoomIdx((prev) => (prev + 1) % roomNames.length);
    }, 10000);
    return () => clearInterval(timer);
  }, [autoScroll, roomNames.length]);

  const formatDuration = (startTime: string | null) => {
    if (!startTime) return null;
    const start = new Date(startTime);
    const now = new Date();
    const diff = Math.floor((now.getTime() - start.getTime()) / 1000 / 60);
    return `${diff} min`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <Card className="bg-red-50 border-red-200">
        <CardContent className="pt-6">
          <p className="text-red-600">Erreur: {error}</p>
        </CardContent>
      </Card>
    );
  }

  const groupedTables = tables.reduce((acc, table) => {
    const roomName = table.room?.name || "Sans salle";
    if (!acc[roomName]) acc[roomName] = [];
    acc[roomName].push(table);
    return acc;
  }, {} as Record<string, TableData[]>);

  const formatShortName = (fullName: string) => {
    if (!fullName) return '?';
    const parts = fullName.trim().split(/\s+/);
    if (parts.length < 2) return fullName.toUpperCase();
    const lastName = parts[0].toUpperCase();
    const firstInitial = parts[parts.length - 1].charAt(0).toUpperCase();
    return `${lastName}.${firstInitial}`;
  };

  const PingPongTable = ({ table, index }: { table: TableData; index: number }) => {
    const isOccupied = table.status === "occupied";
    const isFree = table.status === "free";
    const isVertical = table.orientation === "vertical";
    
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: index * 0.05 }}
      >
        <div 
          className={`relative rounded-lg border-4 ${
            isOccupied ? 'border-red-600 bg-red-700' : 'border-green-600 bg-green-700'
          } shadow-lg overflow-hidden`}
          style={{ width: isVertical ? '140px' : '200px', height: isVertical ? '200px' : '140px' }}
        >
          <div className="absolute inset-2 border-2 border-white/50 rounded">
            {isVertical ? (
              <>
                <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-white/70 transform -translate-x-1/2"></div>
                <div className="absolute left-0 right-0 top-1/2 h-0.5 bg-white/70 transform -translate-y-1/2"></div>
              </>
            ) : (
              <>
                <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-white/70 transform -translate-y-1/2"></div>
                <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-white/70 transform -translate-x-1/2"></div>
              </>
            )}
          </div>

          <div className="absolute top-1 left-1/2 transform -translate-x-1/2">
            <Badge 
              variant={isOccupied ? "destructive" : "success"} 
              className="text-xs font-bold"
            >
              Table {table.table_number}
            </Badge>
          </div>

          <div className="absolute bottom-1 left-1/2 transform -translate-x-1/2">
            <Badge variant="outline" className="bg-white/90 text-xs">
              {isOccupied ? "Occupee" : isFree ? "Libre" : "Maintenance"}
            </Badge>
          </div>
        </div>

        {isOccupied && table.player1 && table.player2 && (
          <div className="mt-2 p-2 bg-white rounded-lg border shadow-sm" style={{ width: isVertical ? '140px' : '200px' }}>
            <div className="flex items-center justify-between text-xs">
              <div className="flex-1 text-center min-w-0">
                <p className="font-semibold whitespace-nowrap text-[11px]" title={table.player1.name}>{formatShortName(table.player1.name)}</p>
                <p className="text-muted-foreground text-[10px]">
                  {table.player1.ranking} pts
                </p>
              </div>
              <div className="px-1 font-bold text-gray-400 shrink-0">VS</div>
              <div className="flex-1 text-center min-w-0">
                <p className="font-semibold whitespace-nowrap text-[11px]" title={table.player2.name}>{formatShortName(table.player2.name)}</p>
                <p className="text-muted-foreground text-[10px]">
                  {table.player2.ranking} pts
                </p>
              </div>
            </div>
            {table.match_start_time && (
              <div className="flex items-center justify-center gap-1 text-[10px] text-muted-foreground mt-1 pt-1 border-t">
                <Clock className="h-3 w-3" />
                {formatDuration(table.match_start_time)}
              </div>
            )}
          </div>
        )}
      </motion.div>
    );
  };

  return (
    <div className="space-y-6" ref={fullscreenRef} style={isFullscreen ? { background: '#111827', padding: '24px', overflow: 'auto' } : {}}>
      <Card className={isFullscreen ? 'bg-gray-900 border-gray-700' : ''}>
        <CardHeader>
          <CardTitle className={`flex items-center gap-2 ${isFullscreen ? 'text-white' : ''}`}>
            <Radio className="h-5 w-5 text-red-500" />
            Tables en temps reel
            <div className="ml-auto flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={toggleFullscreen}
                className={isFullscreen ? 'border-gray-600 text-gray-300 hover:bg-gray-700' : ''}>
                {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
                <span className="ml-1 hidden md:inline">{isFullscreen ? 'Quitter' : 'Plein ecran'}</span>
              </Button>
              {roomNames.length > 1 && (
                <>
                  <button
                    onClick={() => setAutoScroll(!autoScroll)}
                    className={`text-xs px-2 py-1 rounded ${autoScroll ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}
                  >
                    {autoScroll ? 'Defilement auto ON' : 'Defilement auto OFF'}
                  </button>
                  <div className="flex gap-1">
                    {roomNames.map((name, i) => (
                      <button key={name} onClick={() => { setCurrentRoomIdx(i); setAutoScroll(false); }}
                        className={`w-2 h-2 rounded-full ${i === currentRoomIdx ? 'bg-blue-600' : 'bg-gray-300'}`} />
                    ))}
                  </div>
                </>
              )}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-4">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-green-700 border-2 border-green-600"></div>
              <span className="text-sm">Libre</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-red-700 border-2 border-red-600"></div>
              <span className="text-sm">Occupee</span>
            </div>
          </div>

          {Object.keys(groupedTables).length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              Aucune table configuree. Configurez les salles et tables dans l'onglet Admin.
            </p>
          ) : (
            Object.entries(groupedTables)
              .filter((_, i) => roomNames.length <= 1 || i === currentRoomIdx)
              .map(([roomName, roomTables]) => {
              const room = rooms.find(r => r.name === roomName);
              const gridRows = room?.rows || Math.ceil(roomTables.length / 4);
              const gridCols = room?.tables_per_row || Math.min(4, roomTables.length);
              
              const allMarkers = [
                ...(room?.entrance_markers || []).map((m: any) => ({ ...m, _type: 'entrance' })),
                ...(room?.buvette_markers || []).map((m: any) => ({ ...m, _type: 'buvette' })),
                ...(room?.wc_markers || []).map((m: any) => ({ ...m, _type: 'wc' })),
                ...(room?.arrow_markers || []).map((m: any) => ({ ...m, _type: 'arrow' })),
              ];

              return (
                <motion.div
                  key={roomName}
                  initial={{ opacity: 0, x: 50 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -50 }}
                  className="mb-8 last:mb-0"
                >
                  <h3 className="text-lg font-semibold mb-4 text-gray-700 flex items-center gap-2">
                    <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                      {roomName}
                    </span>
                    <span className="text-sm font-normal text-muted-foreground">
                      ({roomTables.length} tables)
                    </span>
                  </h3>

                  <div className="inline-block" style={{ transform: `rotate(${room?.rotation || 0}deg)`, transition: 'transform 0.3s', transformOrigin: 'center' }}>
                  <div className="relative border-4 border-gray-800 rounded-md bg-gray-100" style={{ padding: '24px' }}>
                    {allMarkers.map((mk: any, k: number) => {
                      const ps: any = { position: 'absolute' as const, zIndex: 10 };
                      if (mk.side === 'top') { ps.top = '-14px'; ps.left = `${mk.pct}%`; ps.transform = 'translateX(-50%)'; }
                      else if (mk.side === 'bottom') { ps.bottom = '-14px'; ps.left = `${mk.pct}%`; ps.transform = 'translateX(-50%)'; }
                      else if (mk.side === 'left') { ps.left = '-14px'; ps.top = `${mk.pct}%`; ps.transform = 'translateY(-50%)'; }
                      else { ps.right = '-14px'; ps.top = `${mk.pct}%`; ps.transform = 'translateY(-50%)'; }
                      const cls: any = {
                        entrance: 'bg-yellow-300 border-yellow-600 text-yellow-900',
                        buvette: 'bg-orange-300 border-orange-600 text-orange-900',
                        wc: 'bg-purple-300 border-purple-600 text-purple-900',
                        arrow: 'bg-gray-900 text-white border-gray-700',
                      };
                      const lbl: any = { entrance: 'ENTREE', buvette: 'BUVETTE', wc: 'WC', arrow: '\u2191' };
                      const extra = mk._type === 'arrow' ? ` rotate(${mk.angle || 0}deg)` : '';
                      return (
                        <div key={`live-mk-${k}`}
                          style={{ ...ps, transform: (ps.transform || '') + extra }}
                          className={`px-1.5 py-0.5 text-[9px] font-bold rounded border ${cls[mk._type]}`}>
                          {lbl[mk._type]}
                        </div>
                      );
                    })}

                    <div className="grid gap-3"
                      style={{
                        gridTemplateColumns: `repeat(${gridCols}, minmax(200px, 1fr))`,
                        gridTemplateRows: `repeat(${gridRows}, 1fr)`,
                      }}
                    >
                      {Array.from({ length: gridRows * gridCols }).map((_, idx) => {
                        const ir = Math.floor(idx / gridCols);
                        const ic = idx % gridCols;
                        const table = roomTables.find(t => {
                          const tRow = (t as any).position_row;
                          const tCol = (t as any).position_col;
                          return tRow !== undefined ? tRow === ir && tCol === ic : false;
                        }) || roomTables[ir * gridCols + ic];

                        if (!table) return <div key={`live-${roomName}-${ir}-${ic}`} />;

                        return (
                          <div key={`live-${roomName}-${ir}-${ic}`} className="flex justify-center">
                            <PingPongTable table={table} index={idx} />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  </div>
                </motion.div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}
