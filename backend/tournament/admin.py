from django.contrib import admin
from .models import (
    Tournament, Bracket, Player, PlayerBracketRegistration,
    Room, Table, Match, MenuSection, MenuItem,
    PlayerNotificationSubscription, Notification, UserAccount,
    SmsAdapterConfig, SmsTemplate, SmsLog
)

@admin.register(Tournament)
class TournamentAdmin(admin.ModelAdmin):
    list_display = ['name', 'start_date', 'end_date', 'is_active', 'created_at']
    list_filter = ['is_active']
    search_fields = ['name']

@admin.register(Bracket)
class BracketAdmin(admin.ModelAdmin):
    list_display = ['name', 'tournament', 'category', 'min_points', 'max_points', 'max_players', 'entry_fee']
    list_filter = ['tournament', 'is_active']
    search_fields = ['name', 'category']

@admin.register(Player)
class PlayerAdmin(admin.ModelAdmin):
    list_display = ['last_name', 'first_name', 'license_number', 'ranking', 'club', 'email']
    list_filter = ['club', 'is_active']
    search_fields = ['last_name', 'first_name', 'license_number', 'email']

@admin.register(PlayerBracketRegistration)
class PlayerBracketRegistrationAdmin(admin.ModelAdmin):
    list_display = ['player', 'bracket', 'payment_status', 'amount_paid', 'created_at']
    list_filter = ['payment_status', 'bracket']
    search_fields = ['player__last_name', 'player__first_name']

@admin.register(Room)
class RoomAdmin(admin.ModelAdmin):
    list_display = ['name', 'description', 'is_active']
    list_filter = ['is_active']

@admin.register(Table)
class TableAdmin(admin.ModelAdmin):
    list_display = ['table_number', 'room', 'status']
    list_filter = ['room', 'status']

@admin.register(Match)
class MatchAdmin(admin.ModelAdmin):
    list_display = ['player1', 'player2', 'bracket', 'status', 'table', 'winner']
    list_filter = ['status', 'bracket']
    search_fields = ['player1__last_name', 'player2__last_name']

@admin.register(MenuSection)
class MenuSectionAdmin(admin.ModelAdmin):
    list_display = ['name', 'order']
    ordering = ['order']

@admin.register(MenuItem)
class MenuItemAdmin(admin.ModelAdmin):
    list_display = ['name', 'section', 'price', 'is_available']
    list_filter = ['section', 'is_available']

@admin.register(PlayerNotificationSubscription)
class PlayerNotificationSubscriptionAdmin(admin.ModelAdmin):
    list_display = ['player', 'email_enabled', 'sms_enabled', 'created_at']

@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ['player', 'type', 'title', 'is_read', 'is_sent_email', 'is_sent_sms', 'created_at']
    list_filter = ['type', 'is_read', 'is_sent_email', 'is_sent_sms']

@admin.register(UserAccount)
class UserAccountAdmin(admin.ModelAdmin):
    list_display = ['username', 'role', 'player', 'created_at']
    list_filter = ['role']
    search_fields = ['username']

@admin.register(SmsAdapterConfig)
class SmsAdapterConfigAdmin(admin.ModelAdmin):
    list_display = ['name', 'adapter_type', 'is_active', 'created_at']
    list_filter = ['adapter_type', 'is_active']

@admin.register(SmsTemplate)
class SmsTemplateAdmin(admin.ModelAdmin):
    list_display = ['name', 'is_active', 'created_at']

@admin.register(SmsLog)
class SmsLogAdmin(admin.ModelAdmin):
    list_display = ['recipient_phone', 'player', 'status', 'adapter_name', 'created_at']
    list_filter = ['status', 'adapter_name']
