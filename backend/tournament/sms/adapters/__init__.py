from .test import TestAdapter
from .twilio_adapter import TwilioAdapter
from .ovh import OvhAdapter
from .free_mobile import FreeMobileAdapter
from .smpp import SmppAdapter

ADAPTER_REGISTRY = {
    'test': TestAdapter,
    'ovh': OvhAdapter,
    'twilio': TwilioAdapter,
    'free_mobile': FreeMobileAdapter,
    'smpp': SmppAdapter,
}


def get_adapter(adapter_type: str, config: dict):
    """Retourne une instance de l'adaptateur correspondant au type."""
    adapter_class = ADAPTER_REGISTRY.get(adapter_type)
    if not adapter_class:
        raise ValueError(f"Adaptateur SMS inconnu: {adapter_type}")
    return adapter_class(config)
