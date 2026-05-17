import logging
import uuid
from ..base import BaseSmsAdapter

logger = logging.getLogger('tournament.sms')


class TestAdapter(BaseSmsAdapter):
    """Adaptateur de test - log les SMS en console sans les envoyer."""

    def send(self, to: str, message: str, sender: str = '') -> dict:
        msg_id = str(uuid.uuid4())[:8]
        logger.info(
            f"[SMS TEST] id={msg_id} | de={sender or 'N/A'} | vers={to} | message={message}"
        )
        return {'success': True, 'message_id': msg_id, 'error': ''}

    @classmethod
    def get_required_config_fields(cls) -> list:
        return []
