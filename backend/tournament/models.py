import uuid
from django.db import models

class Tournament(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True, null=True)
    start_date = models.DateTimeField(blank=True, null=True)
    end_date = models.DateTimeField(blank=True, null=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.name


class Bracket(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tournament = models.ForeignKey(Tournament, on_delete=models.CASCADE, related_name='brackets')
    name = models.CharField(max_length=100)
    category = models.CharField(max_length=100)
    min_points = models.IntegerField(blank=True, null=True)
    max_points = models.IntegerField(blank=True, null=True)
    max_players = models.IntegerField(default=16)
    entry_fee = models.DecimalField(max_digits=6, decimal_places=2, default=0)
    day = models.CharField(max_length=50, blank=True, null=True)
    checkin_end = models.CharField(max_length=20, blank=True, null=True)
    start_time = models.CharField(max_length=20, blank=True, null=True)
    pool_qualifiers = models.IntegerField(default=2)
    bye_players = models.TextField(blank=True, default='')
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return f"{self.name} - {self.category}"


class Player(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100)
    license_number = models.CharField(max_length=20, blank=True, null=True, unique=True)
    ranking = models.CharField(max_length=10, blank=True, null=True)
    points = models.IntegerField(blank=True, null=True)
    club = models.CharField(max_length=100, blank=True, null=True)
    email = models.EmailField()
    phone = models.CharField(max_length=20, blank=True, null=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['last_name', 'first_name']

    def __str__(self):
        return f"{self.last_name} {self.first_name}"


class PlayerBracketRegistration(models.Model):
    PAYMENT_STATUS_CHOICES = [
        ('pending', 'En attente'),
        ('paid', 'Payé'),
        ('cancelled', 'Annulé'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    player = models.ForeignKey(Player, on_delete=models.CASCADE, related_name='registrations')
    bracket = models.ForeignKey(Bracket, on_delete=models.CASCADE, related_name='registrations')
    payment_status = models.CharField(max_length=20, choices=PAYMENT_STATUS_CHOICES, default='pending')
    amount_paid = models.DecimalField(max_digits=6, decimal_places=2, default=0)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ['player', 'bracket']
        ordering = ['-created_at']


class Room(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True, null=True)
    rows = models.IntegerField(default=2)
    tables_per_row = models.IntegerField(default=4)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


class Table(models.Model):
    STATUS_CHOICES = [
        ('free', 'Libre'),
        ('occupied', 'Occupee'),
        ('maintenance', 'Maintenance'),
    ]
    
    ORIENTATION_CHOICES = [
        ('horizontal', 'Horizontal'),
        ('vertical', 'Vertical'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    table_number = models.IntegerField(unique=True)
    room = models.ForeignKey(Room, on_delete=models.CASCADE, related_name='tables')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='free')
    position_row = models.IntegerField(default=0)
    position_col = models.IntegerField(default=0)
    orientation = models.CharField(max_length=20, choices=ORIENTATION_CHOICES, default='horizontal')
    current_match = models.ForeignKey('Match', on_delete=models.SET_NULL, null=True, blank=True, related_name='assigned_table')
    player1 = models.ForeignKey(Player, on_delete=models.SET_NULL, null=True, blank=True, related_name='table_player1')
    player2 = models.ForeignKey(Player, on_delete=models.SET_NULL, null=True, blank=True, related_name='table_player2')
    match_start_time = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['table_number']

    def __str__(self):
        return f"Table {self.table_number} - {self.room.name}"


class Match(models.Model):
    STATUS_CHOICES = [
        ('waiting', 'En attente'),
        ('in_progress', 'En cours'),
        ('finished', 'Terminé'),
        ('blocked', 'Bloqué'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    bracket = models.ForeignKey(Bracket, on_delete=models.CASCADE, related_name='matches')
    player1 = models.ForeignKey(Player, on_delete=models.CASCADE, related_name='matches_as_player1')
    player2 = models.ForeignKey(Player, on_delete=models.CASCADE, related_name='matches_as_player2')
    table = models.ForeignKey(Table, on_delete=models.SET_NULL, null=True, blank=True, related_name='matches')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='waiting')
    score_player1 = models.IntegerField(default=0)
    score_player2 = models.IntegerField(default=0)
    sets_player1 = models.IntegerField(default=0)
    sets_player2 = models.IntegerField(default=0)
    winner = models.ForeignKey(Player, on_delete=models.SET_NULL, null=True, blank=True, related_name='won_matches')
    round_name = models.CharField(max_length=100, blank=True, null=True)
    round_number = models.IntegerField(default=1)
    start_time = models.DateTimeField(blank=True, null=True)
    end_time = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']


class MenuSection(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100)
    order = models.IntegerField(default=0)

    class Meta:
        ordering = ['order']

    def __str__(self):
        return self.name


class MenuItem(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    section = models.ForeignKey(MenuSection, on_delete=models.CASCADE, related_name='items')
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True, null=True)
    price = models.DecimalField(max_digits=6, decimal_places=2)
    image_url = models.URLField(blank=True, null=True)
    is_available = models.BooleanField(default=True)
    order = models.IntegerField(default=0)

    class Meta:
        ordering = ['order']

    def __str__(self):
        return self.name


class PlayerNotificationSubscription(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    player = models.ForeignKey(Player, on_delete=models.CASCADE, related_name='notification_subscriptions')
    email_enabled = models.BooleanField(default=True)
    sms_enabled = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ['player']


class Notification(models.Model):
    TYPE_CHOICES = [
        ('match_created', 'Match créé'),
        ('match_started', 'Match commencé'),
        ('table_assigned', 'Table assignée'),
        ('match_blocked', 'Match bloqué'),
        ('match_unblocked', 'Match débloqué'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    player = models.ForeignKey(Player, on_delete=models.CASCADE, related_name='notifications')
    type = models.CharField(max_length=50, choices=TYPE_CHOICES)
    title = models.CharField(max_length=200)
    message = models.TextField()
    is_read = models.BooleanField(default=False)
    is_sent_email = models.BooleanField(default=False)
    is_sent_sms = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']


class UserAccount(models.Model):
    ROLE_CHOICES = [
        ('player', 'Joueur'),
        ('admin', 'Administrateur'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    username = models.CharField(max_length=100, unique=True)
    password_hash = models.CharField(max_length=200)
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='player')
    player = models.OneToOneField(Player, on_delete=models.SET_NULL, null=True, blank=True, related_name='account')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.username} ({self.role})"
