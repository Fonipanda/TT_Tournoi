import requests
from django.utils import timezone
from django.db.models import Count, Q, Max
from django.core.mail import send_mail
from django.conf import settings
from rest_framework import viewsets, status
from rest_framework.decorators import api_view, action
from rest_framework.response import Response
from .models import (
    Tournament, Bracket, Player, PlayerBracketRegistration,
    Room, Table, Match, MenuSection, MenuItem,
    PlayerNotificationSubscription, Notification
)
from .serializers import (
    TournamentSerializer, BracketSerializer, PlayerSerializer,
    PlayerBracketRegistrationSerializer, RoomSerializer, TableSerializer,
    MatchSerializer, MenuSectionSerializer, MenuItemSerializer,
    PlayerNotificationSubscriptionSerializer, NotificationSerializer
)


class TournamentViewSet(viewsets.ModelViewSet):
    queryset = Tournament.objects.filter(is_active=True)
    serializer_class = TournamentSerializer


class BracketViewSet(viewsets.ModelViewSet):
    queryset = Bracket.objects.filter(is_active=True)
    serializer_class = BracketSerializer
    
    def get_queryset(self):
        queryset = super().get_queryset()
        tournament_id = self.request.query_params.get('tournament_id')
        if tournament_id:
            queryset = queryset.filter(tournament_id=tournament_id)
        return queryset.annotate(registered_count=Count('registrations', filter=Q(registrations__is_active=True)))
    
    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        serializer = self.get_serializer(queryset, many=True)
        data = serializer.data
        for item, obj in zip(data, queryset):
            item['registered_count'] = obj.registered_count
        return Response(data)
    
    @action(detail=True, methods=['get'])
    def stats(self, request, pk=None):
        bracket = self.get_object()
        registered_count = bracket.registrations.filter(is_active=True).count()
        return Response({
            'bracket_id': str(bracket.id),
            'registered_players': registered_count,
            'max_players': bracket.max_players,
            'available_spots': max(0, bracket.max_players - registered_count),
            'is_full': registered_count >= bracket.max_players,
            'entry_fee': float(bracket.entry_fee)
        })

    @action(detail=True, methods=['get'])
    def registered_players(self, request, pk=None):
        bracket = self.get_object()
        regs = bracket.registrations.filter(is_active=True).select_related('player')
        data = []
        for reg in regs:
            p = reg.player
            data.append({
                'id': str(p.id),
                'name': f"{p.last_name} {p.first_name}",
                'club': p.club or '',
                'points': p.points or 0,
                'ranking': p.ranking or '',
                'license_number': p.license_number or '',
            })
        data.sort(key=lambda x: x['points'], reverse=True)
        return Response(data)

    @action(detail=True, methods=['post'])
    def generate_matches(self, request, pk=None):
        import math
        from itertools import combinations
        bracket = self.get_object()
        elimination_type = request.data.get('elimination_type', 'single')
        has_third_place = request.data.get('has_third_place', True)
        seeded_players = request.data.get('seeded_players', [])
        pool_size = request.data.get('pool_size', 3)
        qualifiers_per_pool = request.data.get('qualifiers_per_pool', 2)
        custom_labels = request.data.get('round_labels', [])

        if seeded_players:
            player_ids = seeded_players
        else:
            regs = bracket.registrations.filter(is_active=True).select_related('player')
            player_ids = [str(r.player.id) for r in regs.order_by('-player__points')]

        n = len(player_ids)
        if n < 2:
            return Response({'error': 'Il faut au moins 2 joueurs inscrits'}, status=status.HTTP_400_BAD_REQUEST)

        bracket.matches.all().delete()
        created_matches = []

        if pool_size >= 2:
            num_byes = n % pool_size
            bye_players = player_ids[:num_byes]
            pool_players = player_ids[num_byes:]

            pools = []
            for i in range(0, len(pool_players), pool_size):
                pool = pool_players[i:i + pool_size]
                if len(pool) >= 2:
                    pools.append(pool)

            for pool_idx, pool in enumerate(pools):
                pool_name = f"Pool {chr(65 + pool_idx)}"
                for p1_id, p2_id in combinations(pool, 2):
                    match = Match.objects.create(
                        bracket=bracket,
                        player1_id=p1_id,
                        player2_id=p2_id,
                        round_name=pool_name,
                        round_number=1,
                        status='waiting'
                    )
                    created_matches.append({
                        'id': str(match.id),
                        'round_name': pool_name,
                        'round_number': 1,
                        'player1': p1_id,
                        'player2': p2_id,
                    })

            bracket.pool_qualifiers = qualifiers_per_pool
            bracket.bye_players = ','.join(bye_players) if bye_players else ''
            bracket.save(update_fields=['pool_qualifiers', 'bye_players'])

            return Response({
                'success': True,
                'matches_created': len(created_matches),
                'matches': created_matches,
                'total_players': n,
                'elimination_type': elimination_type,
                'pool_size': pool_size,
                'pools_count': len(pools),
                'byes_count': num_byes,
                'bye_players': bye_players,
                'qualifiers_per_pool': qualifiers_per_pool,
                'info': f'{len(pools)} poules de {pool_size} joueurs generees. '
                        f'{qualifiers_per_pool} qualifies par poule. '
                        f'{num_byes} joueur(s) exempte(s) de poule.'
                        if num_byes > 0 else
                        f'{len(pools)} poules de {pool_size} joueurs generees. '
                        f'{qualifiers_per_pool} qualifies par poule.',
            })

        label_map = {1: 'Finale', 2: '1/2', 3: '1/4', 4: '1/8', 5: '1/16', 6: '1/32', 7: '1/64'}

        def get_round_name(total_spots, current_round):
            rounds_needed = int(math.log2(total_spots)) if total_spots > 1 else 1
            round_from_end = rounds_needed - current_round
            return label_map.get(round_from_end, f'Tour {current_round + 1}')

        next_power = 1
        while next_power < n:
            next_power *= 2

        matches_in_round = next_power // 2
        round_name = get_round_name(next_power, 0)
        for i in range(matches_in_round):
            p1_idx = i * 2
            p2_idx = i * 2 + 1
            p1_id = player_ids[p1_idx] if p1_idx < n else None
            p2_id = player_ids[p2_idx] if p2_idx < n else None
            if p1_id and p2_id:
                match = Match.objects.create(
                    bracket=bracket,
                    player1_id=p1_id,
                    player2_id=p2_id,
                    round_name=round_name,
                    round_number=1,
                    status='waiting'
                )
                created_matches.append({
                    'id': str(match.id),
                    'round_name': round_name,
                    'round_number': 1,
                    'player1': p1_id,
                    'player2': p2_id,
                })

        return Response({
            'success': True,
            'matches_created': len(created_matches),
            'matches': created_matches,
            'total_players': n,
            'elimination_type': elimination_type,
            'bracket_size': next_power,
            'info': 'Premier tour genere. Les tours suivants seront crees automatiquement apres saisie des resultats.',
        })


