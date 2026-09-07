"""Diagnose Gmail SMTP connectivity and authentication on ports 465 and 587.

This script does not send an email unless --send-to is provided. It loads
SENDER_EMAIL and SENDER_PASSWORD from Backend/.env or the environment.
"""

from __future__ import annotations

import argparse
import os
import smtplib
import socket
import ssl
import sys
from email.mime.text import MIMEText
from pathlib import Path

from dotenv import load_dotenv


SMTP_HOST = "smtp.gmail.com"
SMTP_TIMEOUT = 10
BACKEND_DIR = Path(__file__).resolve().parent
load_dotenv(BACKEND_DIR / ".env")


def log(message: str) -> None:
    print(f"[SMTP TEST] {message}", flush=True)


def test_port_465(sender_email: str, sender_password: str, recipient: str | None) -> bool:
    log("Port 465: opening implicit TLS connection...")
    try:
        context = ssl.create_default_context()
        with smtplib.SMTP_SSL(
            SMTP_HOST,
            465,
            timeout=SMTP_TIMEOUT,
            context=context,
        ) as server:
            log("Port 465: TCP/TLS connection established.")
            log("Port 465: sending EHLO...")
            server.ehlo()
            log("Port 465: authenticating with Gmail...")
            server.login(sender_email, sender_password)
            log("Port 465: authentication succeeded.")
            if recipient:
                send_test_message(server, sender_email, recipient, "465")
        return True
    except (smtplib.SMTPException, socket.timeout, TimeoutError, OSError) as error:
        log(f"Port 465: FAILED - {type(error).__name__}: {error}")
        return False


def test_port_587(sender_email: str, sender_password: str, recipient: str | None) -> bool:
    log("Port 587: opening plain SMTP connection...")
    try:
        with smtplib.SMTP(SMTP_HOST, 587, timeout=SMTP_TIMEOUT) as server:
            log("Port 587: TCP connection established.")
            log("Port 587: sending EHLO before STARTTLS...")
            server.ehlo()
            log("Port 587: upgrading connection with STARTTLS...")
            server.starttls(context=ssl.create_default_context())
            log("Port 587: TLS session established.")
            log("Port 587: sending EHLO after STARTTLS...")
            server.ehlo()
            log("Port 587: authenticating with Gmail...")
            server.login(sender_email, sender_password)
            log("Port 587: authentication succeeded.")
            if recipient:
                send_test_message(server, sender_email, recipient, "587")
        return True
    except (smtplib.SMTPException, socket.timeout, TimeoutError, OSError) as error:
        log(f"Port 587: FAILED - {type(error).__name__}: {error}")
        return False


def send_test_message(server: smtplib.SMTP, sender_email: str, recipient: str, port: str) -> None:
    message = MIMEText(f"SMTP diagnostic test from Campus Marketplace via port {port}.")
    message["Subject"] = f"Campus Marketplace SMTP diagnostic (port {port})"
    message["From"] = sender_email
    message["To"] = recipient
    log(f"Port {port}: sending diagnostic email to {recipient}...")
    server.sendmail(sender_email, recipient, message.as_string())
    log(f"Port {port}: diagnostic email accepted by Gmail.")


def main() -> int:
    parser = argparse.ArgumentParser(description="Test Gmail SMTP ports 465 and 587.")
    parser.add_argument(
        "--send-to",
        help="Optional recipient address. Without this option, the script only tests connectivity and authentication.",
    )
    args = parser.parse_args()

    sender_email = os.getenv("SENDER_EMAIL", "").strip()
    sender_password = os.getenv("SENDER_PASSWORD", "").strip().replace(" ", "")
    if not sender_email or not sender_password:
        log("ERROR: SENDER_EMAIL and SENDER_PASSWORD must be set in Backend/.env or the environment.")
        return 2

    log(f"Testing Gmail SMTP host {SMTP_HOST} with a {SMTP_TIMEOUT}-second timeout.")
    log(f"Using sender account: {sender_email}")
    log("The App Password is intentionally not displayed.")

    port_465_ok = test_port_465(sender_email, sender_password, args.send_to)
    port_587_ok = test_port_587(sender_email, sender_password, args.send_to)

    log(f"Summary: port 465={'OPEN/AUTHENTICATED' if port_465_ok else 'FAILED'}; port 587={'OPEN/AUTHENTICATED' if port_587_ok else 'FAILED'}.")
    return 0 if port_465_ok or port_587_ok else 1


if __name__ == "__main__":
    sys.exit(main())
