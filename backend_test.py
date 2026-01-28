import requests
import sys
import json
from datetime import datetime

class ChellesTournamentAPITester:
    def __init__(self, base_url="https://match-tracker-109.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.tests_run = 0
        self.tests_passed = 0
        self.created_ids = {
            'players': [],
            'rooms': [],
            'tables': [],
            'matches': [],
            'tournaments': [],
            'brackets': [],
            'registrations': [],
            'menu_sections': [],
            'menu_items': [],
            'notifications': []
        }

    def run_test(self, name, method, endpoint, expected_status, data=None, params=None):
        """Run a single API test"""
        url = f"{self.api_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, params=params)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers)
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
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_detail = response.json()
                    print(f"   Error: {error_detail}")
                except:
                    print(f"   Response: {response.text}")
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_root_endpoint(self):
        """Test the root API endpoint"""
        return self.run_test("Root API", "GET", "", 200)

    def test_qr_code_endpoint(self):
        """Test QR code endpoint"""
        return self.run_test("QR Code", "GET", "qr-code", 200)

    def test_player_operations(self):
        """Test all player CRUD operations"""
        print("\n" + "="*50)
        print("TESTING PLAYER OPERATIONS")
        print("="*50)
        
        # Create player
        player_data = {
            "first_name": "Jean",
            "last_name": "Dupont",
            "email": "jean.dupont@test.com",
            "license_number": "123456",
            "ranking": "1200",
            "club": "Chelles TT",
            "phone": "0123456789"
        }
        
        success, response = self.run_test("Create Player", "POST", "players", 201, player_data)
        if success and 'id' in response:
            player_id = response['id']
            self.created_ids['players'].append(player_id)
            
            # Get player by ID
            self.run_test("Get Player by ID", "GET", f"players/{player_id}", 200)
            
            # Update player
            update_data = {
                "first_name": "Jean-Updated",
                "last_name": "Dupont",
                "email": "jean.dupont@test.com",
                "ranking": "1300"
            }
            self.run_test("Update Player", "PUT", f"players/{player_id}", 200, update_data)
        
        # Get all players
        self.run_test("Get All Players", "GET", "players", 200)
        
        # Search players
        self.run_test("Search Players", "GET", "players", 200, params={"search": "Jean"})

    def test_room_operations(self):
        """Test all room CRUD operations"""
        print("\n" + "="*50)
        print("TESTING ROOM OPERATIONS")
        print("="*50)
        
        # Create room
        room_data = {
            "name": "Salle Test",
            "description": "Salle de test pour les API"
        }
        
        success, response = self.run_test("Create Room", "POST", "rooms", 201, room_data)
        if success and 'id' in response:
            room_id = response['id']
            self.created_ids['rooms'].append(room_id)
            
            # Get room by ID
            self.run_test("Get Room by ID", "GET", f"rooms/{room_id}", 200)
            
            # Update room
            update_data = {
                "name": "Salle Test Updated",
                "description": "Description mise à jour"
            }
            self.run_test("Update Room", "PUT", f"rooms/{room_id}", 200, update_data)
        
        # Get all rooms
        self.run_test("Get All Rooms", "GET", "rooms", 200)

    def test_table_operations(self):
        """Test all table CRUD operations"""
        print("\n" + "="*50)
        print("TESTING TABLE OPERATIONS")
        print("="*50)
        
        # Need a room first
        if not self.created_ids['rooms']:
            room_data = {"name": "Salle pour Tables", "description": "Test room"}
            success, response = self.run_test("Create Room for Tables", "POST", "rooms", 201, room_data)
            if success and 'id' in response:
                self.created_ids['rooms'].append(response['id'])
        
        if self.created_ids['rooms']:
            room_id = self.created_ids['rooms'][0]
            
            # Create table
            table_data = {
                "table_number": 1,
                "room_id": room_id
            }
            
            success, response = self.run_test("Create Table", "POST", "tables", 201, table_data)
            if success and 'id' in response:
                table_id = response['id']
                self.created_ids['tables'].append(table_id)
                
                # Get table by ID
                self.run_test("Get Table by ID", "GET", f"tables/{table_id}", 200)
                
                # Update table status
                update_data = {"status": "occupied"}
                self.run_test("Update Table Status", "PUT", f"tables/{table_id}", 200, update_data)
            
            # Get all tables
            self.run_test("Get All Tables", "GET", "tables", 200)
            
            # Get tables by room
            self.run_test("Get Tables by Room", "GET", "tables", 200, params={"room_id": room_id})

    def test_tournament_and_bracket_operations(self):
        """Test tournament and bracket operations with new features"""
        print("\n" + "="*50)
        print("TESTING TOURNAMENT & BRACKET OPERATIONS")
        print("="*50)
        
        # Create tournament
        tournament_data = {
            "name": "Chelles TT 2025 Test",
            "description": "Tournoi de test"
        }
        
        success, response = self.run_test("Create Tournament", "POST", "tournaments", 201, tournament_data)
        tournament_id = None
        if success and 'id' in response:
            tournament_id = response['id']
            self.created_ids['tournaments'] = [tournament_id]
            
            # Get tournament by ID
            self.run_test("Get Tournament by ID", "GET", f"tournaments/{tournament_id}", 200)
        
        # Get all tournaments
        self.run_test("Get All Tournaments", "GET", "tournaments", 200)
        
        # Create brackets with new fields (max_players, entry_fee)
        if tournament_id:
            brackets_data = [
                {
                    "tournament_id": tournament_id, 
                    "name": "Tableau A", 
                    "category": "Nc à 799 pts", 
                    "min_points": 0, 
                    "max_points": 799,
                    "max_players": 16,
                    "entry_fee": 15.0
                },
                {
                    "tournament_id": tournament_id, 
                    "name": "Tableau B", 
                    "category": "Nc à 1399 pts", 
                    "min_points": 800, 
                    "max_points": 1399,
                    "max_players": 32,
                    "entry_fee": 20.0
                },
                {
                    "tournament_id": tournament_id, 
                    "name": "Tableau C", 
                    "category": "Nc à 999 pts", 
                    "min_points": 0, 
                    "max_points": 999,
                    "max_players": 8,
                    "entry_fee": 12.5
                }
            ]
            
            self.created_ids['brackets'] = []
            for bracket_data in brackets_data:
                success, response = self.run_test(f"Create {bracket_data['name']} with new fields", "POST", "brackets", 201, bracket_data)
                if success and 'id' in response:
                    self.created_ids['brackets'].append(response['id'])
                    
                    # Test bracket stats endpoint
                    bracket_id = response['id']
                    success_stats, stats_response = self.run_test(f"Get {bracket_data['name']} Stats", "GET", f"brackets/{bracket_id}/stats", 200)
                    if success_stats:
                        # Validate stats response structure
                        expected_fields = ['bracket_id', 'registered_players', 'max_players', 'available_spots', 'is_full', 'entry_fee']
                        missing_fields = [field for field in expected_fields if field not in stats_response]
                        if not missing_fields:
                            print(f"   ✅ All stats fields present: registered={stats_response.get('registered_players')}, max={stats_response.get('max_players')}, available={stats_response.get('available_spots')}, fee={stats_response.get('entry_fee')}")
                        else:
                            print(f"   ❌ Missing stats fields: {missing_fields}")
            
            # Get brackets by tournament
            self.run_test("Get Brackets by Tournament", "GET", "brackets", 200, params={"tournament_id": tournament_id})
        
        # Get all brackets
        self.run_test("Get All Brackets", "GET", "brackets", 200)
        
        # Test bracket validation constraints
        if tournament_id:
            # Test invalid max_players (too low)
            invalid_bracket_1 = {
                "tournament_id": tournament_id,
                "name": "Invalid Bracket 1",
                "category": "Test",
                "max_players": 1,  # Should fail (minimum is 2)
                "entry_fee": 10.0
            }
            self.run_test("Create Bracket - Invalid max_players (too low)", "POST", "brackets", 422, invalid_bracket_1)
            
            # Test invalid max_players (too high)
            invalid_bracket_2 = {
                "tournament_id": tournament_id,
                "name": "Invalid Bracket 2", 
                "category": "Test",
                "max_players": 65,  # Should fail (maximum is 64)
                "entry_fee": 10.0
            }
            self.run_test("Create Bracket - Invalid max_players (too high)", "POST", "brackets", 422, invalid_bracket_2)
            
            # Test invalid entry_fee (negative)
            invalid_bracket_3 = {
                "tournament_id": tournament_id,
                "name": "Invalid Bracket 3",
                "category": "Test", 
                "max_players": 16,
                "entry_fee": -5.0  # Should fail (must be >= 0)
            }
            self.run_test("Create Bracket - Invalid entry_fee (negative)", "POST", "brackets", 422, invalid_bracket_3)

    def test_player_bracket_registration(self):
        """Test multi-bracket player registration with new features"""
        print("\n" + "="*50)
        print("TESTING PLAYER BRACKET REGISTRATION WITH NEW FEATURES")
        print("="*50)
        
        if self.created_ids.get('players') and self.created_ids.get('brackets'):
            player_id = self.created_ids['players'][0]
            
            # Test registration with payment details
            for i, bracket_id in enumerate(self.created_ids['brackets'][:2]):  # Register to max 2 brackets
                registration_data = {
                    "player_id": player_id,
                    "bracket_id": bracket_id,
                    "payment_method": "card" if i == 0 else "on_site",
                    "payment_status": "paid" if i == 0 else "pending"
                }
                
                success, response = self.run_test(f"Register Player to Bracket {i+1}", "POST", "player-bracket-registrations", 201, registration_data)
                if success and 'id' in response:
                    if not self.created_ids.get('registrations'):
                        self.created_ids['registrations'] = []
                    self.created_ids['registrations'].append(response['id'])
                    
                    # Verify amount_paid is set correctly based on entry_fee
                    if 'amount_paid' in response:
                        print(f"   ✅ Amount paid: {response['amount_paid']}")
            
            # Test registration limit (should fail on 3rd registration)
            if len(self.created_ids['brackets']) > 2:
                third_bracket_id = self.created_ids['brackets'][2]
                registration_data = {
                    "player_id": player_id,
                    "bracket_id": third_bracket_id,
                    "payment_status": "pending"
                }
                self.run_test("Register Player to 3rd Bracket (should fail)", "POST", "player-bracket-registrations", 400, registration_data)
            
            # Test player registration summary
            success, summary_response = self.run_test("Get Player Registration Summary", "GET", f"players/{player_id}/registration-summary", 200)
            if success:
                # Validate summary response structure
                expected_fields = ['player_id', 'registrations', 'total_amount', 'registration_count']
                missing_fields = [field for field in expected_fields if field not in summary_response]
                if not missing_fields:
                    print(f"   ✅ Registration summary complete: count={summary_response.get('registration_count')}, total={summary_response.get('total_amount')}")
                    
                    # Validate registrations details
                    registrations = summary_response.get('registrations', [])
                    for reg in registrations:
                        reg_fields = ['bracket_id', 'bracket_name', 'bracket_category', 'entry_fee', 'payment_status']
                        missing_reg_fields = [field for field in reg_fields if field not in reg]
                        if not missing_reg_fields:
                            print(f"   ✅ Registration detail complete: {reg.get('bracket_name')} - {reg.get('entry_fee')}€")
                        else:
                            print(f"   ❌ Missing registration fields: {missing_reg_fields}")
                else:
                    print(f"   ❌ Missing summary fields: {missing_fields}")
            
            # Get player's brackets
            self.run_test("Get Player Brackets", "GET", f"players/{player_id}/brackets", 200)
            
            # Get registrations by player
            self.run_test("Get Registrations by Player", "GET", "player-bracket-registrations", 200, params={"player_id": player_id})
            
            # Get registrations by bracket
            if self.created_ids['brackets']:
                bracket_id = self.created_ids['brackets'][0]
                self.run_test("Get Registrations by Bracket", "GET", "player-bracket-registrations", 200, params={"bracket_id": bracket_id})
                
                # Test bracket capacity - try to fill bracket to test capacity limits
                # First get current stats
                success, stats = self.run_test("Get Bracket Stats Before Capacity Test", "GET", f"brackets/{bracket_id}/stats", 200)
                if success and 'max_players' in stats and 'registered_players' in stats:
                    max_players = stats['max_players']
                    current_registered = stats['registered_players']
                    available_spots = max_players - current_registered
                    print(f"   📊 Bracket capacity: {current_registered}/{max_players} (available: {available_spots})")
                    
                    # Create additional players to test capacity if needed
                    if available_spots > 0:
                        # Create one more player to test near-capacity
                        test_player_data = {
                            "first_name": "Capacity",
                            "last_name": "Test",
                            "email": "capacity.test@test.com"
                        }
                        success, player_response = self.run_test("Create Player for Capacity Test", "POST", "players", 201, test_player_data)
                        if success and 'id' in player_response:
                            test_player_id = player_response['id']
                            self.created_ids['players'].append(test_player_id)
                            
                            # Register this player
                            capacity_reg_data = {
                                "player_id": test_player_id,
                                "bracket_id": bracket_id,
                                "payment_status": "pending"
                            }
                            self.run_test("Register Player for Capacity Test", "POST", "player-bracket-registrations", 201, capacity_reg_data)
                            
                            # Check updated stats
                            self.run_test("Get Bracket Stats After Registration", "GET", f"brackets/{bracket_id}/stats", 200)
            
            # Test duplicate registration (should fail)
            if self.created_ids['brackets']:
                duplicate_reg_data = {
                    "player_id": player_id,
                    "bracket_id": self.created_ids['brackets'][0],
                    "payment_status": "pending"
                }
                self.run_test("Duplicate Registration (should fail)", "POST", "player-bracket-registrations", 400, duplicate_reg_data)

    def test_match_operations(self):
        """Test match CRUD operations with bracket support"""
        print("\n" + "="*50)
        print("TESTING MATCH OPERATIONS")
        print("="*50)
        
        # Need at least 2 players
        if len(self.created_ids['players']) < 2:
            # Create additional players for matches
            for i in range(2):
                player_data = {
                    "first_name": f"Player{i+2}",
                    "last_name": f"Test{i+2}",
                    "email": f"player{i+2}@test.com"
                }
                success, response = self.run_test(f"Create Player {i+2}", "POST", "players", 201, player_data)
                if success and 'id' in response:
                    self.created_ids['players'].append(response['id'])
        
        if len(self.created_ids['players']) >= 2 and self.created_ids.get('brackets'):
            # Create match with bracket
            match_data = {
                "bracket_id": self.created_ids['brackets'][0],
                "player1_id": self.created_ids['players'][0],
                "player2_id": self.created_ids['players'][1],
                "round_name": "Test Round"
            }
            
            success, response = self.run_test("Create Match", "POST", "matches", 201, match_data)
            if success and 'id' in response:
                match_id = response['id']
                self.created_ids['matches'].append(match_id)
                
                # Get match by ID
                self.run_test("Get Match by ID", "GET", f"matches/{match_id}", 200)
                
                # Test match assignment to table (key feature)
                if self.created_ids.get('tables'):
                    table_id = self.created_ids['tables'][0]
                    # The assign-table endpoint expects table_id as a query parameter
                    success, _ = self.run_test("Assign Match to Table", "PUT", f"matches/{match_id}/assign-table?table_id={table_id}", 200)
                    
                    if success:
                        # Test match finalization (key feature)
                        finish_data = {
                            "score_player1": 21,
                            "score_player2": 18,
                            "sets_player1": 3,
                            "sets_player2": 1
                        }
                        self.run_test("Finish Match", "PUT", f"matches/{match_id}/finish", 200, finish_data)
                
                # Update match
                update_data = {
                    "status": "in_progress",
                    "score_player1": 2,
                    "score_player2": 1
                }
                self.run_test("Update Match", "PUT", f"matches/{match_id}", 200, update_data)
        
        # Get all matches
        self.run_test("Get All Matches", "GET", "matches", 200)
        
        # Get matches by bracket
        if self.created_ids.get('brackets'):
            self.run_test("Get Matches by Bracket", "GET", "matches", 200, params={"bracket_id": self.created_ids['brackets'][0]})

    def test_menu_operations(self):
        """Test menu section and item operations"""
        print("\n" + "="*50)
        print("TESTING MENU OPERATIONS")
        print("="*50)
        
        # Create menu section
        section_data = {
            "name": "Boissons Test",
            "order": 1
        }
        
        success, response = self.run_test("Create Menu Section", "POST", "menu-sections", 201, section_data)
        if success and 'id' in response:
            section_id = response['id']
            self.created_ids['menu_sections'].append(section_id)
            
            # Update menu section
            update_data = {
                "name": "Boissons Test Updated",
                "order": 2
            }
            self.run_test("Update Menu Section", "PUT", f"menu-sections/{section_id}", 200, update_data)
            
            # Create menu item
            item_data = {
                "section_id": section_id,
                "name": "Coca Cola Test",
                "description": "Boisson gazeuse",
                "price": 2.50,
                "order": 1
            }
            
            success, response = self.run_test("Create Menu Item", "POST", "menu-items", 201, item_data)
            if success and 'id' in response:
                item_id = response['id']
                self.created_ids['menu_items'].append(item_id)
                
                # Update menu item
                update_data = {
                    "section_id": section_id,
                    "name": "Coca Cola Test Updated",
                    "description": "Boisson gazeuse rafraîchissante",
                    "price": 3.00,
                    "order": 1
                }
                self.run_test("Update Menu Item", "PUT", f"menu-items/{item_id}", 200, update_data)
        
        # Get all menu sections
        self.run_test("Get All Menu Sections", "GET", "menu-sections", 200)
        
        # Get all menu items
        self.run_test("Get All Menu Items", "GET", "menu-items", 200)

    def test_live_endpoints(self):
        """Test live data endpoints"""
        print("\n" + "="*50)
        print("TESTING LIVE ENDPOINTS")
        print("="*50)
        
        self.run_test("Get Live Tables", "GET", "live/tables", 200)
        self.run_test("Get Live Matches", "GET", "live/matches", 200)

    def test_notification_operations(self):
        """Test notification operations"""
        print("\n" + "="*50)
        print("TESTING NOTIFICATION OPERATIONS")
        print("="*50)
        
        if self.created_ids['players']:
            player_id = self.created_ids['players'][0]
            
            # Create player notification
            notification_data = {"player_id": player_id}
            success, response = self.run_test("Create Player Notification", "POST", "player-notifications", 201, notification_data)
            
            # Get player notifications
            self.run_test("Get Player Notifications", "GET", "player-notifications", 200)
            
            # Create notification
            notif_data = {
                "player_id": player_id,
                "type": "match_created",
                "title": "Nouveau match",
                "message": "Votre match a été créé"
            }
            success, response = self.run_test("Create Notification", "POST", "notifications", 201, notif_data)
            if success and 'id' in response:
                self.created_ids['notifications'].append(response['id'])
            
            # Get notifications for player
            self.run_test("Get Player Notifications List", "GET", f"notifications/{player_id}", 200)

    def test_fftt_integration(self):
        """Test FFTT license lookup integration (key feature)"""
        print("\n" + "="*50)
        print("TESTING FFTT INTEGRATION")
        print("="*50)
        
        # Test valid license numbers (mock data)
        valid_licenses = ["3421810", "1234567", "9876543"]
        for license_num in valid_licenses:
            success, response = self.run_test(f"FFTT Lookup - Valid License {license_num}", "GET", f"fftt/lookup/{license_num}", 200)
            if success:
                # Validate response structure
                if 'success' in response and response['success']:
                    print(f"   ✅ Valid response structure for {license_num}")
                    if 'data' in response and response['data']:
                        data = response['data']
                        required_fields = ['licence', 'nom', 'prenom', 'points_init', 'point', '_virtual']
                        missing_fields = [field for field in required_fields if field not in data]
                        if not missing_fields:
                            print(f"   ✅ All required fields present: {list(data.keys())}")
                        else:
                            print(f"   ❌ Missing fields: {missing_fields}")
                    else:
                        print(f"   ❌ No data field in response")
                else:
                    print(f"   ❌ Success field is False or missing")
        
        # Test invalid license numbers
        invalid_licenses = ["0000000", "invalid", "999999999"]
        for license_num in invalid_licenses:
            success, response = self.run_test(f"FFTT Lookup - Invalid License {license_num}", "GET", f"fftt/lookup/{license_num}", 200)
            if success:
                # Should return success=False with error message
                if 'success' in response and not response['success']:
                    print(f"   ✅ Correctly handled invalid license {license_num}")
                    if 'error' in response and response['error']:
                        print(f"   ✅ Error message provided: {response['error']}")
                    else:
                        print(f"   ❌ No error message provided")
                else:
                    print(f"   ❌ Should return success=False for invalid license")
        
        # Test empty/null license numbers
        empty_licenses = ["", " ", "null"]
        for license_num in empty_licenses:
            success, response = self.run_test(f"FFTT Lookup - Empty License '{license_num}'", "GET", f"fftt/lookup/{license_num}", 200)
            if success:
                if 'success' in response and not response['success']:
                    print(f"   ✅ Correctly handled empty license '{license_num}'")
                else:
                    print(f"   ❌ Should return success=False for empty license")
        
        # Test special characters
        special_licenses = ["123@456", "abc-def", "123/456"]
        for license_num in special_licenses:
            success, response = self.run_test(f"FFTT Lookup - Special Chars '{license_num}'", "GET", f"fftt/lookup/{license_num}", 200)
            if success:
                if 'success' in response and not response['success']:
                    print(f"   ✅ Correctly handled special characters '{license_num}'")
                else:
                    print(f"   ❌ Should return success=False for special characters")

    def validate_fftt_response_structure(self, response, license_num):
        """Validate FFTT response structure"""
        required_top_level = ['success', 'data', 'error']
        missing_top_level = [field for field in required_top_level if field not in response]
        
        if missing_top_level:
            print(f"   ❌ Missing top-level fields for {license_num}: {missing_top_level}")
            return False
        
        if response['success'] and response['data']:
            required_data_fields = ['licence', 'nom', 'prenom', 'points_init', 'point', '_virtual']
            missing_data_fields = [field for field in required_data_fields if field not in response['data']]
            
            if missing_data_fields:
                print(f"   ❌ Missing data fields for {license_num}: {missing_data_fields}")
                return False
            
            # Validate data types
            data = response['data']
            if not isinstance(data['licence'], str):
                print(f"   ❌ License should be string, got {type(data['licence'])}")
                return False
            
            if not isinstance(data['nom'], str) or not isinstance(data['prenom'], str):
                print(f"   ❌ Name fields should be strings")
                return False
            
            numeric_fields = ['points_init', 'point', '_virtual']
            for field in numeric_fields:
                if not isinstance(data[field], (int, float)):
                    print(f"   ❌ {field} should be numeric, got {type(data[field])}")
                    return False
        
        return True

    def test_deletion_endpoints_with_cascade(self):
        """Test new deletion endpoints with cascade functionality"""
        print("\n" + "="*50)
        print("TESTING DELETION ENDPOINTS WITH CASCADE")
        print("="*50)
        
        # Create test data for deletion tests
        tournament_data = {
            "name": "Tournament for Deletion Test",
            "description": "Will be deleted with cascade"
        }
        
        success, tournament_response = self.run_test("Create Tournament for Deletion", "POST", "tournaments", 201, tournament_data)
        if success and 'id' in tournament_response:
            deletion_tournament_id = tournament_response['id']
            
            # Create bracket for this tournament
            bracket_data = {
                "tournament_id": deletion_tournament_id,
                "name": "Bracket for Deletion",
                "category": "Test Category",
                "max_players": 16,
                "entry_fee": 10.0
            }
            
            success, bracket_response = self.run_test("Create Bracket for Deletion", "POST", "brackets", 201, bracket_data)
            if success and 'id' in bracket_response:
                deletion_bracket_id = bracket_response['id']
                
                # Create player and register to bracket
                player_data = {
                    "first_name": "Delete",
                    "last_name": "Test",
                    "email": "delete.test@test.com"
                }
                
                success, player_response = self.run_test("Create Player for Deletion Test", "POST", "players", 201, player_data)
                if success and 'id' in player_response:
                    deletion_player_id = player_response['id']
                    
                    # Register player to bracket
                    registration_data = {
                        "player_id": deletion_player_id,
                        "bracket_id": deletion_bracket_id,
                        "payment_status": "paid"
                    }
                    
                    success, reg_response = self.run_test("Create Registration for Deletion Test", "POST", "player-bracket-registrations", 201, registration_data)
                    if success and 'id' in reg_response:
                        deletion_registration_id = reg_response['id']
                        
                        # Verify registration exists
                        self.run_test("Verify Registration Exists", "GET", "player-bracket-registrations", 200, params={"bracket_id": deletion_bracket_id})
                        
                        # Test bracket deletion with cascade (should delete registrations)
                        success, _ = self.run_test("Delete Bracket with Cascade", "DELETE", f"brackets/{deletion_bracket_id}", 200)
                        if success:
                            # Verify registrations were deleted
                            success, reg_check = self.run_test("Verify Registrations Deleted", "GET", "player-bracket-registrations", 200, params={"bracket_id": deletion_bracket_id})
                            if success:
                                registrations = reg_check if isinstance(reg_check, list) else []
                                if len(registrations) == 0:
                                    print("   ✅ Registrations successfully deleted with bracket")
                                else:
                                    print(f"   ❌ {len(registrations)} registrations still exist after bracket deletion")
                            
                            # Verify bracket is deleted
                            self.run_test("Verify Bracket Deleted", "GET", f"brackets/{deletion_bracket_id}", 404)
                    
                    # Clean up player
                    self.run_test("Delete Test Player", "DELETE", f"players/{deletion_player_id}", 200)
                
                # Test tournament deletion with cascade (should delete remaining brackets)
                # Create another bracket to test tournament cascade
                bracket_data_2 = {
                    "tournament_id": deletion_tournament_id,
                    "name": "Second Bracket for Deletion",
                    "category": "Test Category 2",
                    "max_players": 8,
                    "entry_fee": 5.0
                }
                
                success, bracket_response_2 = self.run_test("Create Second Bracket for Tournament Deletion", "POST", "brackets", 201, bracket_data_2)
                if success and 'id' in bracket_response_2:
                    second_bracket_id = bracket_response_2['id']
                    
                    # Verify bracket exists
                    self.run_test("Verify Second Bracket Exists", "GET", f"brackets/{second_bracket_id}", 200)
                    
                    # Delete tournament with cascade
                    success, _ = self.run_test("Delete Tournament with Cascade", "DELETE", f"tournaments/{deletion_tournament_id}", 200)
                    if success:
                        # Verify brackets were deleted
                        self.run_test("Verify Second Bracket Deleted", "GET", f"brackets/{second_bracket_id}", 404)
                        
                        # Verify tournament is deleted
                        self.run_test("Verify Tournament Deleted", "GET", f"tournaments/{deletion_tournament_id}", 404)
                        
                        print("   ✅ Tournament deletion with cascade successful")
        
        # Test deletion of non-existent resources
        self.run_test("Delete Non-existent Tournament", "DELETE", "tournaments/non-existent-id", 404)
        self.run_test("Delete Non-existent Bracket", "DELETE", "brackets/non-existent-id", 404)

    def cleanup_test_data(self):
        """Clean up created test data"""
        print("\n" + "="*50)
        print("CLEANING UP TEST DATA")
        print("="*50)
        
        # Delete in reverse order of dependencies
        for item_id in self.created_ids.get('menu_items', []):
            self.run_test(f"Delete Menu Item", "DELETE", f"menu-items/{item_id}", 200)
        
        for section_id in self.created_ids.get('menu_sections', []):
            self.run_test(f"Delete Menu Section", "DELETE", f"menu-sections/{section_id}", 200)
        
        for table_id in self.created_ids.get('tables', []):
            self.run_test(f"Delete Table", "DELETE", f"tables/{table_id}", 200)
        
        for room_id in self.created_ids.get('rooms', []):
            self.run_test(f"Delete Room", "DELETE", f"rooms/{room_id}", 200)
        
        for player_id in self.created_ids.get('players', []):
            self.run_test(f"Delete Player", "DELETE", f"players/{player_id}", 200)

    def run_all_tests(self):
        """Run all API tests"""
        print("🚀 Starting Chelles TT Tournament API Tests")
        print(f"Base URL: {self.base_url}")
        print("="*60)
        
        # Basic endpoints
        self.test_root_endpoint()
        self.test_qr_code_endpoint()
        
        # Tournament and bracket operations (key features)
        self.test_tournament_and_bracket_operations()
        
        # CRUD operations
        self.test_player_operations()
        self.test_player_bracket_registration()
        
        # Test new deletion endpoints with cascade
        self.test_deletion_endpoints_with_cascade()
        
        self.test_room_operations()
        self.test_table_operations()
        self.test_match_operations()
        self.test_menu_operations()
        self.test_notification_operations()
        
        # Live endpoints
        self.test_live_endpoints()
        
        # FFTT Integration (key feature)
        self.test_fftt_integration()
        
        # Cleanup
        self.cleanup_test_data()
        
        # Print results
        print("\n" + "="*60)
        print("📊 TEST RESULTS")
        print("="*60)
        print(f"Tests run: {self.tests_run}")
        print(f"Tests passed: {self.tests_passed}")
        print(f"Tests failed: {self.tests_run - self.tests_passed}")
        print(f"Success rate: {(self.tests_passed/self.tests_run)*100:.1f}%")
        
        return 0 if self.tests_passed == self.tests_run else 1

def main():
    tester = ChellesTournamentAPITester()
    return tester.run_all_tests()

if __name__ == "__main__":
    sys.exit(main())