"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import Image from "next/image";
import React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Users, Bell, Coffee, Radio, 
  UserPlus, Settings, Trophy, Home as HomeIcon,
  TrendingUp, FileText, LogIn, LogOut, User
} from "lucide-react";
import { api } from "@/lib/api";
import AccueilPage from "@/components/AccueilPage";
import LivePage from "@/components/LivePage";
import InscriptionPage from "@/components/InscriptionPage";
import NotificationsPage from "@/components/NotificationsPage";
import BuvettePage from "@/components/BuvettePage";
import JoueursLivePage from "@/components/JoueursLivePage";
import ProgressionPage from "@/components/ProgressionPage";
import ReglementPage from "@/components/ReglementPage";
import AdminPage from "@/components/AdminPage";

type UserRole = 'visitor' | 'player' | 'admin';

class ErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: string },
  { hasError: boolean; error: string }
> {
  constructor(props: any) { super(props); this.state = { hasError: false, error: '' }; }
  static getDerivedStateFromError(error: Error) { return { hasError: true, error: error.message }; }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 text-center">
          <p className="text-red-600 font-semibold">Erreur de chargement</p>
          <p className="text-sm text-gray-500 mt-2">{this.state.error}</p>
          <button className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            onClick={() => this.setState({ hasError: false, error: '' })}>Recharger</button>
        </div>
      );
    }
    return this.props.children;
  }
}

interface AuthState {
  role: UserRole;
  token: string | null;
  username: string | null;
}

