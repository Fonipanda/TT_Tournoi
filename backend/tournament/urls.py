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
router.register(r'sms/adapters', views.SmsAdapterConfigViewSet)
router.register(r'sms/templates', views.SmsTemplateViewSet)
router.register(r'sms/logs', views.SmsLogViewSet)

urlpatterns = [
    path('', include(router.urls)),
    path('live/tables/', views.live_tables, name='live-tables'),
    path('live/matches/', views.live_matches, name='live-matches'),
    path('fftt/lookup/<str:license_number>/', views.fftt_lookup, name='fftt-lookup'),
    path('auth/admin-login/', views.admin_login, name='admin-login'),
    path('auth/player-register/', views.player_register, name='player-register'),
    path('checkin/scan/', views.checkin_scan, name='checkin-scan'),
    path('payments/create-checkout-session/', views.create_checkout_session, name='create-checkout-session'),
    path('payments/webhook/', views.stripe_webhook, name='stripe-webhook'),
    path('payments/session-status/<str:session_id>/', views.payment_session_status, name='payment-session-status'),
    path('sms/send/', views.sms_send, name='sms-send'),
    path('sms/test/', views.sms_test, name='sms-test'),
    path('sms/stats/', views.sms_stats, name='sms-stats'),
    path('sms/adapter-fields/<str:adapter_type>/', views.sms_adapter_fields, name='sms-adapter-fields'),
    path('sms/template-variables/', views.sms_template_variables, name='sms-template-variables'),
]
