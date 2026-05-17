import logging
import threading
from django.utils import timezone
from .adapters import get_adapter

logger = logging.getLogger('tournament.sms')

TEMPLATE_VARIABLES = [
    {'name': 'joueur', 'label': 'Nom du joueur', 'example': 'DUPONT Martin'},
    {'name': 'table', 'label': 'Numero de table', 'example': '5'},
    {'name': 'tableau', 'label': 'Nom du tableau', 'example': 'Tableau A'},
    {'name': 'adversaire', 'label': 'Nom de l\'adversaire', 'example': 'MARTIN Paul'},
    {'name': 'heure', 'label': 'Heure actuelle', 'example': '14:30'},
    {'name': 'salle', 'label': 'Nom de la salle', 'example': 'Salle principale'},
    {'name': 'message', 'label': 'Message libre', 'example': 'Information importante'},
]


def render_template(template_content: str, context: dict) -> str:
    """Remplace les variables {var} dans le template."""
    result = template_content
    for key, value in context.items():
        result = result.replace('{' + key + '}', str(value) if value else '')
    return result


def get_active_adapter_config():
    """Retourne la config de l'adaptateur actif."""
    from tournament.models import SmsAdapterConfig
    try:
        return SmsAdapterConfig.objects.get(is_active=True)
    except SmsAdapterConfig.DoesNotExist:
        return None


def resolve_subscribers(player):
    """Retourne la liste des abonnes SMS actifs pour un joueur."""
    from tournament.models import PlayerNotificationSubscription
    subs = PlayerNotificationSubscription.objects.filter(player=player, sms_enabled=True)
    result = []
    for sub in subs:
        phone = sub.subscriber_phone or (player.phone if player.phone else '')
        if phone:
            result.append({
                'phone': phone,
                'name': sub.subscriber_name or f"{player.last_name} {player.first_name}",
                'subscription_id': str(sub.id),
            })
    # Fallback: si aucun abonne mais joueur a un telephone
    if not result and player.phone:
        result.append({
            'phone': player.phone,
            'name': f"{player.last_name} {player.first_name}",
            'subscription_id': None,
        })
    return result


def send_sms(to: str, message: str, sender: str = '', player=None, adapter_config=None) -> 'SmsLog':
    """Envoie un SMS via l'adaptateur actif et cree un log."""
    from tournament.models import SmsLog

    if not adapter_config:
        adapter_config = get_active_adapter_config()

    if not adapter_config:
        log = SmsLog.objects.create(
            player=player,
            recipient_phone=to,
            message=message,
            sender=sender,
            adapter_name='none',
            status='failed',
            error_message='Aucun adaptateur SMS actif',
        )
        logger.warning("[SMS] Aucun adaptateur actif configure")
        return log

    adapter = get_adapter(adapter_config.adapter_type, adapter_config.config)
    effective_sender = sender or adapter_config.default_sender or ''

    log = SmsLog.objects.create(
        player=player,
        recipient_phone=to,
        message=message,
        sender=effective_sender,
        adapter_name=adapter_config.name,
        status='pending',
    )

    try:
        result = adapter.send(to, message, effective_sender)
        if result.get('success'):
            log.status = 'sent'
        else:
            log.status = 'failed'
            log.error_message = result.get('error', '')
        log.save()
    except Exception as e:
        log.status = 'failed'
        log.error_message = str(e)
        log.save()
        logger.error(f"[SMS] Erreur envoi vers {to}: {e}")

    return log


def send_notification_sms(player, message: str, notification=None):
    """Envoie un SMS a tous les abonnes d'un joueur."""
    subscribers = resolve_subscribers(player)
    for sub in subscribers:
        send_sms(to=sub['phone'], message=message, player=player)


def send_bulk_sms(recipients: list, message: str, sender: str = ''):
    """Envoie des SMS en masse via threading. recipients = [{phone, name, player}]"""
    adapter_config = get_active_adapter_config()
    results = {'sent': 0, 'failed': 0}
    lock = threading.Lock()

    def _send_one(recipient):
        log = send_sms(
            to=recipient['phone'],
            message=message,
            sender=sender,
            player=recipient.get('player'),
            adapter_config=adapter_config,
        )
        with lock:
            if log.status == 'sent':
                results['sent'] += 1
            else:
                results['failed'] += 1

    threads = []
    for r in recipients:
        t = threading.Thread(target=_send_one, args=(r,))
        threads.append(t)
        t.start()

    for t in threads:
        t.join(timeout=30)

    return results