class PlayerViewSet(viewsets.ModelViewSet):
    queryset = Player.objects.filter(is_active=True)
    serializer_class = PlayerSerializer
    
    def get_queryset(self):
        queryset = super().get_queryset()
        search = self.request.query_params.get('search')
        email = self.request.query_params.get('email')
        license_number = self.request.query_params.get('license_number')
        
        if search:
            queryset = queryset.filter(
                Q(first_name__icontains=search) |
                Q(last_name__icontains=search) |
                Q(club__icontains=search) |
                Q(email__icontains=search)
            )
        if email:
            queryset = queryset.filter(email__iexact=email)
        if license_number:
            queryset = queryset.filter(license_number=license_number)
        return queryset
    
    @action(detail=True, methods=['get'])
    def brackets(self, request, pk=None):
        player = self.get_object()
        registrations = player.registrations.filter(is_active=True).select_related('bracket', 'bracket__tournament')
        data = []
        for reg in registrations:
            data.append({
                'registration_id': str(reg.id),
                'bracket_id': str(reg.bracket.id),
                'bracket_name': reg.bracket.name,
                'bracket_category': reg.bracket.category,
                'tournament_id': str(reg.bracket.tournament.id),
                'tournament_name': reg.bracket.tournament.name,
                'entry_fee': float(reg.bracket.entry_fee),
                'payment_status': reg.payment_status,
            })
        return Response(data)
    
    @action(detail=True, methods=['get'])
    def registration_summary(self, request, pk=None):
        player = self.get_object()
        registrations = player.registrations.filter(is_active=True).select_related('bracket')
        total_amount = sum(float(reg.bracket.entry_fee) for reg in registrations)
        return Response({
            'player_id': str(player.id),
            'registration_count': registrations.count(),
            'total_amount': total_amount,
            'registrations': PlayerBracketRegistrationSerializer(registrations, many=True).data
        })


