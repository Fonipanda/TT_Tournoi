from django.db import migrations


def create_defaults(apps, schema_editor):
    SmsTemplate = apps.get_model('tournament', 'SmsTemplate')
    SmsAdapterConfig = apps.get_model('tournament', 'SmsAdapterConfig')

    SmsTemplate.objects.get_or_create(
        name='Assignation table',
        defaults={'content': 'Bonjour {joueur}, votre match est pret ! Rendez-vous table {table} ({salle}) pour le {tableau}. Adversaire : {adversaire}', 'is_active': True},
    )
    SmsTemplate.objects.get_or_create(
        name='Convocation',
        defaults={'content': 'Bonjour {joueur}, vous etes convoque(e) pour le {tableau}. Presentez-vous au secretariat.', 'is_active': True},
    )
    SmsTemplate.objects.get_or_create(
        name='Information generale',
        defaults={'content': '{message}', 'is_active': True},
    )

    SmsAdapterConfig.objects.get_or_create(
        name='Test (Console)',
        defaults={'adapter_type': 'test', 'config': {}, 'is_active': True},
    )


def reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('tournament', '0012_sms_models'),
    ]

    operations = [
        migrations.RunPython(create_defaults, reverse),
    ]
