"""
Simulateur SMSC leger en Python - remplace SMPPSim (Java)
Ecoute sur le port SMPP (2775) et accepte les connexions SMPP.
Les SMS recus sont affiches en console.

Usage: python smsc_simulator.py
"""
import socket
import struct
import threading
import datetime
import sys

HOST = '127.0.0.1'
PORT = 2775
SYSTEM_ID = 'smppclient1'
PASSWORD = 'password'

# SMPP Command IDs
GENERIC_NACK = 0x80000000
BIND_RECEIVER = 0x00000001
BIND_RECEIVER_RESP = 0x80000001
BIND_TRANSMITTER = 0x00000002
BIND_TRANSMITTER_RESP = 0x80000002
BIND_TRANSCEIVER = 0x00000009
BIND_TRANSCEIVER_RESP = 0x80000009
SUBMIT_SM = 0x00000004
SUBMIT_SM_RESP = 0x80000004
ENQUIRE_LINK = 0x00000015
ENQUIRE_LINK_RESP = 0x80000015
UNBIND = 0x00000006
UNBIND_RESP = 0x80000006

msg_counter = 0
lock = threading.Lock()


def log(msg):
    ts = datetime.datetime.now().strftime('%H:%M:%S')
    print(f"[{ts}] {msg}")


def read_pdu(conn):
    """Lit un PDU SMPP depuis la socket."""
    header = b''
    while len(header) < 4:
        chunk = conn.recv(4 - len(header))
        if not chunk:
            return None
        header += chunk
    
    length = struct.unpack('>I', header)[0]
    if length < 16 or length > 65536:
        return None
    
    body = b''
    remaining = length - 4
    while len(body) < remaining:
        chunk = conn.recv(remaining - len(body))
        if not chunk:
            return None
        body += chunk
    
    command_id = struct.unpack('>I', body[0:4])[0]
    command_status = struct.unpack('>I', body[4:8])[0]
    sequence_number = struct.unpack('>I', body[8:12])[0]
    payload = body[12:]
    
    return {
        'length': length,
        'command_id': command_id,
        'command_status': command_status,
        'sequence_number': sequence_number,
        'payload': payload,
    }


def make_pdu(command_id, command_status, sequence_number, body=b''):
    """Construit un PDU SMPP."""
    length = 16 + len(body)
    header = struct.pack('>IIII', length, command_id, command_status, sequence_number)
    return header + body


def read_c_string(data, offset):
    """Lit une chaine C-string (null-terminated) depuis data[offset:]."""
    end = data.index(b'\x00', offset)
    return data[offset:end].decode('latin-1', errors='replace'), end + 1


def parse_submit_sm(payload):
    """Parse le PDU submit_sm pour extraire les infos du SMS."""
    try:
        offset = 0
        service_type, offset = read_c_string(payload, offset)
        source_addr_ton = payload[offset]; offset += 1
        source_addr_npi = payload[offset]; offset += 1
        source_addr, offset = read_c_string(payload, offset)
        dest_addr_ton = payload[offset]; offset += 1
        dest_addr_npi = payload[offset]; offset += 1
        destination_addr, offset = read_c_string(payload, offset)
        esm_class = payload[offset]; offset += 1
        protocol_id = payload[offset]; offset += 1
        priority_flag = payload[offset]; offset += 1
        schedule_delivery_time, offset = read_c_string(payload, offset)
        validity_period, offset = read_c_string(payload, offset)
        registered_delivery = payload[offset]; offset += 1
        replace_if_present_flag = payload[offset]; offset += 1
        data_coding = payload[offset]; offset += 1
        sm_default_msg_id = payload[offset]; offset += 1
        sm_length = payload[offset]; offset += 1
        short_message = payload[offset:offset + sm_length]
        
        # Decode message
        if data_coding == 8:  # UCS2
            text = short_message.decode('utf-16-be', errors='replace')
        else:
            text = short_message.decode('latin-1', errors='replace')
        
        return {
            'source': source_addr,
            'destination': destination_addr,
            'message': text,
            'data_coding': data_coding,
        }
    except Exception as e:
        return {'source': '?', 'destination': '?', 'message': f'[erreur parse: {e}]', 'data_coding': 0}


