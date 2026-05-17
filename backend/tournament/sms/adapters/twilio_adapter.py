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
        from_number = self.config.get('from_number', '')
        messaging_service_sid = self.config.get('messaging_service_sid', '')

        url = f"https://api.twilio.com/2010-04-01/Accounts/{account_sid}/Messages.json"
        data = {'To': to, 'Body': message}
        
        # Use MessagingServiceSid if available, otherwise From number
        if messaging_service_sid:
            data['MessagingServiceSid'] = messaging_service_sid
        elif from_number:
            data['From'] = from_number

        try:
            resp = requests.post(
                url,
                data=data,
                auth=HTTPBasicAuth(account_sid, auth_token),
                timeout=15,
            )
            result = resp.json()
            if resp.status_code in (200, 201):
                return {'success': True, 'message_id': result.get('sid', ''), 'error': ''}
            else:
                error = result.get('message', str(resp.status_code))
                logger.error(f"[SMS Twilio] Erreur: {error}")
                return {'success': False, 'message_id': '', 'error': error}
        except Exception as e:
            logger.error(f"[SMS Twilio] Exception: {e}")
            return {'success': False, 'message_id': '', 'error': str(e)}

    @classmethod
    def get_required_config_fields(cls) -> list:
        return [
            {'name': 'account_sid', 'label': 'Account SID', 'type': 'text', 'required': True, 'help_text': 'Twilio Account SID (ACxxxxxxx)'},
            {'name': 'auth_token', 'label': 'Auth Token', 'type': 'password', 'required': True, 'help_text': 'Twilio Auth Token'},
            {'name': 'messaging_service_sid', 'label': 'Messaging Service SID', 'type': 'text', 'required': False, 'help_text': 'SID du service de messagerie (MGxxxxxxx) - recommande pour trial'},
            {'name': 'from_number', 'label': 'Numero expediteur', 'type': 'text', 'required': False, 'help_text': 'Numero Twilio (ex: +15017122661) - alternatif au Messaging Service'},
        ]
