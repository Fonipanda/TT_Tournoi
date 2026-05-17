import logging
import smpplib
import smpplib.client
import smpplib.gsm
import smpplib.consts
from ..base import BaseSmsAdapter

logger = logging.getLogger('tournament.sms')


class SmppAdapter(BaseSmsAdapter):
    """Adaptateur SMPP - se connecte a un SMSC (SMPPSim ou reel)."""

    def send(self, to: str, message: str, sender: str = '') -> dict:
        host = self.config.get('host', '127.0.0.1')
        port = int(self.config.get('port', 2775))
        system_id = self.config.get('system_id', 'smppclient1')
        password = self.config.get('password', 'password')
        source_addr = sender or self.config.get('source_addr', 'TT_Tournoi')

        client = None
        try:
            client = smpplib.client.Client(host, port, allow_unknown_opt_params=True)
            client.connect()
            client.bind_transmitter(system_id=system_id, password=password)

            # Encode le message (GSM7 ou UCS2 si caracteres speciaux)
            parts, encoding_flag, msg_type_flag = smpplib.gsm.make_parts(message)

            msg_ids = []
            for part in parts:
                resp = client.send_message(
                    source_addr_ton=smpplib.consts.SMPP_TON_ALNUM,
                    source_addr_npi=smpplib.consts.SMPP_NPI_UNK,
                    source_addr=source_addr,
                    dest_addr_ton=smpplib.consts.SMPP_TON_INTL,
                    dest_addr_npi=smpplib.consts.SMPP_NPI_ISDN,
                    destination_addr=to,
                    short_message=part,
                    data_coding=encoding_flag,
                    esme_class=msg_type_flag,
                    registered_delivery=False,
                )
                if resp and hasattr(resp, 'message_id'):
                    msg_ids.append(resp.message_id.decode() if isinstance(resp.message_id, bytes) else str(resp.message_id))

            client.unbind()
            client.disconnect()

            msg_id = ','.join(msg_ids) if msg_ids else 'ok'
            logger.info(f"[SMS SMPP] Envoye a {to} via {host}:{port} (id={msg_id})")
            return {'success': True, 'message_id': msg_id, 'error': ''}

        except Exception as e:
            logger.error(f"[SMS SMPP] Erreur: {e}")
            if client:
                try:
                    client.disconnect()
                except Exception:
                    pass
            return {'success': False, 'message_id': '', 'error': str(e)}

    @classmethod
    def get_required_config_fields(cls) -> list:
        return [
            {'name': 'host', 'label': 'Hote SMSC', 'type': 'text', 'required': True, 'help_text': 'Adresse du serveur SMSC (ex: 127.0.0.1)'},
            {'name': 'port', 'label': 'Port SMSC', 'type': 'text', 'required': True, 'help_text': 'Port SMPP (defaut: 2775)'},
            {'name': 'system_id', 'label': 'System ID', 'type': 'text', 'required': True, 'help_text': 'Identifiant SMPP (ex: smppclient1)'},
            {'name': 'password', 'label': 'Mot de passe', 'type': 'password', 'required': True, 'help_text': 'Mot de passe SMPP'},
            {'name': 'source_addr', 'label': 'Expediteur par defaut', 'type': 'text', 'required': False, 'help_text': 'Adresse source (ex: TT_Tournoi)'},
        ]
