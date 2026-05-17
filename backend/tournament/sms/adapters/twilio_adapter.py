import logging
import requests
from requests.auth import HTTPBasicAuth
from ..base import BaseSmsAdapter

logger = logging.getLogger('tournament.sms')


class TwilioAdapter(BaseSmsAdapter):
    """Adaptateur Twilio SMS via API REST."""

    def send(self, to: str, message: str, sender: str = '') -> dict:
        account_sid = self.config.get('account_sid', '')
        auth_token = self.config.get('auth_token', '')
        from_number = sender or self.config.get('from_number', '')

        url = f"https://api.twilio.com/2010-04-01/Accounts/{account_sid}/Messages.json"
        try:
            resp = requests.post(
                url,
                data={'To': to, 'From': from_number, 'Body': message},
                auth=HTTPBasicAuth(account_sid, auth_token),
                timeout=15,
            )
            data = resp.json()
            if resp.status_code in (200, 201):
                return {'success': True, 'message_id': data.get('sid', ''), 'error': ''}
            else:
                error = data.get('message', str(resp.status_code))
                logger.error(f"[SMS Twilio] Erreur: {error}")
                return {'success': False, 'message_id': '', 'error': error}
        except Exception as e:
            logger.error(f"[SMS Twilio] Exception: {e}")
            return {'success': False, 'message_id': '', 'error': str(e)}

    @classmethod
    def get_required_config_fields(cls) -> list:
        return [
            {'name': 'account_sid', 'label': 'Account SID', 'type': 'text', 'required': True, 'help_text': 'Twilio Account SID'},
            {'name': 'auth_token', 'label': 'Auth Token', 'type': 'password', 'required': True, 'help_text': 'Twilio Auth Token'},
            {'name': 'from_number', 'label': 'Numero expediteur', 'type': 'text', 'required': True, 'help_text': 'Numero Twilio (ex: +33612345678)'},
        ]
