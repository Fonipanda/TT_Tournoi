import logging
import requests
from ..base import BaseSmsAdapter

logger = logging.getLogger('tournament.sms')


class FreeMobileAdapter(BaseSmsAdapter):
    """Adaptateur Free Mobile - notifications SMS personnelles."""

    def send(self, to: str, message: str, sender: str = '') -> dict:
        user = self.config.get('user', '')
        password = self.config.get('pass', '')

        url = "https://smsapi.free-mobile.fr/sendmsg"
        try:
            resp = requests.get(
                url,
                params={'user': user, 'pass': password, 'msg': message},
                timeout=15,
            )
            if resp.status_code == 200:
                return {'success': True, 'message_id': '', 'error': ''}
            else:
                error = f"HTTP {resp.status_code}"
                logger.error(f"[SMS Free Mobile] Erreur: {error}")
                return {'success': False, 'message_id': '', 'error': error}
        except Exception as e:
            logger.error(f"[SMS Free Mobile] Exception: {e}")
            return {'success': False, 'message_id': '', 'error': str(e)}

    @classmethod
    def get_required_config_fields(cls) -> list:
        return [
            {'name': 'user', 'label': 'Identifiant', 'type': 'text', 'required': True, 'help_text': 'Identifiant Free Mobile'},
            {'name': 'pass', 'label': 'Cle API', 'type': 'password', 'required': True, 'help_text': 'Cle d\'identification serveur'},
        ]
