"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { api } from "@/lib/api";
import { 
  Settings, Lock, Trophy, Users, LayoutGrid, 
  Coffee, Plus, Trash2, Loader2, AlertCircle,
  CheckCircle, Play, Square, LogOut, Pencil, QrCode, RotateCw, GitBranch, Medal
} from "lucide-react";

interface Tournament {
  id: string;
  name: string;
  description: string;
  is_active: boolean;
}

interface Bracket {
  id: string;
  tournament: string;
  name: string;
  category: string;
  min_points: number | null;
  max_points: number | null;
  max_players: number;
  entry_fee: number;
  day: string | null;
  checkin_end: string | null;
  start_time: string | null;
  registered_count?: number;
}

interface Room {
  id: string;
  name: string;
  description: string;
  rows: number;
  tables_per_row: number;
}

interface Table {
  id: string;
  table_number: number;
  room: string;
  room_name: string;
  status: string;
  position_row: number;
  position_col: number;
  orientation: string;
}

interface Match {
  id: string;
  player1_name: string;
  player2_name: string;
  bracket_name: string;
  status: string;
  table_number: number | null;
  sets_player1: number;
  sets_player2: number;
}

interface MenuSection {
  id: string;
  name: string;
  order: number;
}

interface MenuItem {
  id: string;
  section: string;
  name: string;
  price: number;
  is_available: boolean;
}

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showLoginDialog, setShowLoginDialog] = useState(true);
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loggingIn, setLoggingIn] = useState(false);

  const [adminTab, setAdminTab] = useState("tournaments");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const router = useRouter();

  const [eliminationType, setEliminationType] = useState<"single" | "double">("single");
  const [hasThirdPlace, setHasThirdPlace] = useState(true);

  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [brackets, setBrackets] = useState<Bracket[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [menuSections, setMenuSections] = useState<MenuSection[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [players, setPlayers] = useState<any[]>([]);

  const [newTournament, setNewTournament] = useState({ name: "", description: "" });
  const [newBracket, setNewBracket] = useState({ 
    tournament: "", name: "", category: "", 
    min_points: "", max_points: "", max_players: "16", entry_fee: "5",
    day: "", checkin_end: "", start_time: ""
  });
  const [newRoom, setNewRoom] = useState({ name: "", rows: "2", tables_per_row: "4" });
  const [newTable, setNewTable] = useState({ room: "" });
  const [newMatch, setNewMatch] = useState({ bracket: "", player1: "", player2: "" });
  const [registrations, setRegistrations] = useState<any[]>([]);
  const [newSection, setNewSection] = useState({ name: "" });
  const [newItem, setNewItem] = useState({ section: "", name: "", price: "" });

  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [selectedTable, setSelectedTable] = useState<string>("");
  const [finishScore, setFinishScore] = useState({ sets_player1: "", sets_player2: "" });

  const [editTournament, setEditTournament] = useState<Tournament | null>(null);
  const [editBracket, setEditBracket] = useState<Bracket | null>(null);
  const [editRoom, setEditRoom] = useState<Room | null>(null);
  const [editSection, setEditSection] = useState<MenuSection | null>(null);
  const [editItem, setEditItem] = useState<MenuItem | null>(null);
  const [draggedTable, setDraggedTable] = useState<Table | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("admin_token");
    if (token === "admin-token-local") {
      setIsAuthenticated(true);
      setShowLoginDialog(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      fetchAllData();
    }
  }, [isAuthenticated, adminTab]);

  const handleLogin = async () => {
    setLoggingIn(true);
    setLoginError(null);

    try {
      const result = await api.auth.adminLogin(loginUsername, loginPassword);
      if (result.success) {
        localStorage.setItem("admin_token", result.token);
        setIsAuthenticated(true);
        setShowLoginDialog(false);
      }
    } catch (err: any) {
      setLoginError(err.message || "Identifiants incorrects");
    } finally {
      setLoggingIn(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("admin_token");
    setIsAuthenticated(false);
    setShowLoginDialog(true);
    setLoginUsername("");
    setLoginPassword("");
    router.push("/");
  };

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [tournamentsData, roomsData, tablesData, playersData, sectionsData, registrationsData] = await Promise.all([
        api.tournaments.list(),
        api.rooms.list(),
        api.tables.list(),
        api.players.list(),
        api.menuSections.list(),
        api.registrations.list({}),
      ]);
      setTournaments(tournamentsData);
      setRooms(roomsData);
      setTables(tablesData);
      setPlayers(playersData);
      setMenuSections(sectionsData);
      setRegistrations(registrationsData);

      if (tournamentsData.length > 0) {
        const bracketsData = await api.brackets.list(tournamentsData[0].id);
        setBrackets(bracketsData);
      }

      const matchesData = await api.matches.list({});
      setMatches(matchesData);

      const itemsData = await api.menuItems.list();
      setMenuItems(itemsData);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const showSuccess = (msg: string) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(null), 3000);
  };

  const sortedBrackets = [...brackets].sort((a, b) => a.name.localeCompare(b.name, 'fr'));

  const getPlayersForBracket = (bracketId: string) => {
    if (!bracketId) return players;
    const bracketPlayerIds = registrations
      .filter(r => r.bracket === bracketId)
      .map(r => r.player);
    return players.filter(p => bracketPlayerIds.includes(p.id));
  };

  const createTournament = async () => {
    try {
      await api.tournaments.create(newTournament);
      setNewTournament({ name: "", description: "" });
      fetchAllData();
      showSuccess("Tournoi cree");
    } catch (err: any) {
      setError(err.message);
    }
  };

  const createBracket = async () => {
    try {
      await api.brackets.create({
        tournament: newBracket.tournament,
        name: newBracket.name,
        category: newBracket.category,
        min_points: newBracket.min_points ? parseInt(newBracket.min_points) : null,
        max_points: newBracket.max_points ? parseInt(newBracket.max_points) : null,
        max_players: parseInt(newBracket.max_players),
        entry_fee: parseFloat(newBracket.entry_fee),
        day: newBracket.day || null,
        checkin_end: newBracket.checkin_end || null,
        start_time: newBracket.start_time || null,
      });
      setNewBracket({ tournament: "", name: "", category: "", min_points: "", max_points: "", max_players: "16", entry_fee: "5", day: "", checkin_end: "", start_time: "" });
      fetchAllData();
      showSuccess("Tableau cree");
    } catch (err: any) {
      setError(err.message);
    }
  };

  const createRoom = async () => {
    try {
      await api.rooms.create({
        name: newRoom.name,
        rows: parseInt(newRoom.rows),
        tables_per_row: parseInt(newRoom.tables_per_row),
      });
      setNewRoom({ name: "", rows: "2", tables_per_row: "4" });
      fetchAllData();
      showSuccess("Salle creee");
    } catch (err: any) {
      setError(err.message);
    }
  };

  const createTable = async () => {
    try {
      const maxTableNumber = tables.length > 0 
        ? Math.max(...tables.map(t => t.table_number)) 
        : 0;
      await api.tables.create({
        room: newTable.room,
        table_number: maxTableNumber + 1,
      });
      setNewTable({ room: "" });
      fetchAllData();
      showSuccess("Table creee");
    } catch (err: any) {
      setError(err.message);
    }
  };

  const updateTablePosition = async (tableId: string, data: { position_row?: number; position_col?: number; orientation?: string }) => {
    try {
      await api.tables.update(tableId, data);
      fetchAllData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const toggleTableOrientation = async (table: Table) => {
    const newOrientation = table.orientation === 'horizontal' ? 'vertical' : 'horizontal';
    await updateTablePosition(table.id, { orientation: newOrientation });
  };

  const handleDragStart = (e: React.DragEvent, table: Table) => {
    setDraggedTable(table);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e: React.DragEvent, targetRow: number, targetCol: number, roomId: string) => {
    e.preventDefault();
    if (!draggedTable || draggedTable.room !== roomId) return;
    
    await updateTablePosition(draggedTable.id, { 
      position_row: targetRow, 
      position_col: targetCol 
    });
    setDraggedTable(null);
  };

  const createMatch = async () => {
    if (newMatch.player1 === newMatch.player2) {
      setError("Impossible de creer un match avec le meme joueur des deux cotes");
      return;
    }
    try {
      await api.matches.create({
        bracket: newMatch.bracket,
        player1: newMatch.player1,
        player2: newMatch.player2,
      });
      setNewMatch({ bracket: "", player1: "", player2: "" });
      fetchAllData();
      showSuccess("Match cree");
    } catch (err: any) {
      setError(err.message);
    }
  };

  const assignMatchToTable = async () => {
    if (!selectedMatch || !selectedTable) return;
    try {
      await api.matches.assignTable(selectedMatch.id, selectedTable);
      setSelectedMatch(null);
      setSelectedTable("");
      fetchAllData();
      showSuccess("Match assigne a la table");
    } catch (err: any) {
      setError(err.message);
    }
  };

  const finishMatch = async () => {
    if (!selectedMatch) return;
    try {
      await api.matches.finish(selectedMatch.id, {
        sets_player1: parseInt(finishScore.sets_player1),
        sets_player2: parseInt(finishScore.sets_player2),
        score_player1: 0,
        score_player2: 0,
      });
      setSelectedMatch(null);
      setFinishScore({ sets_player1: "", sets_player2: "" });
      fetchAllData();
      showSuccess("Match termine");
    } catch (err: any) {
      setError(err.message);
    }
  };

  const createMenuSection = async () => {
    try {
      await api.menuSections.create({ name: newSection.name, order: menuSections.length });
      setNewSection({ name: "" });
      fetchAllData();
      showSuccess("Section creee");
    } catch (err: any) {
      setError(err.message);
    }
  };

  const createMenuItem = async () => {
    try {
      await api.menuItems.create({
        section: newItem.section,
        name: newItem.name,
        price: parseFloat(newItem.price),
        is_available: true,
      });
      setNewItem({ section: "", name: "", price: "" });
      fetchAllData();
      showSuccess("Article cree");
    } catch (err: any) {
      setError(err.message);
    }
  };

  const deleteItem = async (type: string, id: string) => {
    try {
      switch (type) {
        case "tournament": await api.tournaments.delete(id); break;
        case "bracket": await api.brackets.delete(id); break;
        case "room": await api.rooms.delete(id); break;
        case "table": await api.tables.delete(id); break;
        case "match": await api.matches.delete(id); break;
        case "section": await api.menuSections.delete(id); break;
        case "item": await api.menuItems.delete(id); break;
      }
      fetchAllData();
      showSuccess("Element supprime");
    } catch (err: any) {
      setError(err.message);
    }
  };

  const updateTournament = async () => {
    if (!editTournament) return;
    try {
      await api.tournaments.update(editTournament.id, {
        name: editTournament.name,
        description: editTournament.description,
      });
      setEditTournament(null);
      fetchAllData();
      showSuccess("Tournoi modifie");
    } catch (err: any) {
      setError(err.message);
    }
  };

  const updateBracket = async () => {
    if (!editBracket) return;
    try {
      await api.brackets.update(editBracket.id, {
        tournament: editBracket.tournament,
        name: editBracket.name,
        category: editBracket.category,
        min_points: editBracket.min_points,
        max_points: editBracket.max_points,
        max_players: editBracket.max_players,
        entry_fee: editBracket.entry_fee,
        day: editBracket.day,
        checkin_end: editBracket.checkin_end,
        start_time: editBracket.start_time,
      });
      setEditBracket(null);
      fetchAllData();
      showSuccess("Tableau modifie");
    } catch (err: any) {
      setError(err.message);
    }
  };

  const updateRoom = async () => {
    if (!editRoom) return;
    try {
      await api.rooms.update(editRoom.id, {
        name: editRoom.name,
        description: editRoom.description,
      });
      setEditRoom(null);
      fetchAllData();
      showSuccess("Salle modifiee");
    } catch (err: any) {
      setError(err.message);
    }
  };

  const updateSection = async () => {
    if (!editSection) return;
    try {
      await api.menuSections.update(editSection.id, {
        name: editSection.name,
        order: editSection.order,
      });
      setEditSection(null);
      fetchAllData();
      showSuccess("Section modifiee");
    } catch (err: any) {
      setError(err.message);
    }
  };

  const updateMenuItem = async () => {
    if (!editItem) return;
    try {
      await api.menuItems.update(editItem.id, {
        section: editItem.section,
        name: editItem.name,
        price: editItem.price,
        is_available: editItem.is_available,
      });
      setEditItem(null);
      fetchAllData();
      showSuccess("Article modifie");
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (!isAuthenticated) {
    return (
      <Dialog open={showLoginDialog} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              Connexion Admin
            </DialogTitle>
            <DialogDescription>
              Entrez vos identifiants administrateur
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="username">Nom d'utilisateur</Label>
              <Input
                id="username"
                value={loginUsername}
                onChange={(e) => setLoginUsername(e.target.value)}
                placeholder="admin"
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Mot de passe</Label>
              <Input
                id="password"
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="********"
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              />
            </div>
            {loginError && (
              <p className="text-sm text-red-600 flex items-center gap-1">
                <AlertCircle className="h-4 w-4" />
                {loginError}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button onClick={handleLogin} disabled={loggingIn} className="w-full">
              {loggingIn ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Lock className="h-4 w-4 mr-2" />
              )}
              Se connecter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Settings className="h-6 w-6" />
          Administration
        </h2>
        <Button variant="outline" onClick={handleLogout}>
          <LogOut className="h-4 w-4 mr-2" />
          Deconnexion
        </Button>
      </div>

      {error && (
        <Card className="bg-red-50 border-red-200">
          <CardContent className="pt-4">
            <p className="text-red-600 flex items-center gap-1">
              <AlertCircle className="h-4 w-4" />
              {error}
            </p>
          </CardContent>
        </Card>
      )}

      {success && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="bg-green-50 border-green-200">
            <CardContent className="pt-4">
              <p className="text-green-600 flex items-center gap-1">
                <CheckCircle className="h-4 w-4" />
                {success}
              </p>
            </CardContent>
          </Card>
        </motion.div>
      )}

      <Tabs value={adminTab} onValueChange={setAdminTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="tournaments" className="flex items-center gap-1">
            <Trophy className="h-4 w-4" />
            <span className="hidden md:inline">Tournois</span>
          </TabsTrigger>
          <TabsTrigger value="rooms" className="flex items-center gap-1">
            <LayoutGrid className="h-4 w-4" />
            <span className="hidden md:inline">Salles</span>
          </TabsTrigger>
          <TabsTrigger value="matches" className="flex items-center gap-1">
            <Users className="h-4 w-4" />
            <span className="hidden md:inline">Matchs</span>
          </TabsTrigger>
          <TabsTrigger value="players" className="flex items-center gap-1">
            <Users className="h-4 w-4" />
            <span className="hidden md:inline">Joueurs</span>
          </TabsTrigger>
          <TabsTrigger value="menu" className="flex items-center gap-1">
            <Coffee className="h-4 w-4" />
            <span className="hidden md:inline">Menu</span>
          </TabsTrigger>
          <TabsTrigger value="qrcode" className="flex items-center gap-1">
            <QrCode className="h-4 w-4" />
            <span className="hidden md:inline">QRCode</span>
          </TabsTrigger>
          <TabsTrigger value="bracket-tree" className="flex items-center gap-1">
            <GitBranch className="h-4 w-4" />
            <span className="hidden md:inline">Arbre Tournoi</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tournaments" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Creer un tournoi</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Nom du tournoi</Label>
                  <Input
                    value={newTournament.name}
                    onChange={(e) => setNewTournament({ ...newTournament, name: e.target.value })}
                    placeholder="Tournoi National 2026"
                  />
                </div>
                <div>
                  <Label>Description</Label>
                  <Input
                    value={newTournament.description}
                    onChange={(e) => setNewTournament({ ...newTournament, description: e.target.value })}
                    placeholder="Description"
                  />
                </div>
              </div>
              <Button onClick={createTournament} disabled={!newTournament.name}>
                <Plus className="h-4 w-4 mr-2" />
                Creer le tournoi
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Tournois existants</CardTitle>
            </CardHeader>
            <CardContent>
              {tournaments.length === 0 ? (
                <p className="text-muted-foreground">Aucun tournoi</p>
              ) : (
                <div className="space-y-2">
                  {tournaments.map((t) => (
                    <div key={t.id} className="flex justify-between items-center p-3 border rounded">
                      <div>
                        <p className="font-medium">{t.name}</p>
                        <p className="text-sm text-muted-foreground">{t.description}</p>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => setEditTournament(t)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="destructive" size="sm" onClick={() => deleteItem("tournament", t.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Creer un tableau</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label>Tournoi</Label>
                  <Select value={newBracket.tournament} onValueChange={(v) => setNewBracket({ ...newBracket, tournament: v })}>
                    <SelectTrigger><SelectValue placeholder="Selectionnez" /></SelectTrigger>
                    <SelectContent>
                      {tournaments.map((t) => (
                        <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Nom</Label>
                  <Input
                    value={newBracket.name}
                    onChange={(e) => setNewBracket({ ...newBracket, name: e.target.value })}
                    placeholder="Tableau A"
                  />
                </div>
                <div>
                  <Label>Categorie</Label>
                  <Input
                    value={newBracket.category}
                    onChange={(e) => setNewBracket({ ...newBracket, category: e.target.value })}
                    placeholder="Nc a 799 pts"
                  />
                </div>
                <div>
                  <Label>Points min</Label>
                  <Input
                    type="number"
                    value={newBracket.min_points}
                    onChange={(e) => setNewBracket({ ...newBracket, min_points: e.target.value })}
                    placeholder="0"
                  />
                </div>
                <div>
                  <Label>Points max</Label>
                  <Input
                    type="number"
                    value={newBracket.max_points}
                    onChange={(e) => setNewBracket({ ...newBracket, max_points: e.target.value })}
                    placeholder="799"
                  />
                </div>
                <div>
                  <Label>Max joueurs</Label>
                  <Input
                    type="number"
                    value={newBracket.max_players}
                    onChange={(e) => setNewBracket({ ...newBracket, max_players: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Montant €</Label>
                  <Input
                    type="number"
                    value={newBracket.entry_fee}
                    onChange={(e) => setNewBracket({ ...newBracket, entry_fee: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Jour</Label>
                  <Input
                    value={newBracket.day}
                    onChange={(e) => setNewBracket({ ...newBracket, day: e.target.value })}
                    placeholder="Samedi 21/02"
                  />
                </div>
                <div>
                  <Label>Fin de pointage</Label>
                  <Input
                    value={newBracket.checkin_end}
                    onChange={(e) => setNewBracket({ ...newBracket, checkin_end: e.target.value })}
                    placeholder="8h30"
                  />
                </div>
                <div>
                  <Label>Debut du tableau</Label>
                  <Input
                    value={newBracket.start_time}
                    onChange={(e) => setNewBracket({ ...newBracket, start_time: e.target.value })}
                    placeholder="9h00"
                  />
                </div>
              </div>
              <Button onClick={createBracket} disabled={!newBracket.tournament || !newBracket.name}>
                <Plus className="h-4 w-4 mr-2" />
                Creer le tableau
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Tableaux existants</CardTitle>
            </CardHeader>
            <CardContent>
              {brackets.length === 0 ? (
                <p className="text-muted-foreground">Aucun tableau</p>
              ) : (
                <div className="space-y-2">
                  {sortedBrackets.map((b) => {
                    const remaining = b.max_players - (b.registered_count || 0);
                    return (
                      <div key={b.id} className="flex justify-between items-center p-3 border rounded">
                        <div>
                          <p className="font-medium">{b.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {b.category} - {Number(b.entry_fee).toFixed(2)} €
                            {b.day && ` - ${b.day}`}
                            {b.checkin_end && ` | Pointage: ${b.checkin_end}`}
                            {b.start_time && ` | Debut: ${b.start_time}`}
                          </p>
                          <p className={`text-xs mt-1 ${remaining <= 0 ? 'text-red-600 font-medium' : remaining <= 3 ? 'text-orange-600' : 'text-green-600'}`}>
                            {remaining <= 0 ? "Il ne reste plus de places disponibles" : `${remaining} place${remaining > 1 ? 's' : ''} restante${remaining > 1 ? 's' : ''}`}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={() => setEditBracket(b)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="destructive" size="sm" onClick={() => deleteItem("bracket", b.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rooms" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Creer une salle</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label>Nom</Label>
                  <Input
                    value={newRoom.name}
                    onChange={(e) => setNewRoom({ ...newRoom, name: e.target.value })}
                    placeholder="Salle principale"
                  />
                </div>
                <div>
                  <Label>Nombre de rangees</Label>
                  <Input
                    type="number"
                    min="1"
                    value={newRoom.rows}
                    onChange={(e) => setNewRoom({ ...newRoom, rows: e.target.value })}
                    placeholder="2"
                  />
                </div>
                <div>
                  <Label>Tables par rangee</Label>
                  <Input
                    type="number"
                    min="1"
                    value={newRoom.tables_per_row}
                    onChange={(e) => setNewRoom({ ...newRoom, tables_per_row: e.target.value })}
                    placeholder="4"
                  />
                </div>
              </div>
              <Button onClick={createRoom} disabled={!newRoom.name}>
                <Plus className="h-4 w-4 mr-2" />
                Creer la salle
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Ajouter une table</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-4 items-end">
                <div className="flex-1">
                  <Label>Salle</Label>
                  <Select value={newTable.room} onValueChange={(v) => setNewTable({ room: v })}>
                    <SelectTrigger><SelectValue placeholder="Selectionnez une salle" /></SelectTrigger>
                    <SelectContent>
                      {rooms.map((r) => (
                        <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={createTable} disabled={!newTable.room}>
                  <Plus className="h-4 w-4 mr-2" />
                  Ajouter (Table #{tables.length > 0 ? Math.max(...tables.map(t => t.table_number)) + 1 : 1})
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Salles et Tables</CardTitle>
            </CardHeader>
            <CardContent>
              {rooms.length === 0 ? (
                <p className="text-muted-foreground">Aucune salle</p>
              ) : (
                <div className="space-y-6">
                  {rooms.map((room) => {
                    const roomTables = tables.filter(t => t.room === room.id);
                    const gridRows = room.rows || 2;
                    const gridCols = room.tables_per_row || 4;
                    
                    return (
                      <div key={room.id} className="border rounded-lg p-4">
                        <div className="flex justify-between items-center mb-4">
                          <div>
                            <h4 className="font-medium text-lg">{room.name}</h4>
                            <p className="text-sm text-muted-foreground">
                              Grille: {gridRows} rangees x {gridCols} tables/rangee
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={() => setEditRoom(room)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="destructive" size="sm" onClick={() => deleteItem("room", room.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        
                        <div 
                          className="grid gap-3 p-4 bg-gray-50 rounded-lg"
                          style={{ 
                            gridTemplateColumns: `repeat(${gridCols}, minmax(80px, 1fr))`,
                            gridTemplateRows: `repeat(${gridRows}, 60px)`
                          }}
                        >
                          {Array.from({ length: gridRows * gridCols }).map((_, idx) => {
                            const row = Math.floor(idx / gridCols);
                            const col = idx % gridCols;
                            const tableAtPosition = roomTables.find(
                              t => t.position_row === row && t.position_col === col
                            ) || roomTables[idx];
                            
                            return (
                              <div
                                key={`${room.id}-${row}-${col}`}
                                className={`relative flex items-center justify-center rounded border-2 transition-colors
                                  ${tableAtPosition
                                    ? tableAtPosition.status === "free"
                                      ? "bg-green-100 border-green-500 cursor-move"
                                      : "bg-red-100 border-red-500 cursor-move"
                                    : "bg-gray-200 border-dashed border-gray-300"
                                  } ${draggedTable && !tableAtPosition ? "hover:bg-blue-100 hover:border-blue-400" : ""}`}
                                draggable={!!tableAtPosition}
                                onDragStart={(e) => tableAtPosition && handleDragStart(e, tableAtPosition)}
                                onDragOver={handleDragOver}
                                onDrop={(e) => handleDrop(e, row, col, room.id)}
                              >
                                {tableAtPosition ? (
                                  <>
                                    <span className={`text-sm font-bold ${tableAtPosition.orientation === 'vertical' ? 'writing-mode-vertical' : ''}`}>
                                      T{tableAtPosition.table_number}
                                    </span>
                                    <div className="absolute -top-2 -right-2 flex gap-1">
                                      <Button 
                                        variant="outline" 
                                        size="icon" 
                                        className="h-5 w-5 bg-white"
                                        onClick={(e) => { e.stopPropagation(); toggleTableOrientation(tableAtPosition); }}
                                      >
                                        <RotateCw className="h-3 w-3" />
                                      </Button>
                                      <Button 
                                        variant="destructive" 
                                        size="icon" 
                                        className="h-5 w-5"
                                        onClick={(e) => { e.stopPropagation(); deleteItem("table", tableAtPosition.id); }}
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  </>
                                ) : (
                                  <span className="text-xs text-gray-400">Vide</span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                        
                        <p className="text-xs text-muted-foreground mt-2">
                          {roomTables.length} table(s) dans cette salle - Glissez-deposez pour reorganiser, cliquez sur rotation pour changer l'orientation
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="matches" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Creer un match</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label>Tableau</Label>
                  <Select value={newMatch.bracket} onValueChange={(v) => setNewMatch({ bracket: v, player1: "", player2: "" })}>
                    <SelectTrigger><SelectValue placeholder="Selectionnez" /></SelectTrigger>
                    <SelectContent>
                      {sortedBrackets.map((b) => (
                        <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Joueur 1</Label>
                  <Select 
                    value={newMatch.player1} 
                    onValueChange={(v) => setNewMatch({ ...newMatch, player1: v })}
                    disabled={!newMatch.bracket}
                  >
                    <SelectTrigger><SelectValue placeholder={newMatch.bracket ? "Selectionnez" : "Choisissez d'abord un tableau"} /></SelectTrigger>
                    <SelectContent>
                      {getPlayersForBracket(newMatch.bracket).map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.last_name} {p.first_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Joueur 2</Label>
                  <Select 
                    value={newMatch.player2} 
                    onValueChange={(v) => setNewMatch({ ...newMatch, player2: v })}
                    disabled={!newMatch.bracket}
                  >
                    <SelectTrigger><SelectValue placeholder={newMatch.bracket ? "Selectionnez" : "Choisissez d'abord un tableau"} /></SelectTrigger>
                    <SelectContent>
                      {getPlayersForBracket(newMatch.bracket)
                        .filter(p => p.id !== newMatch.player1)
                        .map((p) => (
                          <SelectItem key={p.id} value={p.id}>{p.last_name} {p.first_name}</SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {newMatch.bracket && getPlayersForBracket(newMatch.bracket).length === 0 && (
                <p className="text-sm text-orange-600">Aucun joueur inscrit dans ce tableau</p>
              )}
              <Button onClick={createMatch} disabled={!newMatch.bracket || !newMatch.player1 || !newMatch.player2}>
                <Plus className="h-4 w-4 mr-2" />
                Creer le match
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Gestion des matchs</CardTitle>
            </CardHeader>
            <CardContent>
              {matches.length === 0 ? (
                <p className="text-muted-foreground">Aucun match</p>
              ) : (
                <div className="space-y-3">
                  {matches.map((match) => (
                    <div key={match.id} className="flex justify-between items-center p-3 border rounded">
                      <div className="flex-1">
                        <p className="font-medium">
                          {match.player1_name} vs {match.player2_name}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {match.bracket_name} - 
                          {match.table_number ? ` Table ${match.table_number}` : " Pas de table"}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={
                          match.status === "finished" ? "success" :
                          match.status === "in_progress" ? "destructive" : "secondary"
                        }>
                          {match.status === "finished" ? `${match.sets_player1}-${match.sets_player2}` : match.status}
                        </Badge>
                        
                        {match.status === "waiting" && (
                          <Button size="sm" onClick={() => setSelectedMatch(match)}>
                            <Play className="h-4 w-4 mr-1" />
                            Assigner
                          </Button>
                        )}
                        
                        {match.status === "in_progress" && (
                          <Button size="sm" variant="outline" onClick={() => {
                            setSelectedMatch(match);
                            setFinishScore({ sets_player1: "", sets_player2: "" });
                          }}>
                            <Square className="h-4 w-4 mr-1" />
                            Terminer
                          </Button>
                        )}
                        
                        <Button variant="destructive" size="sm" onClick={() => deleteItem("match", match.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="menu" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Creer une section</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-4">
                <Input
                  value={newSection.name}
                  onChange={(e) => setNewSection({ name: e.target.value })}
                  placeholder="Boissons, Sandwichs..."
                  className="flex-1"
                />
                <Button onClick={createMenuSection} disabled={!newSection.name}>
                  <Plus className="h-4 w-4 mr-2" />
                  Creer
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Ajouter un article</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label>Section</Label>
                  <Select value={newItem.section} onValueChange={(v) => setNewItem({ ...newItem, section: v })}>
                    <SelectTrigger><SelectValue placeholder="Selectionnez" /></SelectTrigger>
                    <SelectContent>
                      {menuSections.map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Nom</Label>
                  <Input
                    value={newItem.name}
                    onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                    placeholder="Coca-Cola"
                  />
                </div>
                <div>
                  <Label>Prix €</Label>
                  <Input
                    type="number"
                    step="0.5"
                    value={newItem.price}
                    onChange={(e) => setNewItem({ ...newItem, price: e.target.value })}
                    placeholder="2.50"
                  />
                </div>
              </div>
              <Button onClick={createMenuItem} disabled={!newItem.section || !newItem.name || !newItem.price}>
                <Plus className="h-4 w-4 mr-2" />
                Ajouter
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Menu actuel</CardTitle>
            </CardHeader>
            <CardContent>
              {menuSections.length === 0 ? (
                <p className="text-muted-foreground">Aucune section</p>
              ) : (
                <div className="space-y-4">
                  {menuSections.map((section) => (
                    <div key={section.id} className="border rounded p-4">
                      <div className="flex justify-between items-center mb-3">
                        <h4 className="font-medium">{section.name}</h4>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={() => setEditSection(section)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="destructive" size="sm" onClick={() => deleteItem("section", section.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <div className="space-y-2">
                        {menuItems.filter(i => i.section === section.id).map((item) => (
                          <div key={item.id} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                            <span>{item.name}</span>
                            <div className="flex items-center gap-2">
                              <Badge>{Number(item.price).toFixed(2)} €</Badge>
                              <Button variant="outline" size="sm" onClick={() => setEditItem(item)}>
                                <Pencil className="h-3 w-3" />
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => deleteItem("item", item.id)}>
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="players" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Liste des joueurs inscrits</CardTitle>
            </CardHeader>
            <CardContent>
              {players.length === 0 ? (
                <p className="text-muted-foreground">Aucun joueur inscrit</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2">Nom</th>
                        <th className="text-left py-2">Licence</th>
                        <th className="text-left py-2">Club</th>
                        <th className="text-left py-2">Points</th>
                        <th className="text-left py-2">Tableau(x)</th>
                        <th className="text-left py-2">Email</th>
                        <th className="text-left py-2">Tel</th>
                      </tr>
                    </thead>
                    <tbody>
                      {players.map((player) => {
                        const playerBrackets = registrations
                          .filter(r => r.player === player.id)
                          .map(r => {
                            const bracket = brackets.find(b => b.id === r.bracket);
                            return bracket?.name || "";
                          })
                          .filter(Boolean)
                          .join(", ");
                        return (
                          <tr key={player.id} className="border-b">
                            <td className="py-2">{player.last_name} {player.first_name}</td>
                            <td className="py-2">{player.license_number}</td>
                            <td className="py-2">{player.club}</td>
                            <td className="py-2">{player.ranking || player.points}</td>
                            <td className="py-2">{playerBrackets || "-"}</td>
                            <td className="py-2">{player.email}</td>
                            <td className="py-2">{player.phone || "-"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="qrcode" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <QrCode className="h-5 w-5" />
                QR Code de l'application
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-6">
              <p className="text-muted-foreground text-center max-w-md">
                Scannez ce QR Code avec votre smartphone pour acceder a l'application de tournoi depuis n'importe quel appareil mobile.
              </p>
              <div className="bg-white p-6 rounded-lg border-2 border-gray-200 shadow-lg">
                <div className="w-64 h-64 flex items-center justify-center bg-gray-100 rounded">
                  <img 
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encodeURIComponent(typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000')}`}
                    alt="QR Code de l'application"
                    className="w-64 h-64"
                  />
                </div>
              </div>
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-2">URL de l'application:</p>
                <code className="px-3 py-1 bg-gray-100 rounded text-sm">
                  {typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'}
                </code>
              </div>
              <div className="bg-blue-50 p-4 rounded-lg w-full max-w-md">
                <h4 className="font-medium text-blue-800 mb-2">Instructions:</h4>
                <ol className="text-sm text-blue-700 space-y-1 list-decimal list-inside">
                  <li>Ouvrez l'appareil photo de votre smartphone</li>
                  <li>Pointez vers le QR Code</li>
                  <li>Touchez la notification pour ouvrir le lien</li>
                  <li>Ajoutez la page a votre ecran d'accueil (optionnel)</li>
                </ol>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bracket-tree" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GitBranch className="h-5 w-5" />
                Configuration du tournoi
              </CardTitle>
              <CardDescription>
                Configurez le format d'elimination et les options du tournoi
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-6">
                <div className="flex items-center gap-4">
                  <Label className="font-medium">Type d'elimination:</Label>
                  <div className="flex gap-2">
                    <Button
                      variant={eliminationType === "single" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setEliminationType("single")}
                    >
                      Simple (OK)
                    </Button>
                    <Button
                      variant={eliminationType === "double" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setEliminationType("double")}
                    >
                      Double (KO)
                    </Button>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <Label className="font-medium">Match 3e place:</Label>
                  <Button
                    variant={hasThirdPlace ? "default" : "outline"}
                    size="sm"
                    onClick={() => setHasThirdPlace(!hasThirdPlace)}
                  >
                    <Medal className="h-4 w-4 mr-1" />
                    {hasThirdPlace ? "Active" : "Desactive"}
                  </Button>
                </div>
              </div>

              <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                <p className="text-sm font-medium mb-2">Etiquettes de tours:</p>
                <div className="flex flex-wrap gap-2">
                  {["Pool", "1/64", "1/32", "1/16", "1/8", "1/4", "1/2", 
                    hasThirdPlace ? "Petite Finale" : null, "Finale"]
                    .filter(Boolean)
                    .map((label, index) => (
                      <Badge key={index} variant="outline">{label}</Badge>
                    ))}
                </div>
              </div>

              <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                <h4 className="font-medium text-blue-800 mb-2">Comment utiliser</h4>
                <ul className="text-sm text-blue-700 space-y-1 list-disc list-inside">
                  <li><strong>Elimination simple</strong>: Un joueur est elimine apres une defaite</li>
                  <li><strong>Double elimination</strong>: Un joueur doit perdre deux fois pour etre elimine</li>
                  <li><strong>Match 3e place</strong>: Les perdants des demi-finales s'affrontent</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Apercu de la structure</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="p-4 bg-gray-100 rounded-lg">
                <div className="flex flex-wrap gap-2 justify-center">
                  {["Pool", "1/64", "1/32", "1/16", "1/8", "1/4", "1/2", "Finale"].map((label, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <div className="px-3 py-2 bg-white border rounded shadow-sm text-sm font-medium">
                        {label}
                      </div>
                      {index < 7 && <span className="text-gray-400">→</span>}
                    </div>
                  ))}
                </div>
                {hasThirdPlace && (
                  <div className="mt-4 text-center">
                    <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-300">
                      <Medal className="h-3 w-3 mr-1" />
                      Petite Finale (3e place)
                    </Badge>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={selectedMatch !== null && selectedMatch.status === "waiting"} onOpenChange={() => setSelectedMatch(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assigner une table</DialogTitle>
            <DialogDescription>
              {selectedMatch?.player1_name} vs {selectedMatch?.player2_name}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label>Table</Label>
            <Select value={selectedTable} onValueChange={setSelectedTable}>
              <SelectTrigger><SelectValue placeholder="Selectionnez une table" /></SelectTrigger>
              <SelectContent>
                {tables.filter(t => t.status === "free").map((t) => (
                  <SelectItem key={t.id} value={t.id}>Table {t.table_number} - {t.room_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedMatch(null)}>Annuler</Button>
            <Button onClick={assignMatchToTable} disabled={!selectedTable}>
              Assigner
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={selectedMatch !== null && selectedMatch.status === "in_progress"} onOpenChange={() => setSelectedMatch(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Terminer le match</DialogTitle>
            <DialogDescription>
              {selectedMatch?.player1_name} vs {selectedMatch?.player2_name}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Sets {selectedMatch?.player1_name?.split(" ")[0]}</Label>
                <Input
                  type="number"
                  min="0"
                  max="4"
                  value={finishScore.sets_player1}
                  onChange={(e) => setFinishScore({ ...finishScore, sets_player1: e.target.value })}
                />
              </div>
              <div>
                <Label>Sets {selectedMatch?.player2_name?.split(" ")[0]}</Label>
                <Input
                  type="number"
                  min="0"
                  max="4"
                  value={finishScore.sets_player2}
                  onChange={(e) => setFinishScore({ ...finishScore, sets_player2: e.target.value })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedMatch(null)}>Annuler</Button>
            <Button onClick={finishMatch} disabled={!finishScore.sets_player1 || !finishScore.sets_player2}>
              Valider le resultat
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editTournament !== null} onOpenChange={() => setEditTournament(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier le tournoi</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div>
              <Label>Nom</Label>
              <Input
                value={editTournament?.name || ""}
                onChange={(e) => setEditTournament(editTournament ? { ...editTournament, name: e.target.value } : null)}
              />
            </div>
            <div>
              <Label>Description</Label>
              <Input
                value={editTournament?.description || ""}
                onChange={(e) => setEditTournament(editTournament ? { ...editTournament, description: e.target.value } : null)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTournament(null)}>Annuler</Button>
            <Button onClick={updateTournament}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editBracket !== null} onOpenChange={() => setEditBracket(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Modifier le tableau</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Nom</Label>
                <Input
                  value={editBracket?.name || ""}
                  onChange={(e) => setEditBracket(editBracket ? { ...editBracket, name: e.target.value } : null)}
                />
              </div>
              <div>
                <Label>Categorie</Label>
                <Input
                  value={editBracket?.category || ""}
                  onChange={(e) => setEditBracket(editBracket ? { ...editBracket, category: e.target.value } : null)}
                />
              </div>
              <div>
                <Label>Points min</Label>
                <Input
                  type="number"
                  value={editBracket?.min_points ?? ""}
                  onChange={(e) => setEditBracket(editBracket ? { ...editBracket, min_points: e.target.value ? parseInt(e.target.value) : null } : null)}
                />
              </div>
              <div>
                <Label>Points max</Label>
                <Input
                  type="number"
                  value={editBracket?.max_points ?? ""}
                  onChange={(e) => setEditBracket(editBracket ? { ...editBracket, max_points: e.target.value ? parseInt(e.target.value) : null } : null)}
                />
              </div>
              <div>
                <Label>Max joueurs</Label>
                <Input
                  type="number"
                  value={editBracket?.max_players || ""}
                  onChange={(e) => setEditBracket(editBracket ? { ...editBracket, max_players: parseInt(e.target.value) } : null)}
                />
              </div>
              <div>
                <Label>Montant €</Label>
                <Input
                  type="number"
                  value={editBracket?.entry_fee || ""}
                  onChange={(e) => setEditBracket(editBracket ? { ...editBracket, entry_fee: parseFloat(e.target.value) } : null)}
                />
              </div>
              <div>
                <Label>Jour</Label>
                <Input
                  value={editBracket?.day || ""}
                  onChange={(e) => setEditBracket(editBracket ? { ...editBracket, day: e.target.value } : null)}
                  placeholder="Samedi 21/02"
                />
              </div>
              <div>
                <Label>Fin de pointage</Label>
                <Input
                  value={editBracket?.checkin_end || ""}
                  onChange={(e) => setEditBracket(editBracket ? { ...editBracket, checkin_end: e.target.value } : null)}
                  placeholder="8h30"
                />
              </div>
              <div className="col-span-2">
                <Label>Debut du tableau</Label>
                <Input
                  value={editBracket?.start_time || ""}
                  onChange={(e) => setEditBracket(editBracket ? { ...editBracket, start_time: e.target.value } : null)}
                  placeholder="9h00"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditBracket(null)}>Annuler</Button>
            <Button onClick={updateBracket}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editRoom !== null} onOpenChange={() => setEditRoom(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier la salle</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div>
              <Label>Nom</Label>
              <Input
                value={editRoom?.name || ""}
                onChange={(e) => setEditRoom(editRoom ? { ...editRoom, name: e.target.value } : null)}
              />
            </div>
            <div>
              <Label>Description</Label>
              <Input
                value={editRoom?.description || ""}
                onChange={(e) => setEditRoom(editRoom ? { ...editRoom, description: e.target.value } : null)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditRoom(null)}>Annuler</Button>
            <Button onClick={updateRoom}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editSection !== null} onOpenChange={() => setEditSection(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier la section</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div>
              <Label>Nom</Label>
              <Input
                value={editSection?.name || ""}
                onChange={(e) => setEditSection(editSection ? { ...editSection, name: e.target.value } : null)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditSection(null)}>Annuler</Button>
            <Button onClick={updateSection}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editItem !== null} onOpenChange={() => setEditItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier l'article</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div>
              <Label>Nom</Label>
              <Input
                value={editItem?.name || ""}
                onChange={(e) => setEditItem(editItem ? { ...editItem, name: e.target.value } : null)}
              />
            </div>
            <div>
              <Label>Prix €</Label>
              <Input
                type="number"
                step="0.5"
                value={editItem?.price || ""}
                onChange={(e) => setEditItem(editItem ? { ...editItem, price: parseFloat(e.target.value) } : null)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditItem(null)}>Annuler</Button>
            <Button onClick={updateMenuItem}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
