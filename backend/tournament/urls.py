from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'tournaments', views.TournamentViewSet)
router.register(r'brackets', views.BracketViewSet)
router.register(r'players', views.PlayerViewSet)
router.register(r'player-bracket-registrations', views.PlayerBracketRegistrationViewSet)
router.register(r'rooms', views.RoomViewSet)
router.register(r'tables', views.TableViewSet)
router.register(r'matches', views.MatchViewSet)
router.register(r'menu-sections', views.MenuSectionViewSet)
router.register(r'menu-items', views.MenuItemViewSet)
router.register(r'notification-subscriptions', views.PlayerNotificationSubscriptionViewSet)
router.register(r'notifications', views.NotificationViewSet)

urlpatterns = [
    path('', include(router.urls)),
    path('live/tables/', views.live_tables, name='live-tables'),
    path('live/matches/', views.live_matches, name='live-matches'),
    path('fftt/lookup/<str:license_number>/', views.fftt_lookup, name='fftt-lookup'),
    path('auth/admin-login/', views.admin_login, name='admin-login'),
]
