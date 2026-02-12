"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Users, Bell, Coffee, LayoutGrid, 
  UserPlus, Settings, Trophy, Home as HomeIcon,
  TrendingUp, FileText
} from "lucide-react";
import AccueilPage from "@/components/AccueilPage";
import LivePage from "@/components/LivePage";
import InscriptionPage from "@/components/InscriptionPage";
import NotificationsPage from "@/components/NotificationsPage";
import BuvettePage from "@/components/BuvettePage";
import TableauPage from "@/components/TableauPage";
import JoueursLivePage from "@/components/JoueursLivePage";
import ProgressionPage from "@/components/ProgressionPage";
import ReglementPage from "@/components/ReglementPage";
import AdminPage from "@/components/AdminPage";

export default function Home() {
  const [activeTab, setActiveTab] = useState("accueil");

  const tabs = [
    { id: "accueil", label: "Accueil", icon: HomeIcon },
    { id: "inscription", label: "Inscription", icon: UserPlus },
    { id: "notifications", label: "Notifications", icon: Bell },
    { id: "live", label: "Live", icon: LayoutGrid },
    { id: "joueurs", label: "Joueurs", icon: Users },
    { id: "tableau", label: "Tableau", icon: Trophy },
    { id: "progression", label: "Progression", icon: TrendingUp },
    { id: "buvette", label: "Buvette", icon: Coffee },
    { id: "reglement", label: "Reglement", icon: FileText },
    { id: "admin", label: "Admin", icon: Settings },
  ];

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-3">
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
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-5 md:grid-cols-10 mb-6 bg-white/80 backdrop-blur">
            {tabs.map((tab) => (
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

          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              <TabsContent value="accueil" className="mt-0">
                <AccueilPage />
              </TabsContent>
              <TabsContent value="live" className="mt-0">
                <LivePage />
              </TabsContent>
              <TabsContent value="inscription" className="mt-0">
                <InscriptionPage />
              </TabsContent>
              <TabsContent value="notifications" className="mt-0">
                <NotificationsPage />
              </TabsContent>
              <TabsContent value="buvette" className="mt-0">
                <BuvettePage />
              </TabsContent>
              <TabsContent value="tableau" className="mt-0">
                <TableauPage />
              </TabsContent>
              <TabsContent value="joueurs" className="mt-0">
                <JoueursLivePage />
              </TabsContent>
              <TabsContent value="progression" className="mt-0">
                <ProgressionPage />
              </TabsContent>
              <TabsContent value="reglement" className="mt-0">
                <ReglementPage />
              </TabsContent>
              <TabsContent value="admin" className="mt-0">
                <AdminPage />
              </TabsContent>
            </motion.div>
          </AnimatePresence>
        </Tabs>
      </div>
    </main>
  );
}