export default function Home() {
  const [activeTab, setActiveTab] = useState("accueil");
  const [auth, setAuth] = useState<AuthState>({ role: 'visitor', token: null, username: null });
  const [showLoginDialog, setShowLoginDialog] = useState(false);
  const [showRegisterDialog, setShowRegisterDialog] = useState(false);
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [registerForm, setRegisterForm] = useState({ username: '', password: '', confirmPassword: '', licenseNumber: '' });
  const [loginError, setLoginError] = useState('');
  const [registerError, setRegisterError] = useState('');

  useEffect(() => {
    const saved = localStorage.getItem('tt_auth');
    if (saved) {
      try {
        setAuth(JSON.parse(saved));
      } catch {}
    }
  }, []);

  const allTabs = [
    { id: "accueil", label: "Accueil", icon: HomeIcon, roles: ['visitor', 'player', 'admin'] as UserRole[] },
    { id: "inscription", label: "Inscription", icon: UserPlus, roles: ['visitor', 'player', 'admin'] as UserRole[] },
    { id: "notifications", label: "Notifications", icon: Bell, roles: ['player', 'admin'] as UserRole[] },
    { id: "live", label: "Live", icon: Radio, roles: ['visitor', 'player', 'admin'] as UserRole[] },
    { id: "joueurs", label: "Joueurs", icon: Users, roles: ['player', 'admin'] as UserRole[] },
    { id: "progression", label: "Progression", icon: TrendingUp, roles: ['player', 'admin'] as UserRole[] },
    { id: "buvette", label: "Buvette", icon: Coffee, roles: ['visitor', 'player', 'admin'] as UserRole[] },
    { id: "reglement", label: "Reglement", icon: FileText, roles: ['visitor', 'player', 'admin'] as UserRole[] },
    { id: "connexion", label: auth.role === 'admin' ? "Administration" : "Connexion", icon: auth.role === 'visitor' ? LogIn : Settings, roles: ['visitor', 'player', 'admin'] as UserRole[] },
  ];

  const visibleTabs = allTabs.filter(t => t.roles.includes(auth.role));

  const handleLogin = async () => {
    setLoginError('');
    try {
      const res = await api.auth.adminLogin(loginForm.username, loginForm.password);
      if (res.success) {
        const newAuth: AuthState = {
          role: res.role || 'admin',
          token: res.token,
          username: res.username || loginForm.username,
        };
        setAuth(newAuth);
        localStorage.setItem('tt_auth', JSON.stringify(newAuth));
        setShowLoginDialog(false);
        setLoginForm({ username: '', password: '' });
      }
    } catch (e: any) {
      setLoginError(e.message || 'Identifiants incorrects');
    }
  };

  const handleRegister = async () => {
    setRegisterError('');
    const pw = registerForm.password;
    if (pw.length < 8 || !/[A-Z]/.test(pw) || !/[a-z]/.test(pw) || !/[0-9]/.test(pw) || !/[^A-Za-z0-9]/.test(pw)) {
      setRegisterError('Le mot de passe doit contenir au moins 8 caracteres, 1 majuscule, 1 minuscule, 1 chiffre et 1 caractere special');
      return;
    }
    if (registerForm.password !== registerForm.confirmPassword) {
      setRegisterError('Les mots de passe ne correspondent pas');
      return;
    }
    try {
      const res = await api.auth.playerRegister(registerForm.username, registerForm.password, registerForm.licenseNumber);
      if (res.success) {
        const newAuth: AuthState = {
          role: 'player',
          token: res.token,
          username: res.username || registerForm.username,
        };
        setAuth(newAuth);
        localStorage.setItem('tt_auth', JSON.stringify(newAuth));
        setShowRegisterDialog(false);
        setRegisterForm({ username: '', password: '', confirmPassword: '', licenseNumber: '' });
      }
    } catch (e: any) {
      setRegisterError(e.message || 'Erreur lors de la creation du compte');
    }
  };

  const handleLogout = () => {
    setAuth({ role: 'visitor', token: null, username: null });
    localStorage.removeItem('tt_auth');
    setActiveTab('accueil');
  };

  const handleTabChange = (tab: string) => {
    if (tab === 'connexion' && auth.role === 'visitor') {
      setShowLoginDialog(true);
      return;
    }
    setActiveTab(tab);
  };

  const gridMap: Record<number, string> = {
    1: 'grid-cols-1', 2: 'grid-cols-2', 3: 'grid-cols-3',
    4: 'grid-cols-4', 5: 'grid-cols-5', 6: 'grid-cols-6',
    7: 'grid-cols-4 md:grid-cols-7', 8: 'grid-cols-4 md:grid-cols-8',
    9: 'grid-cols-5 md:grid-cols-9',
  };
  const colsClass = gridMap[visibleTabs.length] || 'grid-cols-5 md:grid-cols-9';

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3"
          >
            <Image 
              src="/logo.png" 
              alt="Chelles TT" 
              width={60} 
              height={60}
              className="object-contain"
            />
            <h1 className="text-2xl font-bold text-gray-900">
              Chelles TT - Tournoi
            </h1>
          </motion.div>
          {auth.role !== 'visitor' && (
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-600 flex items-center gap-1">
                <User className="h-4 w-4" />
                {auth.username} ({auth.role === 'admin' ? 'Admin' : 'Joueur'})
              </span>
              <Button variant="outline" size="sm" onClick={handleLogout}>
                <LogOut className="h-4 w-4 mr-1" /> Deconnexion
              </Button>
            </div>
          )}
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <TabsList className={`grid w-full ${colsClass} mb-6 bg-white/80 backdrop-blur`}>
            {visibleTabs.map((tab) => (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                className="flex items-center gap-1 text-xs md:text-sm data-[state=active]:bg-blue-600 data-[state=active]:text-white transition-all px-2 py-1.5"
              >
                <tab.icon className="h-4 w-4" />
                <span className="hidden lg:inline">{tab.label}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="accueil" className="mt-0">
            <ErrorBoundary><AccueilPage onNavigate={setActiveTab} userRole={auth.role} /></ErrorBoundary>
          </TabsContent>
          <TabsContent value="live" className="mt-0">
            <ErrorBoundary><LivePage /></ErrorBoundary>
          </TabsContent>
          <TabsContent value="inscription" className="mt-0">
            <ErrorBoundary><InscriptionPage /></ErrorBoundary>
          </TabsContent>
          {auth.role !== 'visitor' && (
            <TabsContent value="notifications" className="mt-0">
              <ErrorBoundary><NotificationsPage /></ErrorBoundary>
            </TabsContent>
          )}
          <TabsContent value="buvette" className="mt-0">
            <ErrorBoundary><BuvettePage /></ErrorBoundary>
          </TabsContent>
          {auth.role !== 'visitor' && (
            <TabsContent value="joueurs" className="mt-0">
              <ErrorBoundary><JoueursLivePage /></ErrorBoundary>
            </TabsContent>
          )}
          {auth.role !== 'visitor' && (
            <TabsContent value="progression" className="mt-0">
              <ErrorBoundary><ProgressionPage /></ErrorBoundary>
            </TabsContent>
          )}
          <TabsContent value="reglement" className="mt-0">
            <ErrorBoundary><ReglementPage /></ErrorBoundary>
          </TabsContent>
          <TabsContent value="connexion" className="mt-0">
            <ErrorBoundary>
              {auth.role === 'admin' ? (
                <AdminPage />
              ) : auth.role === 'player' ? (
                <div className="bg-white rounded-lg shadow p-8 text-center max-w-md mx-auto">
                  <User className="h-16 w-16 mx-auto text-blue-600 mb-4" />
                  <h2 className="text-xl font-bold mb-2">Connecte en tant que Joueur</h2>
                  <p className="text-gray-600 mb-4">Bienvenue, {auth.username} !</p>
                  <p className="text-sm text-gray-500 mb-6">
                    Vous avez acces aux pages Notifications, Joueurs et Progression.
                  </p>
                  <Button variant="outline" onClick={handleLogout}>
                    <LogOut className="h-4 w-4 mr-2" /> Se deconnecter
                  </Button>
                </div>
              ) : null}
            </ErrorBoundary>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={showLoginDialog} onOpenChange={(open) => { if (!open) { setShowLoginDialog(false); setLoginError(''); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Connexion</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nom d&apos;utilisateur</Label>
              <Input
                value={loginForm.username}
                onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                placeholder="Votre identifiant"
              />
            </div>
            <div>
              <Label>Mot de passe</Label>
              <Input
                type="password"
                value={loginForm.password}
                onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                placeholder="Votre mot de passe"
              />
            </div>
            {loginError && <p className="text-red-500 text-sm">{loginError}</p>}
            <Button onClick={handleLogin} className="w-full">Se connecter</Button>
            <div className="text-center space-y-2">
              <button
                className="text-sm text-gray-500 hover:underline block w-full"
                onClick={() => {
                  const email = prompt("Entrez votre adresse email pour reinitialiser votre mot de passe :");
                  if (email) {
                    alert("Si un compte est associe a cette adresse, un email de reinitialisation sera envoye.");
                  }
                }}
              >
                Mot de passe oublie ?
              </button>
              <button
                className="text-sm text-blue-600 hover:underline"
                onClick={() => { setShowLoginDialog(false); setShowRegisterDialog(true); }}
              >
                Pas encore de compte ? Creer un compte
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showRegisterDialog} onOpenChange={(open) => { if (!open) { setShowRegisterDialog(false); setRegisterError(''); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Creer un compte</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nom d&apos;utilisateur</Label>
              <Input
                value={registerForm.username}
                onChange={(e) => setRegisterForm({ ...registerForm, username: e.target.value })}
                placeholder="Choisissez un identifiant"
              />
            </div>
            <div>
              <Label>Mot de passe</Label>
              <Input
                type="password"
                value={registerForm.password}
                onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })}
                placeholder="Min. 8 car., 1 majuscule, 1 minuscule, 1 chiffre, 1 special"
              />
            </div>
            <div>
              <Label>Confirmer le mot de passe</Label>
              <Input
                type="password"
                value={registerForm.confirmPassword}
                onChange={(e) => setRegisterForm({ ...registerForm, confirmPassword: e.target.value })}
                placeholder="Retapez le mot de passe"
              />
            </div>
            <div>
              <Label>Numero de licence FFTT (optionnel)</Label>
              <Input
                value={registerForm.licenseNumber}
                onChange={(e) => setRegisterForm({ ...registerForm, licenseNumber: e.target.value })}
                placeholder="Ex: 7732605"
              />
              <p className="text-xs text-gray-500 mt-1">Permet de lier votre compte a votre profil joueur</p>
            </div>
            {registerError && <p className="text-red-500 text-sm">{registerError}</p>}
            <Button onClick={handleRegister} className="w-full">Creer le compte</Button>
            <div className="text-center">
              <button
                className="text-sm text-blue-600 hover:underline"
                onClick={() => { setShowRegisterDialog(false); setShowLoginDialog(true); }}
              >
                Deja un compte ? Se connecter
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}
