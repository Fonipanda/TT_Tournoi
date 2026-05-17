import hashlib
import time
import logging
import requests
from ..base import BaseSmsAdapter

logger = logging.getLogger('tournament.sms')


class OvhAdapter(BaseSmsAdapter):
    """Adaptateur OVH SMS."""

    def send(self, to: str, message: str, sender: str = '') -> dict:
        app_key = self.config.get('application_key', '')
        app_secret = self.config.get('application_secret', '')
        consumer_key = self.config.get('consumer_key', '')
        service_name = self.config.get('service_name', '')
        sender_name = sender or self.config.get('sender_name', '')

        url = f"https://eu.api.ovh.com/1.0/sms/{service_name}/jobs"
        body = {
            'message': message,
            'receivers': [to],
            'noStopClause': True,
            'priority': 'high',
            'charset': 'UTF-8',
        }
        if sender_name:
            body['sender'] = sender_name

        timestamp = str(int(time.time()))
        method = 'POST'
        import json
        body_str = json.dumps(body)
        pre_hash = f"{app_secret}+{consumer_key}+{method}+{url}+{body_str}+{timestamp}"
        signature = '$1$' + hashlib.sha1(pre_hash.encode('utf-8')).hexdigest()

        headers = {
            'Content-Type': 'application/json',
            'X-Ovh-Application': app_key,
            'X-Ovh-Consumer': consumer_key,
            'X-Ovh-Timestamp': timestamp,
            'X-Ovh-Signature': signature,
        }

        try:
            resp = requests.post(url, json=body, headers=headers, timeout=15)
            data = resp.json()
            if resp.status_code == 200:
                ids = data.get('ids', [])
                return {'success': True, 'message_id': str(ids[0]) if ids else '', 'error': ''}
            else:
                error = data.get('message', str(resp.status_code))
                logger.error(f"[SMS OVH] Erreur: {error}")
                return {'success': False, 'message_id': '', 'error': error}
        except Exception as e:
            logger.error(f"[SMS OVH] Exception: {e}")
            return {'success': False, 'message_id': '', 'error': str(e)}

    @classmethod
    def get_required_config_fields(cls) -> list:
        return [
            {'name': 'application_key', 'label': 'Application Key', 'type': 'text', 'required': True, 'help_text': 'Cle d\'application OVH'},
            {'name': 'application_secret', 'label': 'Application Secret', 'type': 'password', 'required': True, 'help_text': 'Secret d\'application OVH'},
            {'name': 'consumer_key', 'label': 'Consumer Key', 'type': 'password', 'required': True, 'help_text': 'Cle consommateur OVH'},
            {'name': 'service_name', 'label': 'Nom du service', 'type': 'text', 'required': True, 'help_text': 'Nom du service SMS OVH (ex: sms-xx12345-1)'},
            {'name': 'sender_name', 'label': 'Expediteur', 'type': 'text', 'required': False, 'help_text': 'Nom expediteur (optionnel)'},
        ]
