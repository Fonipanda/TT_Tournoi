from abc import ABC, abstractmethod


class BaseSmsAdapter(ABC):
    """Classe abstraite pour les adaptateurs SMS, inspiree de RaspSMS."""

    def __init__(self, config: dict):
        self.config = config

    @abstractmethod
    def send(self, to: str, message: str, sender: str = '') -> dict:
        """Envoie un SMS. Retourne {success: bool, message_id: str, error: str}."""
        pass

    @classmethod
    @abstractmethod
    def get_required_config_fields(cls) -> list:
        """Retourne la liste des champs requis pour la config.
        Chaque element: {name, label, type, required, help_text}
        """
        pass

    def validate_config(self) -> list:
        """Valide la config. Retourne une liste d'erreurs (vide = OK)."""
        errors = []
        for field in self.get_required_config_fields():
            if field.get('required', True) and not self.config.get(field['name']):
                errors.append(f"Le champ '{field['label']}' est requis")
        return errors