def handle_client(conn, addr):
    """Gere une connexion client SMPP."""
    global msg_counter
    log(f"Connexion depuis {addr}")
    bound = False
    
    try:
        while True:
            pdu = read_pdu(conn)
            if pdu is None:
                break
            
            cmd = pdu['command_id']
            seq = pdu['sequence_number']
            
            # Bind (transmitter, receiver, or transceiver)
            if cmd in (BIND_TRANSMITTER, BIND_RECEIVER, BIND_TRANSCEIVER):
                # Parse system_id and password from payload
                sys_id, offset = read_c_string(pdu['payload'], 0)
                pwd, offset = read_c_string(pdu['payload'], offset)
                
                if sys_id == SYSTEM_ID and pwd == PASSWORD:
                    resp_cmd = cmd + 0x80000000
                    body = SYSTEM_ID.encode() + b'\x00'
                    conn.send(make_pdu(resp_cmd, 0, seq, body))
                    bound = True
                    log(f"  BIND OK (system_id={sys_id})")
                else:
                    resp_cmd = cmd + 0x80000000
                    conn.send(make_pdu(resp_cmd, 0x0000000D, seq))  # ESME_RINVPASWD
                    log(f"  BIND REFUSE (system_id={sys_id}, password={pwd})")
                    break
            
            # Submit SM
            elif cmd == SUBMIT_SM and bound:
                sms = parse_submit_sm(pdu['payload'])
                with lock:
                    msg_counter += 1
                    msg_id = f"MSG{msg_counter:06d}"
                
                log(f"  {'='*50}")
                log(f"  SMS RECU (id={msg_id})")
                log(f"  De: {sms['source']}")
                log(f"  Vers: {sms['destination']}")
                log(f"  Message: {sms['message']}")
                log(f"  {'='*50}")
                
                # Repondre success
                body = msg_id.encode() + b'\x00'
                conn.send(make_pdu(SUBMIT_SM_RESP, 0, seq, body))
            
            # Enquire Link
            elif cmd == ENQUIRE_LINK:
                conn.send(make_pdu(ENQUIRE_LINK_RESP, 0, seq))
            
            # Unbind
            elif cmd == UNBIND:
                conn.send(make_pdu(UNBIND_RESP, 0, seq))
                log(f"  UNBIND de {addr}")
                break
            
            else:
                # Generic NACK pour commandes inconnues
                conn.send(make_pdu(GENERIC_NACK, 0x00000003, seq))
    
    except (ConnectionResetError, BrokenPipeError, OSError):
        pass
    finally:
        conn.close()
        log(f"Deconnexion de {addr}")


def main():
    print(f"""
╔══════════════════════════════════════════════════╗
║          SMSC Simulateur (Python)               ║
║   Equivalent de SMPPSim - pour tests SMS        ║
╠══════════════════════════════════════════════════╣
║  Port SMPP  : {PORT:<33}║
║  System ID  : {SYSTEM_ID:<33}║
║  Password   : {PASSWORD:<33}║
╚══════════════════════════════════════════════════╝
""")
    
    server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    server.bind((HOST, PORT))
    server.listen(5)
    
    log(f"SMSC en ecoute sur {HOST}:{PORT}")
    log("En attente de connexions SMPP...")
    log("")
    
    try:
        while True:
            conn, addr = server.accept()
            t = threading.Thread(target=handle_client, args=(conn, addr), daemon=True)
            t.start()
    except KeyboardInterrupt:
        log("Arret du simulateur SMSC")
        server.close()


if __name__ == '__main__':
    main()
