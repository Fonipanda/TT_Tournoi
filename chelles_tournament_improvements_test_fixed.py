import requests
import sys
import json
from datetime import datetime

class ChellesTournamentImprovementsTestFixed:
    def __init__(self, base_url="https://match-tracker-109.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []
        self.created_ids = {
            'players': [],
            'rooms': [],
            'tables': [],
            'matches': [],
            'tournaments': [],
            'brackets': [],
            'registrations': []
        }

    def run_test(self, name, method, endpoint, expected_status, data=None, params=None):
        """Run a single API test"""
        url = f"{self.api_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        if params:
            print(f"   Params: {params}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, params=params)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers, params=params)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    response_data = response.json()
                    if isinstance(response_data, dict) and 'id' in response_data:
                        print(f"   Created ID: {response_data['id']}")
                    return True, response_data
                except:
                    return True, {}
            else:
                self.failed_tests.append(f"{name} - Expected {expected_status}, got {response.status_code}")
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_detail = response.json()
                    print(f"   Error: {error_detail}")
                except:
                    print(f"   Response: {response.text}")
                return False, {}

        except Exception as e:
            self.failed_tests.append(f"{name} - Exception: {str(e)}")
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def setup_test_data(self):
        """Create test data needed for the improvements tests"""
        print("\n" + "="*60)
        print("SETTING UP TEST DATA")
        print("="*60)
        
        # Create tournament
        tournament_data = {
            "name": "Chelles TT 2025 - Test des Améliorations Fixed",
            "description": "Tournoi pour tester les nouvelles améliorations (version corrigée)"
        }
        
        success, response = self.run_test("Setup - Create Tournament", "POST", "tournaments", 201, tournament_data)
        if success and 'id' in response:
            self.created_ids['tournaments'].append(response['id'])
            tournament_id = response['id']
            
            # Create brackets with new fields
            brackets_data = [
                {
                    "tournament_id": tournament_id,
                    "name": "Tableau A - NC à 799",
                    "category": "NC à 799 pts",
                    "min_points": 0,
                    "max_points": 799,
                    "max_players": 16,
                    "entry_fee": 15.0
                },
                {
                    "tournament_id": tournament_id,
                    "name": "Tableau B - 800 à 1399",
                    "category": "800 à 1399 pts",
                    "min_points": 800,
                    "max_points": 1399,
                    "max_players": 32,
                    "entry_fee": 20.0
                }
            ]
            
            for bracket_data in brackets_data:
                success, response = self.run_test(f"Setup - Create {bracket_data['name']}", "POST", "brackets", 201, bracket_data)
                if success and 'id' in response:
                    self.created_ids['brackets'].append(response['id'])
        
        # Create test players
        players_data = [
            {
                "first_name": "Marie",
                "last_name": "Dubois",
                "email": "marie.dubois.fixed@chelles-tt.fr",
                "license_number": "3421810",
                "ranking": "850",
                "club": "Chelles TT",
                "phone": "0123456789"
            },
            {
                "first_name": "Pierre",
                "last_name": "Martin",
                "email": "pierre.martin.fixed@chelles-tt.fr",
                "license_number": "1234567",
                "ranking": "1200",
                "club": "Chelles TT",
                "phone": "0123456790"
            },
            {
                "first_name": "Sophie",
                "last_name": "Bernard",
                "email": "sophie.bernard.fixed@chelles-tt.fr",
                "license_number": "9876543",
                "ranking": "650",
                "club": "Chelles TT",
                "phone": "0123456791"
            },
            {
                "first_name": "Lucas",
                "last_name": "Petit",
                "email": "lucas.petit.fixed@chelles-tt.fr",
                "license_number": "5555555",
                "ranking": "1100",
                "club": "Chelles TT",
                "phone": "0123456792"
            }
        ]
        
        for player_data in players_data:
            success, response = self.run_test(f"Setup - Create Player {player_data['first_name']}", "POST", "players", 201, player_data)
            if success and 'id' in response:
                self.created_ids['players'].append(response['id'])
        
        # Create room and table
        room_data = {
            "name": "Salle Principale Fixed",
            "description": "Salle principale du tournoi (version corrigée)"
        }
        
        success, response = self.run_test("Setup - Create Room", "POST", "rooms", 201, room_data)
        if success and 'id' in response:
            self.created_ids['rooms'].append(response['id'])
            room_id = response['id']
            
            # Create tables
            for i in range(1, 4):
                table_data = {
                    "table_number": i,
                    "room_id": room_id
                }
                success, response = self.run_test(f"Setup - Create Table {i}", "POST", "tables", 201, table_data)
                if success and 'id' in response:
                    self.created_ids['tables'].append(response['id'])

    def test_inscription_improvements(self):
        """Test des améliorations de l'onglet Inscription"""
        print("\n" + "="*60)
        print("1. TEST DES AMÉLIORATIONS DE L'ONGLET INSCRIPTION")
        print("="*60)
        
        # Test endpoint /api/players/search?email= pour la recherche par email
        print("\n📧 Test de la recherche par email...")
        
        if self.created_ids['players']:
            # Test recherche par email exact
            test_email = "marie.dubois.fixed@chelles-tt.fr"
            success, response = self.run_test(
                "Recherche par email exact", 
                "GET", 
                "players/search", 
                200, 
                params={"email": test_email}
            )
            
            if success:
                if isinstance(response, list) and len(response) > 0:
                    player = response[0]
                    if player.get('email') == test_email:
                        print(f"   ✅ Joueur trouvé: {player.get('first_name')} {player.get('last_name')}")
                    else:
                        print(f"   ❌ Email incorrect dans la réponse: {player.get('email')}")
                else:
                    print("   ❌ Aucun joueur trouvé")
            
            # Test recherche par email case insensitive
            success, response = self.run_test(
                "Recherche par email case insensitive", 
                "GET", 
                "players/search", 
                200, 
                params={"email": "MARIE.DUBOIS.FIXED@CHELLES-TT.FR"}
            )
            
            if success and isinstance(response, list) and len(response) > 0:
                print("   ✅ Recherche case insensitive fonctionne")
            
            # Test recherche par email inexistant
            success, response = self.run_test(
                "Recherche par email inexistant", 
                "GET", 
                "players/search", 
                200, 
                params={"email": "inexistant@test.com"}
            )
            
            if success and isinstance(response, list) and len(response) == 0:
                print("   ✅ Aucun résultat pour email inexistant (correct)")
        
        # Test endpoint /api/players/{id}/registration-summary
        print("\n📋 Test du résumé d'inscription...")
        
        if self.created_ids['players'] and self.created_ids['brackets']:
            player_id = self.created_ids['players'][0]
            
            # D'abord inscrire le joueur à quelques tableaux
            for i, bracket_id in enumerate(self.created_ids['brackets'][:2]):
                registration_data = {
                    "player_id": player_id,
                    "bracket_id": bracket_id,
                    "payment_method": "card" if i == 0 else "on_site",
                    "payment_status": "paid" if i == 0 else "pending"
                }
                
                success, response = self.run_test(
                    f"Inscription au tableau {i+1}", 
                    "POST", 
                    "player-bracket-registrations", 
                    201, 
                    registration_data
                )
                
                if success and 'id' in response:
                    self.created_ids['registrations'].append(response['id'])
            
            # Test du résumé d'inscription
            success, response = self.run_test(
                "Résumé d'inscription du joueur", 
                "GET", 
                f"players/{player_id}/registration-summary", 
                200
            )
            
            if success:
                # Vérifier l'enrichissement des données
                required_fields = ['player_id', 'registrations', 'total_amount', 'registration_count']
                missing_fields = [field for field in required_fields if field not in response]
                
                if not missing_fields:
                    print(f"   ✅ Structure complète du résumé")
                    print(f"   📊 Nombre d'inscriptions: {response.get('registration_count')}")
                    print(f"   💰 Montant total: {response.get('total_amount')}€")
                    
                    # Vérifier les détails des inscriptions
                    registrations = response.get('registrations', [])
                    for reg in registrations:
                        reg_fields = ['bracket_id', 'bracket_name', 'bracket_category', 'entry_fee', 'payment_status']
                        missing_reg_fields = [field for field in reg_fields if field not in reg]
                        
                        if not missing_reg_fields:
                            print(f"   ✅ Inscription complète: {reg.get('bracket_name')} - {reg.get('entry_fee')}€ ({reg.get('payment_status')})")
                        else:
                            print(f"   ❌ Champs manquants dans l'inscription: {missing_reg_fields}")
                else:
                    print(f"   ❌ Champs manquants dans le résumé: {missing_fields}")

    def test_live_players_improvements(self):
        """Test de l'onglet Joueurs Live amélioré"""
        print("\n" + "="*60)
        print("2. TEST DE L'ONGLET JOUEURS LIVE AMÉLIORÉ")
        print("="*60)
        
        # Test que /api/matches filtre correctement les matchs avec status="in_progress"
        print("\n🎯 Test du filtrage des matchs en cours...")
        
        success, response = self.run_test(
            "Filtrer matchs en cours", 
            "GET", 
            "matches", 
            200, 
            params={"status": "in_progress"}
        )
        
        if success:
            if isinstance(response, list):
                in_progress_matches = [match for match in response if match.get('status') == 'in_progress']
                print(f"   ✅ {len(in_progress_matches)} match(s) en cours trouvé(s)")
                
                for match in in_progress_matches[:3]:  # Limit to first 3 for readability
                    print(f"   📊 Match: {match.get('id')[:8]}... - Status: {match.get('status')}")
            else:
                print("   ❌ Réponse n'est pas une liste")
        
        # Test de l'enrichissement des données matches - try with error handling
        print("\n🔍 Test de l'enrichissement des données live...")
        
        success, response = self.run_test("Données live des matchs", "GET", "live/matches", 200)
        
        if success:
            if isinstance(response, list):
                print(f"   ✅ {len(response)} match(s) live récupéré(s)")
                
                # Check first few matches for enrichment
                for match in response[:3]:  # Limit to first 3 for readability
                    enriched_fields = []
                    if 'player1' in match and match['player1']:
                        enriched_fields.append('player1')
                    if 'player2' in match and match['player2']:
                        enriched_fields.append('player2')
                    if 'table' in match and match['table']:
                        enriched_fields.append('table')
                    
                    if enriched_fields:
                        print(f"   ✅ Match {match.get('id', 'unknown')[:8]}... enrichi avec: {', '.join(enriched_fields)}")
                        
                        # Vérifier les détails des joueurs
                        if 'player1' in match and match['player1']:
                            p1 = match['player1']
                            if 'first_name' in p1 and 'last_name' in p1:
                                print(f"      👤 Joueur 1: {p1.get('first_name')} {p1.get('last_name')} ({p1.get('ranking', 'N/A')})")
                        
                        if 'player2' in match and match['player2']:
                            p2 = match['player2']
                            if 'first_name' in p2 and 'last_name' in p2:
                                print(f"      👤 Joueur 2: {p2.get('first_name')} {p2.get('last_name')} ({p2.get('ranking', 'N/A')})")
                        
                        # Vérifier les détails de la table
                        if 'table' in match and match['table']:
                            table = match['table']
                            if 'table_number' in table:
                                print(f"      🏓 Table: {table.get('table_number')} (Status: {table.get('status', 'N/A')})")
                    else:
                        print(f"   ⚠️ Match {match.get('id', 'unknown')[:8]}... sans enrichissement")
            else:
                print("   ❌ Réponse n'est pas une liste")
        else:
            print("   ⚠️ Endpoint live/matches non disponible - peut être dû à des données corrompues")

    def test_admin_matches_improvements(self):
        """Test des améliorations Admin/Matchs"""
        print("\n" + "="*60)
        print("3. TEST DES AMÉLIORATIONS ADMIN/MATCHS")
        print("="*60)
        
        # Créer un match pour les tests
        if len(self.created_ids['players']) >= 2 and self.created_ids['brackets']:
            match_data = {
                "bracket_id": self.created_ids['brackets'][0],
                "player1_id": self.created_ids['players'][0],
                "player2_id": self.created_ids['players'][1],
                "round_name": "Test Match"
            }
            
            success, response = self.run_test("Créer match pour test", "POST", "matches", 201, match_data)
            if success and 'id' in response:
                match_id = response['id']
                self.created_ids['matches'].append(match_id)
                
                # Test endpoint PUT /api/matches/{id}/finish sans champs "points" (seulement sets)
                print("\n🏁 Test de finalisation de match (seulement sets)...")
                
                finish_data = {
                    "score_player1": 21,  # Score final du dernier set
                    "score_player2": 18,
                    "sets_player1": 3,    # Nombre de sets gagnés
                    "sets_player2": 1
                }
                
                success, response = self.run_test(
                    "Finaliser match (sets seulement)", 
                    "PUT", 
                    f"matches/{match_id}/finish", 
                    200, 
                    finish_data
                )
                
                if success:
                    # Vérifier que le match est terminé
                    success, match_response = self.run_test(
                        "Vérifier match terminé", 
                        "GET", 
                        f"matches/{match_id}", 
                        200
                    )
                    
                    if success:
                        if match_response.get('status') == 'finished':
                            print(f"   ✅ Match terminé avec status: {match_response.get('status')}")
                            print(f"   🏆 Gagnant: {match_response.get('winner_id')}")
                            print(f"   📊 Sets: {match_response.get('sets_player1')}-{match_response.get('sets_player2')}")
                        else:
                            print(f"   ❌ Match pas terminé: {match_response.get('status')}")
        
        # Test de suppression de match avec libération de table
        print("\n🗑️ Test de suppression de match...")
        
        # Créer un nouveau match pour le test de suppression
        if len(self.created_ids['players']) >= 2 and self.created_ids['brackets']:
            match_data = {
                "bracket_id": self.created_ids['brackets'][0],
                "player1_id": self.created_ids['players'][2] if len(self.created_ids['players']) > 2 else self.created_ids['players'][0],
                "player2_id": self.created_ids['players'][3] if len(self.created_ids['players']) > 3 else self.created_ids['players'][1],
                "round_name": "Test Suppression"
            }
            
            success, response = self.run_test("Créer match pour test suppression", "POST", "matches", 201, match_data)
            if success and 'id' in response:
                match_to_delete_id = response['id']
                
                # Test endpoint DELETE /api/matches/{id} pour suppression de matchs
                success, _ = self.run_test(
                    "Supprimer match", 
                    "DELETE", 
                    f"matches/{match_to_delete_id}", 
                    200
                )
                
                if success:
                    # Vérifier que le match est supprimé
                    success, _ = self.run_test(
                        "Vérifier match supprimé", 
                        "GET", 
                        f"matches/{match_to_delete_id}", 
                        404
                    )
                    
                    if success:
                        print("   ✅ Match correctement supprimé")

    def test_admin_players_improvements(self):
        """Test des améliorations Admin/Joueurs"""
        print("\n" + "="*60)
        print("4. TEST DES AMÉLIORATIONS ADMIN/JOUEURS")
        print("="*60)
        
        # Créer un joueur pour les tests de modification et suppression
        test_player_data = {
            "first_name": "Test",
            "last_name": "Modification",
            "email": "test.modification.fixed@chelles-tt.fr",
            "license_number": "7777777",
            "ranking": "900",
            "club": "Test Club",
            "phone": "0123456799"
        }
        
        success, response = self.run_test("Créer joueur pour test modification", "POST", "players", 201, test_player_data)
        if success and 'id' in response:
            test_player_id = response['id']
            
            # Test endpoint PUT /api/players/{id} pour modification des joueurs
            print("\n✏️ Test de modification de joueur...")
            
            update_data = {
                "first_name": "Test-Modifié",
                "last_name": "Modification-Modifiée",
                "email": "test.modification.modifie.fixed@chelles-tt.fr",
                "license_number": "7777777",
                "ranking": "950",
                "club": "Test Club Modifié",
                "phone": "0123456800"
            }
            
            success, response = self.run_test(
                "Modifier joueur", 
                "PUT", 
                f"players/{test_player_id}", 
                200, 
                update_data
            )
            
            if success:
                # Vérifier que les modifications ont été appliquées
                success, player_response = self.run_test(
                    "Vérifier modifications appliquées", 
                    "GET", 
                    f"players/{test_player_id}", 
                    200
                )
                
                if success:
                    if player_response.get('first_name') == "Test-Modifié":
                        print(f"   ✅ Prénom modifié: {player_response.get('first_name')}")
                    if player_response.get('email') == "test.modification.modifie.fixed@chelles-tt.fr":
                        print(f"   ✅ Email modifié: {player_response.get('email')}")
                    if player_response.get('ranking') == "950":
                        print(f"   ✅ Classement modifié: {player_response.get('ranking')}")
            
            # Test validation email unique lors des modifications
            print("\n📧 Test validation email unique...")
            
            if self.created_ids['players']:
                # Essayer de modifier avec un email déjà existant
                invalid_update_data = {
                    "first_name": "Test",
                    "last_name": "Email Conflit",
                    "email": "marie.dubois.fixed@chelles-tt.fr",  # Email déjà utilisé
                    "ranking": "900"
                }
                
                success, response = self.run_test(
                    "Modifier avec email existant (doit échouer)", 
                    "PUT", 
                    f"players/{test_player_id}", 
                    400, 
                    invalid_update_data
                )
                
                if success:
                    print("   ✅ Validation email unique fonctionne")
            
            # Test endpoint DELETE /api/players/{id} avec suppression en cascade
            print("\n🗑️ Test suppression joueur avec cascade...")
            
            # D'abord inscrire le joueur à un tableau
            if self.created_ids['brackets']:
                registration_data = {
                    "player_id": test_player_id,
                    "bracket_id": self.created_ids['brackets'][0],
                    "payment_status": "paid"
                }
                
                success, reg_response = self.run_test(
                    "Inscrire joueur pour test suppression", 
                    "POST", 
                    "player-bracket-registrations", 
                    201, 
                    registration_data
                )
                
                if success and 'id' in reg_response:
                    # Maintenant supprimer le joueur
                    success, _ = self.run_test(
                        "Supprimer joueur avec cascade", 
                        "DELETE", 
                        f"players/{test_player_id}", 
                        200
                    )
                    
                    if success:
                        # Vérifier que le joueur est supprimé
                        success, _ = self.run_test(
                            "Vérifier joueur supprimé", 
                            "GET", 
                            f"players/{test_player_id}", 
                            404
                        )
                        
                        if success:
                            print("   ✅ Joueur correctement supprimé")
                        
                        # Vérifier que les inscriptions sont supprimées
                        success, reg_check = self.run_test(
                            "Vérifier inscriptions supprimées", 
                            "GET", 
                            "player-bracket-registrations", 
                            200, 
                            params={"player_id": test_player_id}
                        )
                        
                        if success and isinstance(reg_check, list) and len(reg_check) == 0:
                            print("   ✅ Inscriptions supprimées en cascade")

    def test_existing_endpoints_regression(self):
        """Test des endpoints existants (non-régression)"""
        print("\n" + "="*60)
        print("5. TEST DES ENDPOINTS EXISTANTS (NON-RÉGRESSION)")
        print("="*60)
        
        # Vérifier que tous les endpoints FFTT continuent de fonctionner
        print("\n🏓 Test endpoints FFTT...")
        
        # Test avec des numéros de licence valides (mock)
        valid_licenses = ["3421810", "1234567", "9876543"]
        for license_num in valid_licenses:
            success, response = self.run_test(
                f"FFTT Lookup - {license_num}", 
                "GET", 
                f"fftt/lookup/{license_num}", 
                200
            )
            
            if success:
                if response.get('success'):
                    print(f"   ✅ FFTT lookup fonctionnel pour {license_num}")
                    if 'data' in response and response['data']:
                        data = response['data']
                        required_fields = ['licence', 'nom', 'prenom', 'points_init', 'point', '_virtual']
                        if all(field in data for field in required_fields):
                            print(f"   ✅ Structure de données FFTT complète")
                else:
                    print(f"   ⚠️ FFTT lookup retourne success=false pour {license_num}")
        
        # Test des endpoints tournaments/brackets avec nouveaux champs
        print("\n🏆 Test endpoints tournaments/brackets avec nouveaux champs...")
        
        if self.created_ids['tournaments']:
            tournament_id = self.created_ids['tournaments'][0]
            
            success, response = self.run_test(
                "Get tournament avec nouveaux champs", 
                "GET", 
                f"tournaments/{tournament_id}", 
                200
            )
            
            if success:
                print(f"   ✅ Tournament endpoint fonctionnel")
        
        if self.created_ids['brackets']:
            bracket_id = self.created_ids['brackets'][0]
            
            success, response = self.run_test(
                "Get bracket avec nouveaux champs", 
                "GET", 
                f"brackets/{bracket_id}", 
                200
            )
            
            if success:
                # Vérifier que les nouveaux champs sont présents
                if 'max_players' in response and 'entry_fee' in response:
                    print(f"   ✅ Nouveaux champs présents: max_players={response.get('max_players')}, entry_fee={response.get('entry_fee')}")
                else:
                    print("   ❌ Nouveaux champs manquants dans la réponse bracket")
        
        # Vérifier que les inscriptions avec paiement fonctionnent toujours
        print("\n💳 Test inscriptions avec paiement...")
        
        if self.created_ids['registrations']:
            # Vérifier une inscription existante
            success, response = self.run_test(
                "Get inscriptions avec paiement", 
                "GET", 
                "player-bracket-registrations", 
                200
            )
            
            if success and isinstance(response, list) and len(response) > 0:
                registration = response[0]
                payment_fields = ['payment_method', 'payment_status', 'amount_paid']
                if all(field in registration for field in payment_fields):
                    print(f"   ✅ Champs de paiement présents: {registration.get('payment_status')} - {registration.get('amount_paid')}€")
                else:
                    print("   ❌ Champs de paiement manquants")

    def cleanup_test_data(self):
        """Clean up created test data"""
        print("\n" + "="*60)
        print("NETTOYAGE DES DONNÉES DE TEST")
        print("="*60)
        
        # Delete in reverse order of dependencies
        for match_id in self.created_ids.get('matches', []):
            self.run_test(f"Cleanup - Delete Match", "DELETE", f"matches/{match_id}", 200)
        
        for table_id in self.created_ids.get('tables', []):
            self.run_test(f"Cleanup - Delete Table", "DELETE", f"tables/{table_id}", 200)
        
        for room_id in self.created_ids.get('rooms', []):
            self.run_test(f"Cleanup - Delete Room", "DELETE", f"rooms/{room_id}", 200)
        
        for player_id in self.created_ids.get('players', []):
            self.run_test(f"Cleanup - Delete Player", "DELETE", f"players/{player_id}", 200)
        
        for tournament_id in self.created_ids.get('tournaments', []):
            self.run_test(f"Cleanup - Delete Tournament", "DELETE", f"tournaments/{tournament_id}", 200)

    def run_all_tests(self):
        """Run all improvement tests"""
        print("🚀 TESTS DES NOUVELLES AMÉLIORATIONS DU SYSTÈME DE TOURNOI CHELLES TT (VERSION CORRIGÉE)")
        print(f"Base URL: {self.base_url}")
        print("="*90)
        
        # Setup test data
        self.setup_test_data()
        
        # Run improvement tests
        self.test_inscription_improvements()
        self.test_live_players_improvements()
        self.test_admin_matches_improvements()
        self.test_admin_players_improvements()
        self.test_existing_endpoints_regression()
        
        # Cleanup
        self.cleanup_test_data()
        
        # Print results
        print("\n" + "="*90)
        print("📊 RÉSULTATS DES TESTS")
        print("="*90)
        print(f"Tests exécutés: {self.tests_run}")
        print(f"Tests réussis: {self.tests_passed}")
        print(f"Tests échoués: {self.tests_run - self.tests_passed}")
        print(f"Taux de réussite: {(self.tests_passed/self.tests_run)*100:.1f}%")
        
        if self.failed_tests:
            print("\n❌ TESTS ÉCHOUÉS:")
            for failed_test in self.failed_tests:
                print(f"   - {failed_test}")
        
        return 0 if self.tests_passed == self.tests_run else 1

def main():
    tester = ChellesTournamentImprovementsTestFixed()
    return tester.run_all_tests()

if __name__ == "__main__":
    sys.exit(main())