class PlayerBracketRegistrationViewSet(viewsets.ModelViewSet):
    queryset = PlayerBracketRegistration.objects.filter(is_active=True)
    serializer_class = PlayerBracketRegistrationSerializer
    
    def get_queryset(self):
        queryset = super().get_queryset()
        player_id = self.request.query_params.get('player_id')
        bracket_id = self.request.query_params.get('bracket_id')
        if player_id:
            queryset = queryset.filter(player_id=player_id)
        if bracket_id:
            queryset = queryset.filter(bracket_id=bracket_id)
        return queryset
    
    def create(self, request, *args, **kwargs):
        player_id = request.data.get('player')
        bracket_id = request.data.get('bracket')
        
        try:
            player = Player.objects.get(id=player_id)
            bracket = Bracket.objects.get(id=bracket_id)
        except (Player.DoesNotExist, Bracket.DoesNotExist):
            return Response(
                {'error': 'Joueur ou tableau non trouvé'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        if PlayerBracketRegistration.objects.filter(
            player=player, bracket=bracket, is_active=True
        ).exists():
            return Response(
                {'error': 'Joueur déjà inscrit à ce tableau'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        registered_count = bracket.registrations.filter(is_active=True).count()
        if registered_count >= bracket.max_players:
            return Response(
                {'error': 'Ce tableau est complet'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if bracket.day:
            player_day_registrations = PlayerBracketRegistration.objects.filter(
                player=player,
                is_active=True,
                bracket__day=bracket.day,
                bracket__tournament=bracket.tournament
            ).count()
            if player_day_registrations >= 2:
                return Response(
                    {'error': f'Un joueur ne peut pas s\'inscrire à plus de 2 tableaux par jour ({bracket.day})'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        else:
            player_total_registrations = PlayerBracketRegistration.objects.filter(
                player=player,
                is_active=True,
                bracket__tournament=bracket.tournament
            ).count()
            if player_total_registrations >= 2:
                return Response(
                    {'error': 'Un joueur ne peut pas s\'inscrire à plus de 2 tableaux'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        return super().create(request, *args, **kwargs)


class RoomViewSet(viewsets.ModelViewSet):
    queryset = Room.objects.filter(is_active=True)
    serializer_class = RoomSerializer

    def perform_create(self, serializer):
        room = serializer.save()
        max_num = Table.objects.aggregate(Max('table_number'))['table_number__max'] or 0
        for row in range(room.rows):
            for col in range(room.tables_per_row):
                max_num += 1
                Table.objects.create(
                    room=room,
                    table_number=max_num,
                    position_row=row,
                    position_col=col,
                )

    def perform_update(self, serializer):
        room = serializer.save()
        existing_tables = room.tables.all()
        existing_count = existing_tables.count()
        desired_count = room.rows * room.tables_per_row
        if desired_count > existing_count:
            max_num = Table.objects.aggregate(Max('table_number'))['table_number__max'] or 0
            idx = 0
            for row in range(room.rows):
                for col in range(room.tables_per_row):
                    idx += 1
                    if idx > existing_count:
                        max_num += 1
                        Table.objects.create(
                            room=room,
                            table_number=max_num,
                            position_row=row,
                            position_col=col,
                        )
        elif desired_count < existing_count:
            free_tables = existing_tables.filter(status='free').order_by('-table_number')
            to_delete = existing_count - desired_count
            free_tables[:to_delete].delete()

    def perform_destroy(self, instance):
        instance.tables.all().delete()
        instance.delete()


class TableViewSet(viewsets.ModelViewSet):
    queryset = Table.objects.all()
    serializer_class = TableSerializer
    
    def get_queryset(self):
        queryset = super().get_queryset()
        room_id = self.request.query_params.get('room_id')
        if room_id:
            queryset = queryset.filter(room_id=room_id)
        return queryset.select_related('room', 'player1', 'player2')


class MatchViewSet(viewsets.ModelViewSet):
    queryset = Match.objects.all()
    serializer_class = MatchSerializer
    
    def get_queryset(self):
        queryset = super().get_queryset()
        bracket_id = self.request.query_params.get('bracket_id')
        status_filter = self.request.query_params.get('status')
        if bracket_id:
            queryset = queryset.filter(bracket_id=bracket_id)
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        return queryset.select_related('player1', 'player2', 'bracket', 'table', 'winner')
    
    @action(detail=True, methods=['post'])
    def assign_table(self, request, pk=None):
        match = self.get_object()
        table_id = request.data.get('table_id')
        
        try:
            table = Table.objects.get(id=table_id)
        except Table.DoesNotExist:
            return Response(
                {'error': 'Table non trouvée'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        if table.status != 'free':
            return Response(
                {'error': 'Cette table n\'est pas disponible'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        match.table = table
        match.status = 'in_progress'
        match.start_time = timezone.now()
        match.save()
        
        table.status = 'occupied'
        table.current_match = match
        table.player1 = match.player1
        table.player2 = match.player2
        table.match_start_time = timezone.now()
        table.save()
        
        send_match_notification(match, 'table_assigned')
        
        return Response({'message': 'Match assigné à la table'})
    
    @action(detail=True, methods=['post'])
    def finish(self, request, pk=None):
        match = self.get_object()
        
        if match.status == 'finished':
            return Response(
                {'error': 'Ce match est déjà terminé'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        winner_id = request.data.get('winner_id')
        sets_player1 = request.data.get('sets_player1', 0)
        sets_player2 = request.data.get('sets_player2', 0)
        score_player1 = request.data.get('score_player1', 0)
        score_player2 = request.data.get('score_player2', 0)
        
        if winner_id:
            if str(match.player1_id) == str(winner_id):
                match.winner = match.player1
            elif str(match.player2_id) == str(winner_id):
                match.winner = match.player2
            else:
                return Response(
                    {'error': 'Le gagnant doit etre un des deux joueurs du match'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            match.sets_player1 = sets_player1 or (1 if match.winner == match.player1 else 0)
            match.sets_player2 = sets_player2 or (1 if match.winner == match.player2 else 0)
        else:
            if sets_player1 == sets_player2:
                return Response(
                    {'error': 'Un match ne peut pas se terminer par une egalite'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            match.sets_player1 = sets_player1
            match.sets_player2 = sets_player2
            match.winner = match.player1 if sets_player1 > sets_player2 else match.player2
        
        match.score_player1 = score_player1
        match.score_player2 = score_player2
        match.status = 'finished'
        match.end_time = timezone.now()
        match.save()
        
        if match.table:
            table = match.table
            table.status = 'free'
            table.current_match = None
            table.player1 = None
            table.player2 = None
            table.match_start_time = None
            table.save()
        
        next_match = self._advance_bracket(match)
        
        return Response({
            'message': 'Match terminé',
            'winner': str(match.winner.id) if match.winner else None,
            'next_match': str(next_match.id) if next_match else None,
        })

    def _advance_bracket(self, finished_match):
        import math
        bracket = finished_match.bracket
        round_name = finished_match.round_name or ''
        winner = finished_match.winner

        if not winner:
            return None

        is_pool = round_name.startswith('Pool')
        if is_pool:
            return self._advance_pool(bracket, round_name)

        label_order = ['1/64', '1/32', '1/16', '1/8', '1/4', '1/2', 'Finale']
        current_idx = -1
        for i, label in enumerate(label_order):
            if label == round_name:
                current_idx = i
                break

        if current_idx == -1 or round_name == 'Finale' or round_name == 'Petite Finale':
            return None

        next_round_name = label_order[current_idx + 1] if current_idx + 1 < len(label_order) else None
        if not next_round_name:
            return None

        same_round_matches = list(
            bracket.matches.filter(round_name=round_name).order_by('created_at')
        )
        match_index = None
        for i, m in enumerate(same_round_matches):
            if m.id == finished_match.id:
                match_index = i
                break

        if match_index is None:
            return None

        partner_index = match_index ^ 1
        if partner_index >= len(same_round_matches):
            return None

        partner_match = same_round_matches[partner_index]
        if partner_match.status != 'finished' or not partner_match.winner:
            return None

        next_round_number = (finished_match.round_number or 1) + 1
        pair_position = match_index // 2

        existing = bracket.matches.filter(
            round_name=next_round_name,
            round_number=next_round_number,
        ).order_by('created_at')

        for ex in existing:
            players = {str(ex.player1_id), str(ex.player2_id)}
            if str(winner.id) in players or str(partner_match.winner.id) in players:
                return None

        if match_index % 2 == 0:
            p1 = winner
            p2 = partner_match.winner
        else:
            p1 = partner_match.winner
            p2 = winner

        next_match = Match.objects.create(
            bracket=bracket,
            player1=p1,
            player2=p2,
            round_name=next_round_name,
            round_number=next_round_number,
            status='waiting',
        )
        return next_match

    def _advance_pool(self, bracket, pool_name):
        pool_matches = bracket.matches.filter(round_name=pool_name)
        all_finished = all(m.status == 'finished' for m in pool_matches)
        if not all_finished:
            return None

        all_pool_names = list(
            bracket.matches.filter(round_name__startswith='Pool')
            .values_list('round_name', flat=True).distinct()
        )
        all_pools_done = True
        for pn in all_pool_names:
            pmatches = bracket.matches.filter(round_name=pn)
            if not all(m.status == 'finished' for m in pmatches):
                all_pools_done = False
                break

        if not all_pools_done:
            return None

        has_elim_matches = bracket.matches.filter(round_number__gt=1).exists()
        if has_elim_matches:
            return None

        import math
        qualifiers_per_pool = getattr(bracket, 'pool_qualifiers', 2) or 2

        pool_standings = {}
        for pn in sorted(all_pool_names):
            pmatches = bracket.matches.filter(round_name=pn)
            players_in_pool = set()
            wins = {}
            sets_diff = {}
            for m in pmatches:
                p1id = str(m.player1_id)
                p2id = str(m.player2_id)
                players_in_pool.add(p1id)
                players_in_pool.add(p2id)
                wins.setdefault(p1id, 0)
                wins.setdefault(p2id, 0)
                sets_diff.setdefault(p1id, 0)
                sets_diff.setdefault(p2id, 0)
                if m.winner_id:
                    wins[str(m.winner_id)] = wins.get(str(m.winner_id), 0) + 1
                sets_diff[p1id] += (m.sets_player1 or 0) - (m.sets_player2 or 0)
                sets_diff[p2id] += (m.sets_player2 or 0) - (m.sets_player1 or 0)

            ranking = sorted(
                players_in_pool,
                key=lambda pid: (wins.get(pid, 0), sets_diff.get(pid, 0)),
                reverse=True,
            )
            pool_standings[pn] = ranking

        qualified = []
        for pn in sorted(pool_standings.keys()):
            ranking = pool_standings[pn]
            qualified.extend(ranking[:qualifiers_per_pool])

        bye_str = getattr(bracket, 'bye_players', '') or ''
        bye_ids = [pid for pid in bye_str.split(',') if pid]
        all_qualified = bye_ids + qualified

        n = len(all_qualified)
        if n < 2:
            return None

        next_power = 1
        while next_power < n:
            next_power *= 2

        num_elim_byes = next_power - n

        label_map = {1: 'Finale', 2: '1/2', 3: '1/4', 4: '1/8', 5: '1/16', 6: '1/32', 7: '1/64'}
        rounds_needed = int(math.log2(next_power)) if next_power > 1 else 1
        round_from_end = rounds_needed
        first_round_name = label_map.get(round_from_end, 'Tour 2')

        last_match = None
        match_idx = 0
        player_cursor = 0
        for i in range(next_power // 2):
            p1_idx = player_cursor
            if p1_idx < n:
                p1_id = all_qualified[p1_idx]
                player_cursor += 1
            else:
                p1_id = None

            if i < num_elim_byes:
                pass
            else:
                p2_idx = player_cursor
                if p2_idx < n:
                    p2_id = all_qualified[p2_idx]
                    player_cursor += 1
                else:
                    p2_id = None

                if p1_id and p2_id:
                    last_match = Match.objects.create(
                        bracket=bracket,
                        player1_id=p1_id,
                        player2_id=p2_id,
                        round_name=first_round_name,
                        round_number=2,
                        status='waiting',
                    )

        return last_match


class MenuSectionViewSet(viewsets.ModelViewSet):
    queryset = MenuSection.objects.all()
    serializer_class = MenuSectionSerializer


class MenuItemViewSet(viewsets.ModelViewSet):
    queryset = MenuItem.objects.all()
    serializer_class = MenuItemSerializer
    
    def get_queryset(self):
        queryset = super().get_queryset()
        section_id = self.request.query_params.get('section_id')
        if section_id:
            queryset = queryset.filter(section_id=section_id)
        return queryset


class PlayerNotificationSubscriptionViewSet(viewsets.ModelViewSet):
    queryset = PlayerNotificationSubscription.objects.all()
    serializer_class = PlayerNotificationSubscriptionSerializer
    
    def get_queryset(self):
        queryset = super().get_queryset()
        player_id = self.request.query_params.get('player_id')
        if player_id:
            queryset = queryset.filter(player_id=player_id)
        return queryset


class NotificationViewSet(viewsets.ModelViewSet):
    queryset = Notification.objects.all()
    serializer_class = NotificationSerializer
    
    def get_queryset(self):
        queryset = super().get_queryset()
        player_id = self.request.query_params.get('player_id')
        if player_id:
            queryset = queryset.filter(player_id=player_id)
        return queryset
    
    @action(detail=True, methods=['post'])
    def mark_read(self, request, pk=None):
        notification = self.get_object()
        notification.is_read = True
        notification.save()
        return Response({'message': 'Notification marquée comme lue'})


@api_view(['GET'])
def live_tables(request):
    tables = Table.objects.select_related('room', 'player1', 'player2', 'current_match').all()
    data = []
    for table in tables:
        data.append({
            'id': str(table.id),
            'table_number': table.table_number,
            'room': {
                'id': str(table.room.id),
                'name': table.room.name
            },
            'status': table.status,
            'orientation': table.orientation,
            'player1': {
                'id': str(table.player1.id),
                'name': f"{table.player1.last_name} {table.player1.first_name}",
                'club': table.player1.club,
                'ranking': table.player1.ranking
            } if table.player1 else None,
            'player2': {
                'id': str(table.player2.id),
                'name': f"{table.player2.last_name} {table.player2.first_name}",
                'club': table.player2.club,
                'ranking': table.player2.ranking
            } if table.player2 else None,
            'match_start_time': table.match_start_time.isoformat() if table.match_start_time else None
        })
    return Response(data)


@api_view(['GET'])
def live_matches(request):
    matches = Match.objects.filter(
        status__in=['in_progress', 'waiting']
    ).select_related('player1', 'player2', 'table', 'bracket')
    
    data = []
    for match in matches:
        data.append({
            'id': str(match.id),
            'bracket': {
                'id': str(match.bracket.id),
                'name': match.bracket.name
            },
            'player1': {
                'id': str(match.player1.id),
                'name': f"{match.player1.last_name} {match.player1.first_name}",
                'club': match.player1.club,
                'ranking': match.player1.ranking
            },
            'player2': {
                'id': str(match.player2.id),
                'name': f"{match.player2.last_name} {match.player2.first_name}",
                'club': match.player2.club,
                'ranking': match.player2.ranking
            },
            'table': {
                'id': str(match.table.id),
                'number': match.table.table_number
            } if match.table else None,
            'status': match.status,
            'sets_player1': match.sets_player1,
            'sets_player2': match.sets_player2,
            'start_time': match.start_time.isoformat() if match.start_time else None
        })
    return Response(data)


@api_view(['GET'])
def fftt_lookup(request, license_number):
    try:
        url = f"https://fftt.dafunker.com/v1/joueur/{license_number}"
        response = requests.get(url, timeout=10, verify=False)
        
        if response.status_code == 200:
            data = response.json()
            if data:
                player_data = data if isinstance(data, dict) else (data[0] if isinstance(data, list) and len(data) > 0 else None)
                if player_data:
                    points_value = player_data.get('point', player_data.get('points', 0))
                    return Response({
                        'success': True,
                        'data': {
                            'licence': player_data.get('licence', license_number),
                            'nom': player_data.get('nom', ''),
                            'prenom': player_data.get('prenom', ''),
                            'club': player_data.get('nomclub', player_data.get('club', '')),
                            'nclub': player_data.get('numclub', player_data.get('nclub', '')),
                            'points': str(int(points_value)) if points_value else '0',
                            'cat': player_data.get('cat', ''),
                        }
                    })
            return Response({
                'success': False,
                'error': f'Aucun joueur trouve avec le numero de licence {license_number}'
            })
        else:
            return Response({
                'success': False,
                'error': f'Aucun joueur trouve avec le numero de licence {license_number}'
            })
    except requests.exceptions.Timeout:
        return Response({
            'success': False,
            'error': 'Delai d\'attente depasse lors de la recherche'
        })
    except Exception as e:
        import traceback
        print(f"FFTT Error: {e}")
        print(traceback.format_exc())
        return Response({
            'success': False,
            'error': f'Erreur: {str(e)}'
        })


@api_view(['POST'])
def admin_login(request):
    username = request.data.get('username', '')
    password = request.data.get('password', '')
    
    if username == 'admin' and password == 'admin':
        return Response({
            'success': True,
            'message': 'Connexion réussie',
            'token': 'admin-token-local'
        })
    return Response({
        'success': False,
        'error': 'Identifiants incorrects'
    }, status=status.HTTP_401_UNAUTHORIZED)


def send_match_notification(match, notification_type):
    for player in [match.player1, match.player2]:
        try:
            subscription = PlayerNotificationSubscription.objects.get(player=player)
        except PlayerNotificationSubscription.DoesNotExist:
            continue
        
        title = ""
        message = ""
        
        if notification_type == 'table_assigned':
            title = "Table assignée"
            message = f"Votre match est prêt ! Rendez-vous à la table {match.table.table_number}."
        elif notification_type == 'match_started':
            title = "Match commencé"
            message = f"Votre match contre {match.player2.last_name if player == match.player1 else match.player1.last_name} a commencé."
        
        notification = Notification.objects.create(
            player=player,
            type=notification_type,
            title=title,
            message=message
        )
        
        if subscription.email_enabled and player.email:
            try:
                send_mail(
                    subject=title,
                    message=message,
                    from_email=settings.DEFAULT_FROM_EMAIL,
                    recipient_list=[player.email],
                    fail_silently=True
                )
                notification.is_sent_email = True
                notification.save()
            except Exception:
                pass
        
        if subscription.sms_enabled and player.phone and settings.SMS_API_KEY:
            try:
                sms_response = requests.post(
                    settings.SMS_API_URL,
                    json={
                        'api_key': settings.SMS_API_KEY,
                        'to': player.phone,
                        'message': f"{title}: {message}"
                    },
                    timeout=10
                )
                if sms_response.status_code == 200:
                    notification.is_sent_sms = True
                    notification.save()
            except Exception:
                pass
