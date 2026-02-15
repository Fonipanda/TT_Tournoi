from rest_framework import serializers
from .models import (
    Tournament, Bracket, Player, PlayerBracketRegistration,
    Room, Table, Match, MenuSection, MenuItem,
    PlayerNotificationSubscription, Notification, UserAccount
)


class TournamentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tournament
        fields = '__all__'


class BracketSerializer(serializers.ModelSerializer):
    tournament_name = serializers.CharField(source='tournament.name', read_only=True)
    registered_count = serializers.SerializerMethodField()
    
    class Meta:
        model = Bracket
        fields = '__all__'
    
    def get_registered_count(self, obj):
        return obj.registrations.filter(is_active=True).count()


class PlayerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Player
        fields = '__all__'


class PlayerBracketRegistrationSerializer(serializers.ModelSerializer):
    player_name = serializers.SerializerMethodField()
    bracket_name = serializers.CharField(source='bracket.name', read_only=True)
    bracket_category = serializers.CharField(source='bracket.category', read_only=True)
    entry_fee = serializers.DecimalField(source='bracket.entry_fee', max_digits=6, decimal_places=2, read_only=True)
    
    class Meta:
        model = PlayerBracketRegistration
        fields = '__all__'
    
    def get_player_name(self, obj):
        return f"{obj.player.last_name} {obj.player.first_name}"


class RoomSerializer(serializers.ModelSerializer):
    class Meta:
        model = Room
        fields = '__all__'


class TableSerializer(serializers.ModelSerializer):
    room_name = serializers.CharField(source='room.name', read_only=True)
    player1_name = serializers.SerializerMethodField()
    player2_name = serializers.SerializerMethodField()
    
    class Meta:
        model = Table
        fields = '__all__'
    
    def get_player1_name(self, obj):
        if obj.player1:
            return f"{obj.player1.last_name} {obj.player1.first_name}"
        return None
    
    def get_player2_name(self, obj):
        if obj.player2:
            return f"{obj.player2.last_name} {obj.player2.first_name}"
        return None


class MatchSerializer(serializers.ModelSerializer):
    player1_name = serializers.SerializerMethodField()
    player2_name = serializers.SerializerMethodField()
    player1_club = serializers.SerializerMethodField()
    player2_club = serializers.SerializerMethodField()
    player1_ranking = serializers.SerializerMethodField()
    player2_ranking = serializers.SerializerMethodField()
    table_number = serializers.SerializerMethodField()
    bracket_name = serializers.CharField(source='bracket.name', read_only=True, default='')
    winner_name = serializers.SerializerMethodField()
    
    class Meta:
        model = Match
        fields = '__all__'
    
    def get_player1_name(self, obj):
        if obj.player1:
            return f"{obj.player1.last_name} {obj.player1.first_name}"
        return None
    
    def get_player2_name(self, obj):
        if obj.player2:
            return f"{obj.player2.last_name} {obj.player2.first_name}"
        return None

    def get_player1_club(self, obj):
        return obj.player1.club if obj.player1 else None

    def get_player2_club(self, obj):
        return obj.player2.club if obj.player2 else None

    def get_player1_ranking(self, obj):
        if obj.player1:
            return obj.player1.points or obj.player1.ranking
        return None

    def get_player2_ranking(self, obj):
        if obj.player2:
            return obj.player2.points or obj.player2.ranking
        return None

    def get_table_number(self, obj):
        return obj.table.table_number if obj.table else None
    
    def get_winner_name(self, obj):
        if obj.winner:
            return f"{obj.winner.last_name} {obj.winner.first_name}"
        return None


class MenuSectionSerializer(serializers.ModelSerializer):
    items = serializers.SerializerMethodField()
    
    class Meta:
        model = MenuSection
        fields = '__all__'
    
    def get_items(self, obj):
        items = obj.items.filter(is_available=True)
        return MenuItemSerializer(items, many=True).data


class MenuItemSerializer(serializers.ModelSerializer):
    section_name = serializers.CharField(source='section.name', read_only=True)
    
    class Meta:
        model = MenuItem
        fields = '__all__'


class PlayerNotificationSubscriptionSerializer(serializers.ModelSerializer):
    player_name = serializers.SerializerMethodField()
    player_email = serializers.EmailField(source='player.email', read_only=True)
    player_phone = serializers.CharField(source='player.phone', read_only=True)
    
    class Meta:
        model = PlayerNotificationSubscription
        fields = '__all__'
    
    def get_player_name(self, obj):
        return f"{obj.player.last_name} {obj.player.first_name}"


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = '__all__'


class UserAccountSerializer(serializers.ModelSerializer):
    player_name = serializers.SerializerMethodField()

    class Meta:
        model = UserAccount
        fields = ['id', 'username', 'role', 'player', 'player_name', 'created_at']

    def get_player_name(self, obj):
        if obj.player:
            return f"{obj.player.last_name} {obj.player.first_name}"
        return None
