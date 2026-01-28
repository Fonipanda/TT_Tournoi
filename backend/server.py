from fastapi import FastAPI, APIRouter, HTTPException, Query
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict
import uuid
from datetime import datetime
from enum import Enum

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI(title="Chelles TT Tournament API", version="1.0.0")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Enums
class TableStatus(str, Enum):
    FREE = "free"
    OCCUPIED = "occupied"
    MAINTENANCE = "maintenance"

class MatchStatus(str, Enum):
    WAITING = "waiting"
    IN_PROGRESS = "in_progress"
    FINISHED = "finished"
    BLOCKED = "blocked"

class NotificationType(str, Enum):
    MATCH_CREATED = "match_created"
    MATCH_STARTED = "match_started"
    MATCH_BLOCKED = "match_blocked"
    MATCH_UNBLOCKED = "match_unblocked"
    TABLE_ASSIGNED = "table_assigned"

# Models
class Tournament(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    is_active: bool = True
    created_date: datetime = Field(default_factory=datetime.utcnow)

class TournamentCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None

class Bracket(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    tournament_id: str
    name: str = Field(..., min_length=1, max_length=100)  # ex: "Tableau A"
    category: str = Field(..., min_length=1, max_length=100)  # ex: "Nc à 799 pts"
    min_points: Optional[int] = Field(None, ge=0)
    max_points: Optional[int] = Field(None, ge=0)
    max_players: int = Field(default=16, ge=2, le=64)  # Nombre maximum de joueurs
    entry_fee: float = Field(default=0.0, ge=0)  # Frais d'inscription en euros
    is_active: bool = True
    created_date: datetime = Field(default_factory=datetime.utcnow)

class BracketCreate(BaseModel):
    tournament_id: str
    name: str = Field(..., min_length=1, max_length=100)
    category: str = Field(..., min_length=1, max_length=100)
    min_points: Optional[int] = Field(None, ge=0)
    max_points: Optional[int] = Field(None, ge=0)
    max_players: int = Field(default=16, ge=2, le=64)
    entry_fee: float = Field(default=0.0, ge=0)

class PlayerBracketRegistration(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    player_id: str
    bracket_id: str
    payment_method: Optional[str] = Field(None)  # "card", "on_site", "pending"
    payment_status: str = Field(default="pending")  # "pending", "paid", "cancelled"
    amount_paid: float = Field(default=0.0, ge=0)
    registration_date: datetime = Field(default_factory=datetime.utcnow)
    is_active: bool = True

class PlayerBracketRegistrationCreate(BaseModel):
    player_id: str
    bracket_id: str
    payment_method: Optional[str] = Field(None)
    payment_status: str = Field(default="pending")

class Player(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: str = Field(..., min_length=1, max_length=100)
    license_number: Optional[str] = Field(None, max_length=20)
    ranking: Optional[str] = Field(None, max_length=10)
    club: Optional[str] = Field(None, max_length=100)
    email: EmailStr
    phone: Optional[str] = Field(None, max_length=20)
    registration_date: datetime = Field(default_factory=datetime.utcnow)
    is_active: bool = True

class PlayerCreate(BaseModel):
    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: str = Field(..., min_length=1, max_length=100)
    license_number: Optional[str] = Field(None, max_length=20)
    ranking: Optional[str] = Field(None, max_length=10)
    club: Optional[str] = Field(None, max_length=100)
    email: EmailStr
    phone: Optional[str] = Field(None, max_length=20)

class Room(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    is_active: bool = True
    created_date: datetime = Field(default_factory=datetime.utcnow)

class RoomCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=500)

class Table(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    table_number: int = Field(..., ge=1)
    room_id: str
    status: TableStatus = TableStatus.FREE
    current_match_id: Optional[str] = None
    player1_id: Optional[str] = None
    player2_id: Optional[str] = None
    match_start_time: Optional[datetime] = None
    created_date: datetime = Field(default_factory=datetime.utcnow)

class TableCreate(BaseModel):
    table_number: int = Field(..., ge=1)
    room_id: str

class TableUpdate(BaseModel):
    status: Optional[TableStatus] = None
    current_match_id: Optional[str] = None
    player1_id: Optional[str] = None
    player2_id: Optional[str] = None

class Match(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    bracket_id: str  # Ajout du bracket_id
    player1_id: str
    player2_id: str
    table_id: Optional[str] = None
    status: MatchStatus = MatchStatus.WAITING
    score_player1: int = 0
    score_player2: int = 0
    sets_player1: int = 0  # Nombre de sets gagnés par le joueur 1
    sets_player2: int = 0  # Nombre de sets gagnés par le joueur 2
    winner_id: Optional[str] = None  # ID du gagnant
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    round_name: Optional[str] = Field(None, max_length=100)
    round_number: int = Field(default=1)  # Numéro du tour (1er tour, 2ème tour, etc.)
    next_match_id: Optional[str] = None  # ID du match suivant pour le gagnant
    created_date: datetime = Field(default_factory=datetime.utcnow)

class MatchCreate(BaseModel):
    bracket_id: str
    player1_id: str
    player2_id: str
    round_name: Optional[str] = Field(None, max_length=100)
    round_number: int = Field(default=1)

class MatchUpdate(BaseModel):
    table_id: Optional[str] = None
    status: Optional[MatchStatus] = None
    score_player1: Optional[int] = None
    score_player2: Optional[int] = None
    sets_player1: Optional[int] = None
    sets_player2: Optional[int] = None

class MatchFinish(BaseModel):
    score_player1: int = Field(..., ge=0)
    score_player2: int = Field(..., ge=0)
    sets_player1: int = Field(..., ge=0, le=7)  # Maximum 7 sets
    sets_player2: int = Field(..., ge=0, le=7)

class MenuSection(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str = Field(..., min_length=1, max_length=100)
    order: int = Field(default=0)

class MenuSectionCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    order: int = Field(default=0)

class MenuItem(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    section_id: str
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=300)
    price: float = Field(..., ge=0)
    image_url: Optional[str] = Field(None, max_length=500)
    is_available: bool = True
    order: int = Field(default=0)

class MenuItemCreate(BaseModel):
    section_id: str
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=300)
    price: float = Field(..., ge=0)
    image_url: Optional[str] = Field(None, max_length=500)
    order: int = Field(default=0)

class PlayerNotification(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    player_id: str
    enabled: bool = True
    created_date: datetime = Field(default_factory=datetime.utcnow)

class PlayerNotificationCreate(BaseModel):
    player_id: str

class Notification(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    player_id: str
    type: NotificationType
    title: str = Field(..., max_length=200)
    message: str = Field(..., max_length=500)
    is_read: bool = False
    created_date: datetime = Field(default_factory=datetime.utcnow)

class NotificationCreate(BaseModel):
    player_id: str
    type: NotificationType
    title: str = Field(..., max_length=200)
    message: str = Field(..., max_length=500)

# Helper functions
async def get_player_by_id(player_id: str) -> Optional[Player]:
    player_data = await db.players.find_one({"id": player_id})
    return Player(**player_data) if player_data else None

async def get_room_by_id(room_id: str) -> Optional[Room]:
    room_data = await db.rooms.find_one({"id": room_id})
    return Room(**room_data) if room_data else None

# API Routes

# Test route
@api_router.get("/")
async def root():
    return {"message": "Chelles TT Tournament API v1.0.0"}

# Tournaments
@api_router.post("/tournaments", response_model=Tournament, status_code=201)
async def create_tournament(tournament_data: TournamentCreate):
    tournament = Tournament(**tournament_data.dict())
    await db.tournaments.insert_one(tournament.dict())
    return tournament

@api_router.get("/tournaments", response_model=List[Tournament])
async def get_tournaments():
    tournaments = await db.tournaments.find({"is_active": True}).to_list(length=100)
    return [Tournament(**tournament) for tournament in tournaments]

@api_router.get("/tournaments/{tournament_id}", response_model=Tournament)
async def get_tournament(tournament_id: str):
    tournament_data = await db.tournaments.find_one({"id": tournament_id})
    if not tournament_data:
        raise HTTPException(status_code=404, detail="Tournament not found")
    return Tournament(**tournament_data)

@api_router.put("/tournaments/{tournament_id}", response_model=Tournament)
async def update_tournament(tournament_id: str, tournament_data: TournamentCreate):
    """Update tournament information"""
    # Check if tournament exists
    existing_tournament = await db.tournaments.find_one({"id": tournament_id})
    if not existing_tournament:
        raise HTTPException(status_code=404, detail="Tournament not found")
    
    # Update tournament
    update_data = tournament_data.dict()
    update_data["updated_date"] = datetime.utcnow()
    
    await db.tournaments.update_one(
        {"id": tournament_id},
        {"$set": update_data}
    )
    
    # Return updated tournament
    updated_tournament = await db.tournaments.find_one({"id": tournament_id})
    return Tournament(**updated_tournament)

@api_router.delete("/tournaments/{tournament_id}")
async def delete_tournament(tournament_id: str):
    """Delete a tournament and all associated brackets"""
    # Check if tournament exists
    tournament = await db.tournaments.find_one({"id": tournament_id})
    if not tournament:
        raise HTTPException(status_code=404, detail="Tournament not found")
    
    # Delete all brackets associated with this tournament
    await db.brackets.delete_many({"tournament_id": tournament_id})
    
    # Delete the tournament
    result = await db.tournaments.delete_one({"id": tournament_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Tournament not found")
    
    return {"message": "Tournament and associated brackets deleted successfully"}

# Brackets
@api_router.post("/brackets", response_model=Bracket, status_code=201)
async def create_bracket(bracket_data: BracketCreate):
    # Verify tournament exists
    tournament = await db.tournaments.find_one({"id": bracket_data.tournament_id})
    if not tournament:
        raise HTTPException(status_code=404, detail="Tournament not found")
    
    bracket = Bracket(**bracket_data.dict())
    await db.brackets.insert_one(bracket.dict())
    return bracket

@api_router.get("/brackets", response_model=List[Bracket])
async def get_brackets(tournament_id: Optional[str] = None):
    query = {"is_active": True}
    if tournament_id:
        query["tournament_id"] = tournament_id
    
    brackets = await db.brackets.find(query).to_list(length=100)
    return [Bracket(**bracket) for bracket in brackets]

@api_router.get("/brackets/{bracket_id}", response_model=Bracket)
async def get_bracket(bracket_id: str):
    bracket_data = await db.brackets.find_one({"id": bracket_id})
    if not bracket_data:
        raise HTTPException(status_code=404, detail="Bracket not found")
    return Bracket(**bracket_data)

@api_router.put("/brackets/{bracket_id}", response_model=Bracket)
async def update_bracket(bracket_id: str, bracket_data: BracketCreate):
    """Update bracket information"""
    # Check if bracket exists
    existing_bracket = await db.brackets.find_one({"id": bracket_id})
    if not existing_bracket:
        raise HTTPException(status_code=404, detail="Bracket not found")
    
    # Update bracket
    update_data = bracket_data.dict()
    update_data["updated_date"] = datetime.utcnow()
    
    await db.brackets.update_one(
        {"id": bracket_id},
        {"$set": update_data}
    )
    
    # Return updated bracket
    updated_bracket = await db.brackets.find_one({"id": bracket_id})
    return Bracket(**updated_bracket)

@api_router.delete("/brackets/{bracket_id}")
async def delete_bracket(bracket_id: str):
    """Delete a bracket and all associated registrations"""
    # Check if bracket exists
    bracket = await db.brackets.find_one({"id": bracket_id})
    if not bracket:
        raise HTTPException(status_code=404, detail="Bracket not found")
    
    # Delete all player registrations for this bracket
    await db.player_bracket_registrations.delete_many({"bracket_id": bracket_id})
    
    # Delete the bracket
    result = await db.brackets.delete_one({"id": bracket_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Bracket not found")
    
    return {"message": "Bracket and associated registrations deleted successfully"}

# Endpoint pour obtenir les statistiques des brackets (joueurs inscrits)
@api_router.get("/brackets/{bracket_id}/stats")
async def get_bracket_stats(bracket_id: str):
    """Get bracket statistics including registered players count"""
    bracket = await db.brackets.find_one({"id": bracket_id})
    if not bracket:
        raise HTTPException(status_code=404, detail="Bracket not found")
    
    # Count registered players
    registered_count = await db.player_bracket_registrations.count_documents({
        "bracket_id": bracket_id,
        "is_active": True
    })
    
    max_players = bracket.get("max_players", 16)
    available_spots = max(0, max_players - registered_count)
    
    return {
        "bracket_id": bracket_id,
        "registered_players": registered_count,
        "max_players": max_players,
        "available_spots": available_spots,
        "is_full": available_spots == 0,
        "entry_fee": bracket.get("entry_fee", 0.0)
    }

# Player Bracket Registrations
@api_router.post("/player-bracket-registrations", response_model=PlayerBracketRegistration, status_code=201)
async def register_player_to_bracket(registration_data: PlayerBracketRegistrationCreate):
    # Verify player and bracket exist
    player = await db.players.find_one({"id": registration_data.player_id})
    bracket = await db.brackets.find_one({"id": registration_data.bracket_id})
    
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")
    if not bracket:
        raise HTTPException(status_code=404, detail="Bracket not found")
    
    # Check if already registered
    existing = await db.player_bracket_registrations.find_one({
        "player_id": registration_data.player_id,
        "bracket_id": registration_data.bracket_id,
        "is_active": True
    })
    if existing:
        raise HTTPException(status_code=400, detail="Player already registered in this bracket")
    
    # Check bracket capacity
    registered_count = await db.player_bracket_registrations.count_documents({
        "bracket_id": registration_data.bracket_id,
        "is_active": True
    })
    max_players = bracket.get("max_players", 16)
    if registered_count >= max_players:
        raise HTTPException(status_code=400, detail="Bracket is full")
    
    # Check player registration limit (max 2 tableaux)
    player_registrations = await db.player_bracket_registrations.count_documents({
        "player_id": registration_data.player_id,
        "is_active": True
    })
    if player_registrations >= 2:
        raise HTTPException(status_code=400, detail="Player cannot register for more than 2 brackets")
    
    # Calculate amount based on bracket entry fee
    entry_fee = bracket.get("entry_fee", 0.0)
    
    registration = PlayerBracketRegistration(
        **registration_data.dict(),
        amount_paid=entry_fee if registration_data.payment_status == "paid" else 0.0
    )
    await db.player_bracket_registrations.insert_one(registration.dict())
    return registration

# Endpoint pour calculer le total d'une inscription
@api_router.get("/players/{player_id}/registration-summary")
async def get_player_registration_summary(player_id: str):
    """Get player registration summary with total amount"""
    # Get all player registrations
    pipeline = [
        {
            "$match": {
                "player_id": player_id,
                "is_active": True
            }
        },
        {
            "$lookup": {
                "from": "brackets",
                "localField": "bracket_id",
                "foreignField": "id",
                "as": "bracket"
            }
        },
        {
            "$addFields": {
                "bracket": {"$arrayElemAt": ["$bracket", 0]}
            }
        }
    ]
    
    registrations = await db.player_bracket_registrations.aggregate(pipeline).to_list(length=10)
    
    total_amount = 0
    registration_details = []
    
    for reg in registrations:
        bracket = reg.get("bracket", {})
        entry_fee = bracket.get("entry_fee", 0.0)
        total_amount += entry_fee
        
        registration_details.append({
            "bracket_id": reg["bracket_id"],
            "bracket_name": bracket.get("name", ""),
            "bracket_category": bracket.get("category", ""),
            "entry_fee": entry_fee,
            "payment_status": reg.get("payment_status", "pending"),
            "registration_date": reg.get("registration_date")
        })
    
    return {
        "player_id": player_id,
        "registrations": registration_details,
        "total_amount": total_amount,
        "registration_count": len(registration_details)
    }

@api_router.get("/player-bracket-registrations", response_model=List[PlayerBracketRegistration])
async def get_player_bracket_registrations(player_id: Optional[str] = None, bracket_id: Optional[str] = None):
    query = {"is_active": True}
    if player_id:
        query["player_id"] = player_id
    if bracket_id:
        query["bracket_id"] = bracket_id
    
    registrations = await db.player_bracket_registrations.find(query).to_list(length=1000)
    return [PlayerBracketRegistration(**reg) for reg in registrations]

@api_router.get("/players/{player_id}/brackets")
async def get_player_brackets(player_id: str):
    """Get all brackets a player is registered in with bracket details"""
    pipeline = [
        {
            "$match": {
                "player_id": player_id,
                "is_active": True
            }
        },
        {
            "$lookup": {
                "from": "brackets",
                "localField": "bracket_id",
                "foreignField": "id",
                "as": "bracket"
            }
        },
        {
            "$lookup": {
                "from": "tournaments",
                "localField": "bracket.tournament_id",
                "foreignField": "id",
                "as": "tournament"
            }
        },
        {
            "$addFields": {
                "bracket": {"$arrayElemAt": ["$bracket", 0]},
                "tournament": {"$arrayElemAt": ["$tournament", 0]}
            }
        },
        {
            "$project": {
                "_id": 0,
                "registration_id": "$id",
                "registration_date": 1,
                "bracket.id": 1,
                "bracket.name": 1,
                "bracket.category": 1,
                "bracket.min_points": 1,
                "bracket.max_points": 1,
                "tournament.id": 1,
                "tournament.name": 1
            }
        }
    ]
    
    results = await db.player_bracket_registrations.aggregate(pipeline).to_list(length=100)
    return results

# Players (updated to include bracket registration)
@api_router.post("/players", response_model=Player, status_code=201)
async def create_player(player_data: PlayerCreate):
    player = Player(**player_data.dict())
    await db.players.insert_one(player.dict())
    return player

@api_router.get("/players", response_model=List[Player])
async def get_players(skip: int = 0, limit: int = 100, search: Optional[str] = None):
    query = {}
    if search:
        query["$or"] = [
            {"first_name": {"$regex": search, "$options": "i"}},
            {"last_name": {"$regex": search, "$options": "i"}},
            {"club": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}}
        ]
    
    players = await db.players.find(query).skip(skip).limit(limit).to_list(length=limit)
    return [Player(**player) for player in players]

@api_router.get("/players/search", response_model=List[Player])
async def search_players(email: str = None):
    """Search players by email"""
    if not email:
        raise HTTPException(status_code=400, detail="Email parameter is required")
    
    # Search by exact email match (case insensitive)
    players = await db.players.find({
        "email": {"$regex": f"^{email}$", "$options": "i"}
    }).to_list(length=10)
    
    return [Player(**player) for player in players]

@api_router.get("/players/{player_id}", response_model=Player)
async def get_player(player_id: str):
    player = await get_player_by_id(player_id)
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")
    return player

@api_router.put("/players/{player_id}", response_model=Player)
async def update_player(player_id: str, player_data: PlayerCreate):
    """Update player information"""
    # Check if player exists
    existing_player = await db.players.find_one({"id": player_id})
    if not existing_player:
        raise HTTPException(status_code=404, detail="Player not found")
    
    # Check if email is already used by another player
    if player_data.email != existing_player.get("email"):
        email_exists = await db.players.find_one({
            "email": player_data.email,
            "id": {"$ne": player_id}
        })
        if email_exists:
            raise HTTPException(status_code=400, detail="Email already registered")
    
    # Update player
    update_data = player_data.dict()
    update_data["updated_date"] = datetime.utcnow()
    
    await db.players.update_one(
        {"id": player_id},
        {"$set": update_data}
    )
    
    # Return updated player
    updated_player = await db.players.find_one({"id": player_id})
    return Player(**updated_player)

@api_router.delete("/players/{player_id}")
async def delete_player(player_id: str):
    """Delete a player and all associated registrations"""
    # Check if player exists
    player = await db.players.find_one({"id": player_id})
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")
    
    # Delete all player registrations
    await db.player_bracket_registrations.delete_many({"player_id": player_id})
    
    # Delete player from any matches (set to null)
    await db.matches.update_many(
        {"player1_id": player_id},
        {"$set": {"player1_id": None}}
    )
    await db.matches.update_many(
        {"player2_id": player_id},
        {"$set": {"player2_id": None}}
    )
    
    # Delete the player
    result = await db.players.delete_one({"id": player_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Player not found")
    
    return {"message": "Player and associated data deleted successfully"}



# Rooms
@api_router.post("/rooms", response_model=Room, status_code=201)
async def create_room(room_data: RoomCreate):
    room = Room(**room_data.dict())
    await db.rooms.insert_one(room.dict())
    return room

@api_router.get("/rooms", response_model=List[Room])
async def get_rooms():
    rooms = await db.rooms.find({"is_active": True}).to_list(length=100)
    return [Room(**room) for room in rooms]

@api_router.get("/rooms/{room_id}", response_model=Room)
async def get_room(room_id: str):
    room = await get_room_by_id(room_id)
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    return room

@api_router.put("/rooms/{room_id}", response_model=Room)
async def update_room(room_id: str, room_data: RoomCreate):
    existing_room = await get_room_by_id(room_id)
    if not existing_room:
        raise HTTPException(status_code=404, detail="Room not found")
    
    update_data = room_data.dict()
    await db.rooms.update_one({"id": room_id}, {"$set": update_data})
    
    updated_room_data = await db.rooms.find_one({"id": room_id})
    return Room(**updated_room_data)

@api_router.put("/rooms/{room_id}", response_model=Room)
async def update_room(room_id: str, room_data: RoomCreate):
    """Update room information"""
    # Check if room exists
    existing_room = await db.rooms.find_one({"id": room_id})
    if not existing_room:
        raise HTTPException(status_code=404, detail="Room not found")
    
    # Update room
    update_data = room_data.dict()
    update_data["updated_date"] = datetime.utcnow()
    
    await db.rooms.update_one(
        {"id": room_id},
        {"$set": update_data}
    )
    
    # Return updated room
    updated_room = await db.rooms.find_one({"id": room_id})
    return Room(**updated_room)

@api_router.delete("/rooms/{room_id}")
async def delete_room(room_id: str):
    # Check if room has active tables
    table_count = await db.tables.count_documents({"room_id": room_id})
    if table_count > 0:
        raise HTTPException(status_code=400, detail="Cannot delete room with existing tables")
    
    result = await db.rooms.delete_one({"id": room_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Room not found")
    return {"message": "Room deleted successfully"}

# Tables
@api_router.post("/tables", response_model=Table, status_code=201)
async def create_table(table_data: TableCreate):
    # Verify room exists
    room = await get_room_by_id(table_data.room_id)
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    
    # Check if table number already exists in this room
    existing_table = await db.tables.find_one({
        "room_id": table_data.room_id,
        "table_number": table_data.table_number
    })
    if existing_table:
        raise HTTPException(status_code=400, detail="Table number already exists in this room")
    
    table = Table(**table_data.dict())
    await db.tables.insert_one(table.dict())
    return table

@api_router.get("/tables", response_model=List[Table])
async def get_tables(room_id: Optional[str] = None):
    query = {}
    if room_id:
        query["room_id"] = room_id
    
    tables = await db.tables.find(query).sort("table_number", 1).to_list(length=1000)
    return [Table(**table) for table in tables]

@api_router.get("/tables/{table_id}", response_model=Table)
async def get_table(table_id: str):
    table_data = await db.tables.find_one({"id": table_id})
    if not table_data:
        raise HTTPException(status_code=404, detail="Table not found")
    return Table(**table_data)

@api_router.put("/tables/{table_id}", response_model=Table)
async def update_table(table_id: str, table_data: TableUpdate):
    existing_table = await db.tables.find_one({"id": table_id})
    if not existing_table:
        raise HTTPException(status_code=404, detail="Table not found")
    
    update_data = {k: v for k, v in table_data.dict().items() if v is not None}
    
    # Update match start time if status changes to occupied
    if table_data.status == TableStatus.OCCUPIED and existing_table["status"] != TableStatus.OCCUPIED:
        update_data["match_start_time"] = datetime.utcnow()
    elif table_data.status == TableStatus.FREE:
        update_data["match_start_time"] = None
        update_data["current_match_id"] = None
        update_data["player1_id"] = None
        update_data["player2_id"] = None
    
    await db.tables.update_one({"id": table_id}, {"$set": update_data})
    
    updated_table_data = await db.tables.find_one({"id": table_id})
    return Table(**updated_table_data)

@api_router.delete("/tables/{table_id}")
async def delete_table(table_id: str):
    result = await db.tables.delete_one({"id": table_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Table not found")
    return {"message": "Table deleted successfully"}

# Matches
@api_router.post("/matches", response_model=Match, status_code=201)
async def create_match(match_data: MatchCreate):
    # Verify players and bracket exist
    player1 = await get_player_by_id(match_data.player1_id)
    player2 = await get_player_by_id(match_data.player2_id)
    bracket = await db.brackets.find_one({"id": match_data.bracket_id})
    
    if not player1 or not player2:
        raise HTTPException(status_code=404, detail="One or both players not found")
    if not bracket:
        raise HTTPException(status_code=404, detail="Bracket not found")
    
    match = Match(**match_data.dict())
    await db.matches.insert_one(match.dict())
    return match

@api_router.get("/matches", response_model=List[Match])
async def get_matches(skip: int = 0, limit: int = 100, status: Optional[MatchStatus] = None, bracket_id: Optional[str] = None):
    query = {}
    if status:
        query["status"] = status
    if bracket_id:
        query["bracket_id"] = bracket_id
    
    matches_data = await db.matches.find(query).skip(skip).limit(limit).sort("created_date", -1).to_list(length=limit)
    
    # Handle legacy matches without bracket_id by adding a default bracket
    processed_matches = []
    for match_data in matches_data:
        try:
            # Ensure bracket_id exists for validation
            if "bracket_id" not in match_data or not match_data["bracket_id"]:
                # Get any available bracket as fallback
                first_bracket = await db.brackets.find_one({})
                if first_bracket:
                    match_data["bracket_id"] = first_bracket["id"]
                else:
                    # Skip this match if no brackets exist
                    continue
            
            # Ensure required fields exist with defaults
            match_data.setdefault("sets_player1", 0)
            match_data.setdefault("sets_player2", 0)
            match_data.setdefault("winner_id", None)
            match_data.setdefault("round_number", 1)
            match_data.setdefault("next_match_id", None)
            
            processed_matches.append(Match(**match_data))
        except Exception as e:
            print(f"Error processing match {match_data.get('id', 'unknown')}: {e}")
            continue
    
    return processed_matches

@api_router.get("/matches/{match_id}", response_model=Match)
async def get_match(match_id: str):
    match_data = await db.matches.find_one({"id": match_id})
    if not match_data:
        raise HTTPException(status_code=404, detail="Match not found")
    return Match(**match_data)

@api_router.delete("/matches/{match_id}")
async def delete_match(match_id: str):
    """Delete a match"""
    # Check if match exists
    match = await db.matches.find_one({"id": match_id})
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")
    
    # If match has a table assigned, free the table
    if match.get("table_id"):
        await db.tables.update_one(
            {"id": match["table_id"]},
            {"$set": {"status": "free", "player1_id": None, "player2_id": None}}
        )
    
    # Delete the match
    result = await db.matches.delete_one({"id": match_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Match not found")
    
    return {"message": "Match deleted successfully"}

@api_router.put("/matches/{match_id}", response_model=Match)
async def update_match(match_id: str, match_data: MatchUpdate):
    existing_match = await db.matches.find_one({"id": match_id})
    if not existing_match:
        raise HTTPException(status_code=404, detail="Match not found")
    
    update_data = {k: v for k, v in match_data.dict().items() if v is not None}
    
    # Update timestamps based on status changes
    if match_data.status == MatchStatus.IN_PROGRESS and existing_match["status"] != MatchStatus.IN_PROGRESS:
        update_data["start_time"] = datetime.utcnow()
    elif match_data.status == MatchStatus.FINISHED and existing_match["status"] != MatchStatus.FINISHED:
        update_data["end_time"] = datetime.utcnow()
        
        # Determine winner based on sets
        if update_data.get("sets_player1", existing_match.get("sets_player1", 0)) > update_data.get("sets_player2", existing_match.get("sets_player2", 0)):
            update_data["winner_id"] = existing_match["player1_id"]
        elif update_data.get("sets_player2", existing_match.get("sets_player2", 0)) > update_data.get("sets_player1", existing_match.get("sets_player1", 0)):
            update_data["winner_id"] = existing_match["player2_id"]
    
    await db.matches.update_one({"id": match_id}, {"$set": update_data})
    
    updated_match_data = await db.matches.find_one({"id": match_id})
    return Match(**updated_match_data)

@api_router.put("/matches/{match_id}/finish")
async def finish_match(match_id: str, match_result: MatchFinish):
    """Finish a match with final score and automatically free the table"""
    existing_match = await db.matches.find_one({"id": match_id})
    if not existing_match:
        raise HTTPException(status_code=404, detail="Match not found")
    
    if existing_match["status"] == "finished":
        raise HTTPException(status_code=400, detail="Match is already finished")
    
    # Determine winner based on sets won
    winner_id = None
    if match_result.sets_player1 > match_result.sets_player2:
        winner_id = existing_match["player1_id"]
    elif match_result.sets_player2 > match_result.sets_player1:
        winner_id = existing_match["player2_id"]
    else:
        raise HTTPException(status_code=400, detail="Match cannot end in a tie")
    
    # Update match
    update_data = {
        "status": "finished",
        "score_player1": match_result.score_player1,
        "score_player2": match_result.score_player2,
        "sets_player1": match_result.sets_player1,
        "sets_player2": match_result.sets_player2,
        "winner_id": winner_id,
        "end_time": datetime.utcnow()
    }
    
    await db.matches.update_one({"id": match_id}, {"$set": update_data})
    
    # Free the table if assigned
    if existing_match.get("table_id"):
        await db.tables.update_one(
            {"id": existing_match["table_id"]},
            {
                "$set": {
                    "status": "free",
                    "current_match_id": None,
                    "player1_id": None,
                    "player2_id": None,
                    "match_start_time": None
                }
            }
        )
    
    updated_match_data = await db.matches.find_one({"id": match_id})
    return {"message": "Match finished successfully", "match": Match(**updated_match_data)}

# Menu sections endpoints
@api_router.put("/menu-sections/{section_id}", response_model=MenuSection)
async def update_menu_section(section_id: str, section_data: MenuSectionCreate):
    """Update menu section information"""
    existing_section = await db.menu_sections.find_one({"id": section_id})
    if not existing_section:
        raise HTTPException(status_code=404, detail="Menu section not found")
    
    update_data = section_data.dict()
    await db.menu_sections.update_one(
        {"id": section_id},
        {"$set": update_data}
    )
    
    updated_section = await db.menu_sections.find_one({"id": section_id})
    return MenuSection(**updated_section)

@api_router.delete("/menu-sections/{section_id}")
async def delete_menu_section(section_id: str):
    """Delete a menu section and all associated items"""
    section = await db.menu_sections.find_one({"id": section_id})
    if not section:
        raise HTTPException(status_code=404, detail="Menu section not found")
    
    # Delete all items in this section
    await db.menu_items.delete_many({"section_id": section_id})
    
    # Delete the section
    result = await db.menu_sections.delete_one({"id": section_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Menu section not found")
    
    return {"message": "Menu section and associated items deleted successfully"}

# Menu items endpoints  
@api_router.put("/menu-items/{item_id}", response_model=MenuItem)
async def update_menu_item(item_id: str, item_data: MenuItemCreate):
    """Update menu item information"""
    existing_item = await db.menu_items.find_one({"id": item_id})
    if not existing_item:
        raise HTTPException(status_code=404, detail="Menu item not found")
    
    update_data = item_data.dict()
    await db.menu_items.update_one(
        {"id": item_id},
        {"$set": update_data}
    )
    
    updated_item = await db.menu_items.find_one({"id": item_id})
    return MenuItem(**updated_item)

@api_router.delete("/menu-items/{item_id}")
async def delete_menu_item(item_id: str):
    """Delete a menu item"""
    item = await db.menu_items.find_one({"id": item_id})
    if not item:
        raise HTTPException(status_code=404, detail="Menu item not found")
    
    result = await db.menu_items.delete_one({"id": item_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Menu item not found")
    
    return {"message": "Menu item deleted successfully"}
@api_router.post("/menu-sections", response_model=MenuSection, status_code=201)
async def create_menu_section(section_data: MenuSectionCreate):
    section = MenuSection(**section_data.dict())
    await db.menu_sections.insert_one(section.dict())
    return section

@api_router.get("/menu-sections", response_model=List[MenuSection])
async def get_menu_sections():
    sections = await db.menu_sections.find().sort("order", 1).to_list(length=100)
    return [MenuSection(**section) for section in sections]

@api_router.put("/menu-sections/{section_id}", response_model=MenuSection)
async def update_menu_section(section_id: str, section_data: MenuSectionCreate):
    result = await db.menu_sections.update_one(
        {"id": section_id},
        {"$set": section_data.dict()}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Menu section not found")
    
    updated_section = await db.menu_sections.find_one({"id": section_id})
    return MenuSection(**updated_section)

@api_router.delete("/menu-sections/{section_id}")
async def delete_menu_section(section_id: str):
    # Check if section has menu items
    item_count = await db.menu_items.count_documents({"section_id": section_id})
    if item_count > 0:
        raise HTTPException(status_code=400, detail="Cannot delete section with menu items")
    
    result = await db.menu_sections.delete_one({"id": section_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Menu section not found")
    return {"message": "Menu section deleted successfully"}

# Menu items
@api_router.post("/menu-items", response_model=MenuItem, status_code=201)
async def create_menu_item(item_data: MenuItemCreate):
    # Verify section exists
    section = await db.menu_sections.find_one({"id": item_data.section_id})
    if not section:
        raise HTTPException(status_code=404, detail="Menu section not found")
    
    item = MenuItem(**item_data.dict())
    await db.menu_items.insert_one(item.dict())
    return item

@api_router.get("/menu-items", response_model=List[MenuItem])
async def get_menu_items(section_id: Optional[str] = None):
    query = {}
    if section_id:
        query["section_id"] = section_id
    
    items = await db.menu_items.find(query).sort("order", 1).to_list(length=1000)
    return [MenuItem(**item) for item in items]

@api_router.put("/menu-items/{item_id}", response_model=MenuItem)
async def update_menu_item(item_id: str, item_data: MenuItemCreate):
    result = await db.menu_items.update_one(
        {"id": item_id},
        {"$set": item_data.dict()}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Menu item not found")
    
    updated_item = await db.menu_items.find_one({"id": item_id})
    return MenuItem(**updated_item)

@api_router.delete("/menu-items/{item_id}")
async def delete_menu_item(item_id: str):
    result = await db.menu_items.delete_one({"id": item_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Menu item not found")
    return {"message": "Menu item deleted successfully"}

# Player notifications
@api_router.post("/player-notifications", response_model=PlayerNotification, status_code=201)
async def create_player_notification(notification_data: PlayerNotificationCreate):
    # Verify player exists
    player = await get_player_by_id(notification_data.player_id)
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")
    
    # Check if notification already exists
    existing = await db.player_notifications.find_one({"player_id": notification_data.player_id})
    if existing:
        raise HTTPException(status_code=400, detail="Player notification already exists")
    
    notification = PlayerNotification(**notification_data.dict())
    await db.player_notifications.insert_one(notification.dict())
    return notification

@api_router.get("/player-notifications", response_model=List[PlayerNotification])
async def get_player_notifications():
    notifications = await db.player_notifications.find().to_list(length=1000)
    return [PlayerNotification(**notification) for notification in notifications]

@api_router.get("/player-notifications/{player_id}", response_model=PlayerNotification)
async def get_player_notification(player_id: str):
    notification_data = await db.player_notifications.find_one({"player_id": player_id})
    if not notification_data:
        raise HTTPException(status_code=404, detail="Player notification not found")
    return PlayerNotification(**notification_data)

@api_router.put("/player-notifications/{notification_id}")
async def update_player_notification(notification_id: str, enabled: bool = True):
    notification = await db.player_notifications.find_one({"id": notification_id})
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    await db.player_notifications.update_one(
        {"id": notification_id},
        {"$set": {"enabled": enabled}}
    )
    return {"message": "Notification settings updated"}

@api_router.delete("/player-notifications/{notification_id}")
async def delete_player_notification(notification_id: str):
    """Delete a player notification subscription"""
    notification = await db.player_notifications.find_one({"id": notification_id})
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    result = await db.player_notifications.delete_one({"id": notification_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    return {"message": "Notification subscription deleted"}

# Notifications
@api_router.post("/notifications", response_model=Notification, status_code=201)
async def create_notification(notification_data: NotificationCreate):
    notification = Notification(**notification_data.dict())
    await db.notifications.insert_one(notification.dict())
    return notification

@api_router.get("/notifications/{player_id}", response_model=List[Notification])
async def get_player_notifications_list(player_id: str):
    notifications = await db.notifications.find(
        {"player_id": player_id}
    ).sort("created_date", -1).to_list(length=100)
    return [Notification(**notification) for notification in notifications]

@api_router.put("/notifications/{notification_id}/read")
async def mark_notification_read(notification_id: str):
    result = await db.notifications.update_one(
        {"id": notification_id},
        {"$set": {"is_read": True}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"message": "Notification marked as read"}

# Live data endpoints
@api_router.get("/live/tables")
async def get_live_tables():
    """Get all tables with current players information"""
    pipeline = [
        {
            "$lookup": {
                "from": "rooms",
                "localField": "room_id",
                "foreignField": "id",
                "as": "room"
            }
        },
        {
            "$lookup": {
                "from": "players",
                "localField": "player1_id",
                "foreignField": "id",
                "as": "player1"
            }
        },
        {
            "$lookup": {
                "from": "players",
                "localField": "player2_id",
                "foreignField": "id",
                "as": "player2"
            }
        },
        {
            "$addFields": {
                "room": {"$arrayElemAt": ["$room", 0]},
                "player1": {"$arrayElemAt": ["$player1", 0]},
                "player2": {"$arrayElemAt": ["$player2", 0]}
            }
        },
        {
            "$project": {
                "_id": 0,  # Exclude MongoDB ObjectId
                "id": 1,
                "table_number": 1,
                "room_id": 1,
                "status": 1,
                "current_match_id": 1,
                "player1_id": 1,
                "player2_id": 1,
                "match_start_time": 1,
                "created_date": 1,
                "room.id": 1,
                "room.name": 1,
                "room.description": 1,
                "player1.id": 1,
                "player1.first_name": 1,
                "player1.last_name": 1,
                "player1.ranking": 1,
                "player1.club": 1,
                "player2.id": 1,
                "player2.first_name": 1,
                "player2.last_name": 1,
                "player2.ranking": 1,
                "player2.club": 1
            }
        }
    ]
    
    tables = await db.tables.aggregate(pipeline).to_list(length=1000)
    return tables

@api_router.get("/live/matches")
async def get_live_matches():
    """Get currently active matches with player and table information"""
    try:
        pipeline = [
            {
                "$match": {
                    "status": {"$in": ["in_progress", "waiting"]}
                }
            },
            {
                "$lookup": {
                    "from": "players",
                    "localField": "player1_id",
                    "foreignField": "id",
                    "as": "player1"
                }
            },
            {
                "$lookup": {
                    "from": "players",
                    "localField": "player2_id",
                    "foreignField": "id",
                    "as": "player2"
                }
            },
            {
                "$lookup": {
                    "from": "tables",
                    "localField": "table_id",
                    "foreignField": "id",
                    "as": "table"
                }
            },
            {
                "$addFields": {
                    "player1": {"$arrayElemAt": ["$player1", 0]},
                    "player2": {"$arrayElemAt": ["$player2", 0]},
                    "table": {"$arrayElemAt": ["$table", 0]}
                }
            },
            {
                "$project": {
                    "_id": 0,  # Exclude MongoDB ObjectId
                    "id": 1,
                    "bracket_id": {"$ifNull": ["$bracket_id", ""]},
                    "player1_id": 1,
                    "player2_id": 1,
                    "table_id": 1,
                    "status": 1,
                    "score_player1": {"$ifNull": ["$score_player1", 0]},
                    "score_player2": {"$ifNull": ["$score_player2", 0]},
                    "sets_player1": {"$ifNull": ["$sets_player1", 0]},
                    "sets_player2": {"$ifNull": ["$sets_player2", 0]},
                    "winner_id": 1,
                    "start_time": 1,
                    "end_time": 1,
                    "round_name": 1,
                    "round_number": {"$ifNull": ["$round_number", 1]},
                    "next_match_id": 1,
                    "created_date": 1,
                    "player1": 1,
                    "player2": 1,
                    "table": 1
                }
            }
        ]
        
        matches = await db.matches.aggregate(pipeline).to_list(length=1000)
        return matches
    except Exception as e:
        print(f"Error in get_live_matches: {e}")
        return []

# Match Assignment endpoint
@api_router.put("/matches/{match_id}/assign-table")
async def assign_match_to_table(match_id: str, table_id: str):
    """Assign a match to a table and update statuses"""
    # Verify match exists
    match = await db.matches.find_one({"id": match_id})
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")
    
    # Verify table exists and is free
    table = await db.tables.find_one({"id": table_id})
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")
    
    if table["status"] != "free":
        raise HTTPException(status_code=400, detail="Table is not available")
    
    # Update match with table assignment
    await db.matches.update_one(
        {"id": match_id},
        {
            "$set": {
                "table_id": table_id,
                "status": "in_progress",
                "start_time": datetime.utcnow()
            }
        }
    )
    
    # Update table status to occupied
    await db.tables.update_one(
        {"id": table_id},
        {
            "$set": {
                "status": "occupied",
                "current_match_id": match_id,
                "player1_id": match["player1_id"],
                "player2_id": match["player2_id"],
                "match_start_time": datetime.utcnow()
            }
        }
    )
    
    return {"message": "Match assigned to table successfully"}

# QR Code endpoint
@api_router.get("/qr-code")
async def get_qr_code_url():
    """Return the base URL for QR code generation"""
    base_url = os.environ.get('FRONTEND_URL', 'https://match-tracker-109.preview.emergentagent.com')
    return {"url": base_url, "message": "Use this URL to generate QR code"}

# FFTT License Lookup
class FFTTPlayerData(BaseModel):
    success: bool
    data: Optional[Dict] = None
    error: Optional[str] = None

@api_router.get("/fftt/lookup/{license_number}", response_model=FFTTPlayerData)
async def lookup_fftt_player(license_number: str):
    """Lookup player information from FFTT using license number"""
    try:
        import subprocess
        import json
        
        # Call the Rust service with libfftt
        rust_service_path = "/app/fftt-service/target/release/fftt-service"
        
        result = subprocess.run(
            [rust_service_path, license_number.strip()],
            capture_output=True,
            text=True,
            timeout=30
        )
        
        if result.returncode == 0:
            # Parse the JSON response from Rust service
            response_data = json.loads(result.stdout)
            return FFTTPlayerData(**response_data)
        else:
            # Handle error from Rust service
            if result.stdout:
                try:
                    error_data = json.loads(result.stdout)
                    return FFTTPlayerData(**error_data)
                except:
                    pass
            
            return FFTTPlayerData(
                success=False,
                data=None,
                error=f"Aucun joueur trouvé avec le numéro de licence {license_number}"
            )
            
    except subprocess.TimeoutExpired:
        logger.error(f"Timeout looking up FFTT player {license_number}")
        return FFTTPlayerData(
            success=False,
            data=None,
            error="Délai d'attente dépassé lors de la recherche"
        )
    except Exception as e:
        logger.error(f"Error looking up FFTT player {license_number}: {e}")
        return FFTTPlayerData(
            success=False,
            data=None,
            error="Erreur lors de la recherche des informations du joueur"
        )

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()