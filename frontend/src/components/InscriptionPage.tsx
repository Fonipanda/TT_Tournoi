"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/api";
import { 
  UserPlus, Search, Loader2, CheckCircle, 
  AlertCircle, Trophy, X 
} from "lucide-react";

interface Bracket {
  id: string;
  name: string;
  category: string;
  min_points: number | null;
  max_points: number | null;
  max_players: number;
  entry_fee: number;
  registered_count: number;
  day: string | null;
  checkin_end: string | null;
  start_time: string | null;
}

interface Player {
  id: string;
  first_name: string;
  last_name: string;
  license_number: string;
  ranking: string;
  points: number;
  club: string;
  email: string;
  phone: string;
}

export default function InscriptionPage({ tournamentId }: { tournamentId?: string }) {
  const [subTab, setSubTab] = useState("register");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [searchingLicense, setSearchingLicense] = useState(false);
  const [licenseError, setLicenseError] = useState<string | null>(null);
  
  const [playerData, setPlayerData] = useState<Partial<Player>>({});
  const [brackets, setBrackets] = useState<Bracket[]>([]);
  const [selectedBrackets, setSelectedBrackets] = useState<string[]>([]);
  const [existingPlayer, setExistingPlayer] = useState<Player | null>(null);
  const [existingRegistrations, setExistingRegistrations] = useState<string[]>([]);
  
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [showCreateAccount, setShowCreateAccount] = useState(true);
  const [showLoginForm, setShowLoginForm] = useState(false);
  const [accountUsername, setAccountUsername] = useState("");
  const [accountPassword, setAccountPassword] = useState("");
  const [accountPasswordConfirm, setAccountPasswordConfirm] = useState("");
  const [accountLicense, setAccountLicense] = useState("");
  const [accountError, setAccountError] = useState<string | null>(null);
  const [accountCreated, setAccountCreated] = useState(false);
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  const validatePassword = (pwd: string): string | null => {
    if (pwd.length < 8) return "Le mot de passe doit contenir au moins 8 caracteres";
    if (!/[A-Z]/.test(pwd)) return "Le mot de passe doit contenir au moins une majuscule";
    if (!/[a-z]/.test(pwd)) return "Le mot de passe doit contenir au moins une minuscule";
    if (!/[0-9]/.test(pwd)) return "Le mot de passe doit contenir au moins un chiffre";
    if (!/[^A-Za-z0-9]/.test(pwd)) return "Le mot de passe doit contenir au moins un caractere special";
    return null;
  };

  const handleCreateAccount = () => {
    setAccountError(null);
    if (!accountUsername.trim()) { setAccountError("Le nom d'utilisateur est requis"); return; }
    const pwdError = validatePassword(accountPassword);
    if (pwdError) { setAccountError(pwdError); return; }
    if (accountPassword !== accountPasswordConfirm) { setAccountError("Les mots de passe ne correspondent pas"); return; }
    setAccountCreated(true);
    setShowCreateAccount(false);
    setShowLoginForm(false);
    if (accountLicense.trim()) {
      setLicenseNumber(accountLicense.trim());
    }
  };

  const handleLogin = () => {
    setAccountError(null);
    if (!loginUsername.trim() || !loginPassword.trim()) {
      setAccountError("Veuillez remplir tous les champs");
      return;
    }
    setAccountCreated(true);
    setShowCreateAccount(false);
    setShowLoginForm(false);
  };

  const [consultEmail, setConsultEmail] = useState("");
  const [consultPlayer, setConsultPlayer] = useState<Player | null>(null);
  const [consultBrackets, setConsultBrackets] = useState<any[]>([]);
  const [consultLoading, setConsultLoading] = useState(false);
  const [consultError, setConsultError] = useState<string | null>(null);

  useEffect(() => {
    fetchBrackets();
  }, [tournamentId]);

  const fetchBrackets = async () => {
    try {
      const data = await api.brackets.list(tournamentId);
      const bracketsWithStats = await Promise.all(
        data.map(async (bracket: any) => {
          const stats = await api.brackets.stats(bracket.id);
          return { ...bracket, registered_count: stats.registered_players };
        })
      );
      setBrackets(bracketsWithStats);
    } catch (err) {
      console.error("Erreur lors du chargement des tableaux:", err);
    }
  };

  const searchLicense = async () => {
    if (!licenseNumber.trim()) {
      setLicenseError("Veuillez entrer un numero de licence");
      return;
    }

    setSearchingLicense(true);
    setLicenseError(null);
    setPlayerData({});
    setExistingPlayer(null);
    setExistingRegistrations([]);
    setSelectedBrackets([]);

    try {
      const existingPlayers = await api.players.getByLicense(licenseNumber.trim());
      
      if (existingPlayers && existingPlayers.length > 0) {
        const player = existingPlayers[0];
        setExistingPlayer(player);
        setPlayerData(player);
        
        const registrations = await api.registrations.list({ player_id: player.id });
        const regBracketIds = registrations.map((r: any) => r.bracket);
        setExistingRegistrations(regBracketIds);
        setSelectedBrackets(regBracketIds);
      } else {
        const ffttResult = await api.fftt.lookup(licenseNumber.trim());
        
        if (ffttResult.success && ffttResult.data) {
          const data = ffttResult.data;
          setPlayerData({
            license_number: data.licence,
            last_name: data.nom,
            first_name: data.prenom,
            club: data.club,
            ranking: data.points?.toString() || "",
            points: parseInt(data.points) || 0,
          });
        } else {
          setLicenseError(ffttResult.error || "Joueur non trouve avec ce numero de licence");
        }
      }
    } catch (err: any) {
      setLicenseError(err.message || "Erreur lors de la recherche");
    } finally {
      setSearchingLicense(false);
    }
  };

  const toggleBracketSelection = (bracketId: string) => {
    if (existingRegistrations.includes(bracketId)) {
      return;
    }

    const bracket = brackets.find(b => b.id === bracketId);
    const bracketDay = bracket?.day || "default";
    const newBracketSelections = selectedBrackets.filter(id => !existingRegistrations.includes(id));
    const isSelected = newBracketSelections.includes(bracketId);
    
    if (isSelected) {
      setSelectedBrackets([
        ...existingRegistrations,
        ...newBracketSelections.filter(id => id !== bracketId)
      ]);
      setSubmitError(null);
    } else {
      const selectedForDay = [...existingRegistrations, ...newBracketSelections].filter(id => {
        const b = brackets.find(br => br.id === id);
        return (b?.day || "default") === bracketDay;
      });
      
      if (selectedForDay.length >= 2) {
        setSubmitError(`Vous avez deja selectionne 2 tableaux sur cette journee (${bracketDay})`);
        return;
      }
      setSelectedBrackets([
        ...existingRegistrations,
        ...newBracketSelections,
        bracketId
      ]);
      setSubmitError(null);
    }
  };

  const getSelectionsForDay = (day: string) => {
    const newSelections = selectedBrackets.filter(id => !existingRegistrations.includes(id));
    return [...existingRegistrations, ...newSelections].filter(id => {
      const b = brackets.find(br => br.id === id);
      return (b?.day || "default") === day;
    }).length;
  };

  const canSelectBracket = (bracket: Bracket) => {
    if (existingRegistrations.includes(bracket.id)) return false;
    if (bracket.registered_count >= bracket.max_players) return false;
    if (selectedBrackets.includes(bracket.id)) return true;
    
    const bracketDay = bracket.day || "default";
    return getSelectionsForDay(bracketDay) < 2;
  };

  const sortBracketsAlphabetically = (bracketsList: Bracket[]) => {
    return [...bracketsList].sort((a, b) => a.name.localeCompare(b.name));
  };

  const getRecommendedBrackets = () => {
    const points = playerData.points || 0;
    return brackets.filter(b => {
      const minOk = b.min_points === null || points >= b.min_points;
      const maxOk = b.max_points === null || points <= b.max_points;
      return minOk && maxOk;
    });
  };

  const handleSubmit = async () => {
    if (!playerData.email) {
      setSubmitError("L'email est requis");
      return;
    }

    const newSelections = selectedBrackets.filter(id => !existingRegistrations.includes(id));
    if (newSelections.length === 0) {
      setSubmitError("Selectionnez au moins un nouveau tableau");
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    try {
      let playerId = existingPlayer?.id;

      if (!playerId) {
        const newPlayer = await api.players.create({
          first_name: playerData.first_name,
          last_name: playerData.last_name,
          license_number: playerData.license_number,
          ranking: playerData.ranking,
          points: playerData.points,
          club: playerData.club,
          email: playerData.email,
          phone: playerData.phone || "",
        });
        playerId = newPlayer.id;
      }

      const createdRegIds: string[] = [];
      for (const bracketId of newSelections) {
        const reg = await api.registrations.create({
          player: playerId,
          bracket: bracketId,
          payment_status: "pending",
        });
        createdRegIds.push(reg.id);
      }

      setSubmitSuccess(true);
      fetchBrackets();

      if (totalFee > 0) {
        try {
          const payRes = await api.payments.createCheckoutSession(createdRegIds);
          if (payRes.success && payRes.checkout_url) {
            setTimeout(() => {
              window.location.href = payRes.checkout_url;
            }, 1000);
          }
        } catch (payErr: any) {
          const pName = encodeURIComponent(`${playerData.last_name} ${playerData.first_name}`.trim());
          window.open(`/paiement?player=${pName}&amount=${totalFee.toFixed(2)}`, '_blank');
        }
      }

      setPlayerData({});
      setSelectedBrackets([]);
      setExistingPlayer(null);
      setExistingRegistrations([]);
      setLicenseNumber("");
    } catch (err: any) {
      setSubmitError(err.message || "Erreur lors de l'inscription");
    } finally {
      setSubmitting(false);
    }
  };

  const searchConsultation = async () => {
    if (!consultEmail.trim()) {
      setConsultError("Veuillez entrer un email");
      return;
    }

    setConsultLoading(true);
    setConsultError(null);
    setConsultPlayer(null);
    setConsultBrackets([]);

    try {
      const players = await api.players.getByEmail(consultEmail.trim());
      
      if (players && players.length > 0) {
        const player = players[0];
        setConsultPlayer(player);
        
        const brackets = await api.players.brackets(player.id);
        setConsultBrackets(brackets);
      } else {
        setConsultError("Aucun joueur trouve avec cet email");
      }
    } catch (err: any) {
      setConsultError(err.message || "Erreur lors de la recherche");
    } finally {
      setConsultLoading(false);
    }
  };

  const recommendedBrackets = getRecommendedBrackets();
  const totalNewSelections = selectedBrackets.filter(id => !existingRegistrations.includes(id)).length;
  const totalFee = selectedBrackets
    .filter(id => !existingRegistrations.includes(id))
    .reduce((sum, id) => {
      const bracket = brackets.find(b => b.id === id);
      const fee = Number(bracket?.entry_fee) || 0;
      return sum + fee;
    }, 0);

  return (
    <div className="space-y-6">
      <Tabs value={subTab} onValueChange={setSubTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="register" className="flex items-center gap-2">
            <UserPlus className="h-4 w-4" />
            S'inscrire
          </TabsTrigger>
          <TabsTrigger value="consult" className="flex items-center gap-2">
            <Search className="h-4 w-4" />
            Consulter mes inscriptions
          </TabsTrigger>
        </TabsList>

        <TabsContent value="register" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {showCreateAccount && !accountCreated && (
              <Card className="lg:col-span-2 border-blue-200 bg-blue-50/30">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <UserPlus className="h-5 w-5 text-blue-600" />
                    Creer un compte
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Nom d'utilisateur</Label>
                      <Input
                        placeholder="Choisissez un identifiant"
                        value={accountUsername}
                        onChange={(e) => setAccountUsername(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Numero de licence FFTT (optionnel)</Label>
                      <Input
                        placeholder="Ex: 7732605"
                        value={accountLicense}
                        onChange={(e) => setAccountLicense(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">
                        Permet de lier votre compte a votre profil joueur
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label>Mot de passe</Label>
                      <Input
                        type="password"
                        placeholder="Minimum 8 caracteres, 1 majuscule, 1 minuscule, 1 chiffre, 1 special"
                        value={accountPassword}
                        onChange={(e) => setAccountPassword(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Confirmer le mot de passe</Label>
                      <Input
                        type="password"
                        placeholder="Retapez le mot de passe"
                        value={accountPasswordConfirm}
                        onChange={(e) => setAccountPasswordConfirm(e.target.value)}
                      />
                    </div>
                  </div>
                  {accountError && (
                    <div className="flex items-center gap-2 text-red-600 text-sm">
                      <AlertCircle className="h-4 w-4" />
                      {accountError}
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <Button onClick={handleCreateAccount} className="bg-blue-600 hover:bg-blue-700">
                      Creer le compte
                    </Button>
                    <button
                      className="text-sm text-blue-600 hover:underline"
                      onClick={() => { setShowCreateAccount(false); setShowLoginForm(true); setAccountError(null); }}
                    >
                      Deja un compte ? Se connecter
                    </button>
                  </div>
                </CardContent>
              </Card>
            )}

            {showLoginForm && !accountCreated && (
              <Card className="lg:col-span-2 border-green-200 bg-green-50/30">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Search className="h-5 w-5 text-green-600" />
                    Se connecter
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Nom d'utilisateur</Label>
                      <Input
                        placeholder="Votre identifiant"
                        value={loginUsername}
                        onChange={(e) => setLoginUsername(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Mot de passe</Label>
                      <Input
                        type="password"
                        placeholder="Votre mot de passe"
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                      />
                    </div>
                  </div>
                  {accountError && (
                    <div className="flex items-center gap-2 text-red-600 text-sm">
                      <AlertCircle className="h-4 w-4" />
                      {accountError}
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <Button onClick={handleLogin} className="bg-green-600 hover:bg-green-700">
                      Se connecter
                    </Button>
                    <button
                      className="text-sm text-green-600 hover:underline"
                      onClick={() => { setShowLoginForm(false); setShowCreateAccount(true); setAccountError(null); }}
                    >
                      Pas de compte ? Creer un compte
                    </button>
                  </div>
                </CardContent>
              </Card>
            )}

            {!accountCreated && !showCreateAccount && !showLoginForm && (
              <Card className="lg:col-span-2">
                <CardContent className="py-12 text-center text-muted-foreground">
                  <p className="text-lg mb-4">Veuillez creer un compte ou vous connecter pour vous inscrire.</p>
                  <div className="flex gap-4 justify-center">
                    <Button onClick={() => setShowCreateAccount(true)} variant="outline">Creer un compte</Button>
                    <Button onClick={() => setShowLoginForm(true)} className="bg-green-600 hover:bg-green-700">Se connecter</Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {accountCreated && (<>
            <Card>
              <CardHeader>
                <CardTitle>Informations du joueur</CardTitle>
                <CardDescription>
                  Commencez par rechercher votre numero de licence FFTT
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="license" className="text-base font-semibold">
                    Numero de licence FFTT *
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      id="license"
                      value={licenseNumber}
                      onChange={(e) => setLicenseNumber(e.target.value)}
                      placeholder="Ex: 7712345"
                      onKeyDown={(e) => e.key === "Enter" && searchLicense()}
                    />
                    <Button 
                      onClick={searchLicense} 
                      disabled={searchingLicense}
                      className="shrink-0"
                    >
                      {searchingLicense ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Search className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  {licenseError && (
                    <p className="text-sm text-red-600 flex items-center gap-1">
                      <AlertCircle className="h-4 w-4" />
                      {licenseError}
                    </p>
                  )}
                </div>

                {(playerData.first_name || playerData.last_name) && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-4 pt-4 border-t"
                  >
                    {existingPlayer && (
                      <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                        <p className="text-sm text-blue-800">
                          Joueur deja inscrit. Vous pouvez ajouter des tableaux supplementaires.
                        </p>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Nom</Label>
                        <Input value={playerData.last_name || ""} disabled />
                      </div>
                      <div>
                        <Label>Prenom</Label>
                        <Input value={playerData.first_name || ""} disabled />
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Club</Label>
                        <Input value={playerData.club || ""} disabled />
                      </div>
                      <div>
                        <Label>Points</Label>
                        <Input value={playerData.ranking || playerData.points?.toString() || ""} disabled />
                      </div>
                    </div>

                    {!existingPlayer && (
                      <>
                        <div>
                          <Label htmlFor="email">Email *</Label>
                          <Input
                            id="email"
                            type="email"
                            value={playerData.email || ""}
                            onChange={(e) => setPlayerData({ ...playerData, email: e.target.value })}
                            placeholder="votre@email.com"
                          />
                        </div>
                        <div>
                          <Label htmlFor="phone">Telephone</Label>
                          <Input
                            id="phone"
                            type="tel"
                            value={playerData.phone || ""}
                            onChange={(e) => setPlayerData({ ...playerData, phone: e.target.value })}
                            placeholder="06 12 34 56 78"
                          />
                        </div>
                      </>
                    )}
                  </motion.div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="h-5 w-5" />
                  Selection des tableaux
                </CardTitle>
                <CardDescription>
                  Maximum 2 tableaux par jour par joueur
                  {existingRegistrations.length > 0 && (
                    <span className="text-blue-600 ml-2">
                      ({existingRegistrations.length} deja inscrit{existingRegistrations.length > 1 ? "s" : ""})
                    </span>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {brackets.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    Aucun tableau disponible
                  </p>
                ) : (
                  <div className="space-y-3">
                    {recommendedBrackets.length > 0 && playerData.points && (
                      <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md">
                        <p className="text-sm text-green-800 font-medium">
                          Tableaux recommandes pour votre classement ({playerData.points} pts)
                        </p>
                      </div>
                    )}

                    {sortBracketsAlphabetically(brackets).map((bracket) => {
                      const isSelected = selectedBrackets.includes(bracket.id);
                      const isExisting = existingRegistrations.includes(bracket.id);
                      const isRecommended = recommendedBrackets.some(b => b.id === bracket.id);
                      const isFull = bracket.registered_count >= bracket.max_players;
                      const bracketDay = bracket.day || "default";
                      const dayCount = getSelectionsForDay(bracketDay);
                      const isDayFull = !isSelected && dayCount >= 2;
                      const hasPlayerData = !!playerData.points;
                      const isNotRecommended = hasPlayerData && !isRecommended;
                      const canSelect = !isExisting && !isFull && !isDayFull && !isNotRecommended;

                      return (
                        <motion.div
                          key={bracket.id}
                          whileHover={{ scale: canSelect ? 1.01 : 1 }}
                          className={`p-4 rounded-lg border-2 transition-all ${
                            isExisting
                              ? "border-blue-400 bg-blue-50 cursor-not-allowed"
                              : isSelected
                              ? "border-green-500 bg-green-50 cursor-pointer"
                              : isNotRecommended
                              ? "border-gray-200 bg-gray-100 cursor-not-allowed opacity-50"
                              : isFull
                              ? "border-gray-200 bg-gray-100 cursor-not-allowed opacity-60"
                              : isDayFull
                              ? "border-orange-200 bg-orange-50 cursor-not-allowed opacity-80"
                              : isRecommended
                              ? "border-green-200 hover:border-green-400 cursor-pointer"
                              : "border-gray-200 hover:border-gray-400 cursor-pointer"
                          }`}
                          onClick={() => canSelect && toggleBracketSelection(bracket.id)}
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className="font-semibold flex items-center gap-2">
                                {bracket.name}
                                {isRecommended && !isExisting && !isDayFull && (
                                  <Badge variant="success" className="text-xs">Recommande</Badge>
                                )}
                                {isNotRecommended && (
                                  <Badge variant="secondary" className="text-xs">Non recommande</Badge>
                                )}
                                {isExisting && (
                                  <Badge variant="secondary" className="text-xs">Deja inscrit</Badge>
                                )}
                                {isFull && !isExisting && (
                                  <Badge variant="destructive" className="text-xs">Complet</Badge>
                                )}
                                {isDayFull && !isFull && !isExisting && (
                                  <Badge variant="warning" className="text-xs">2 tableaux/jour</Badge>
                                )}
                              </h4>
                              <p className="text-sm text-muted-foreground">{bracket.category}</p>
                              {(bracket.day || bracket.checkin_end || bracket.start_time) && (
                                <p className="text-xs text-blue-600 mt-1">
                                  {bracket.day && <span>{bracket.day}</span>}
                                  {bracket.checkin_end && <span> | Pointage: {bracket.checkin_end}</span>}
                                  {bracket.start_time && <span> | Debut: {bracket.start_time}</span>}
                                </p>
                              )}
                              {isDayFull && !isFull && !isExisting && (
                                <p className="text-xs text-orange-600 mt-1 font-medium">
                                  Vous avez deja selectionne 2 tableaux sur cette journee
                                </p>
                              )}
                              <p className={`text-xs mt-1 ${
                                isFull ? 'text-red-600 font-medium' : 
                                (bracket.max_players - bracket.registered_count) <= 3 ? 'text-orange-600' : 'text-green-600'
                              }`}>
                                {isFull 
                                  ? "Il ne reste plus de places disponibles" 
                                  : `${bracket.max_players - bracket.registered_count} place${(bracket.max_players - bracket.registered_count) > 1 ? 's' : ''} restante${(bracket.max_players - bracket.registered_count) > 1 ? 's' : ''}`
                                }
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="font-bold text-lg">{(Number(bracket.entry_fee) || 0).toFixed(2)} €</p>
                              {(isSelected || isExisting) && (
                                <CheckCircle className={`h-5 w-5 ml-auto mt-1 ${
                                  isExisting ? "text-blue-500" : "text-green-500"
                                }`} />
                              )}
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                )}

                {submitError && (
                  <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
                    <p className="text-sm text-red-600 flex items-center gap-1">
                      <AlertCircle className="h-4 w-4" />
                      {submitError}
                    </p>
                  </div>
                )}

                {submitSuccess && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-4 p-3 bg-green-50 border border-green-200 rounded-md"
                  >
                    <p className="text-sm text-green-600 flex items-center gap-1">
                      <CheckCircle className="h-4 w-4" />
                      Inscription reussie !
                    </p>
                  </motion.div>
                )}

                {totalNewSelections > 0 && (
                  <div className="mt-6 pt-4 border-t">
                    <div className="flex justify-between items-center mb-4">
                      <span className="font-medium">Total a payer :</span>
                      <span className="text-2xl font-bold">{totalFee.toFixed(2)} €</span>
                    </div>
                    <Button 
                      className="w-full bg-[#00a651] hover:bg-[#008c44]" 
                      size="lg"
                      onClick={handleSubmit}
                      disabled={submitting || !playerData.first_name}
                    >
                      {submitting ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <svg className="h-5 w-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                        </svg>
                      )}
                      Paiement via AssoConnect
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
            </>)}
          </div>
        </TabsContent>

        <TabsContent value="consult" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Consulter mes inscriptions</CardTitle>
              <CardDescription>
                Entrez votre email pour voir vos inscriptions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2 max-w-md">
                <Input
                  type="email"
                  value={consultEmail}
                  onChange={(e) => setConsultEmail(e.target.value)}
                  placeholder="votre@email.com"
                  onKeyDown={(e) => e.key === "Enter" && searchConsultation()}
                />
                <Button onClick={searchConsultation} disabled={consultLoading}>
                  {consultLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                </Button>
              </div>

              {consultError && (
                <p className="text-sm text-red-600 mt-2 flex items-center gap-1">
                  <AlertCircle className="h-4 w-4" />
                  {consultError}
                </p>
              )}

              {consultPlayer && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-6"
                >
                  <div className="p-4 bg-gray-50 rounded-lg mb-4">
                    <h3 className="font-semibold text-lg">
                      {consultPlayer.last_name} {consultPlayer.first_name}
                    </h3>
                    <p className="text-muted-foreground">
                      {consultPlayer.club} - {consultPlayer.ranking || consultPlayer.points} pts
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Licence: {consultPlayer.license_number}
                    </p>
                  </div>

                  {consultBrackets.length === 0 ? (
                    <p className="text-muted-foreground">Aucune inscription trouvee</p>
                  ) : (
                    <div className="space-y-3">
                      <h4 className="font-medium">Tableaux inscrits:</h4>
                      {consultBrackets.map((reg: any) => (
                        <div key={reg.registration_id} className="p-3 border rounded-lg">
                          <div className="flex justify-between items-center">
                            <div>
                              <p className="font-medium">{reg.bracket_name}</p>
                              <p className="text-sm text-muted-foreground">{reg.bracket_category}</p>
                              <p className="text-xs text-muted-foreground">
                                Tournoi: {reg.tournament_name}
                              </p>
                            </div>
                            <Badge>{(Number(reg.entry_fee) || 0).toFixed(2)} €</Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
