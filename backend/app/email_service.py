# Password-reset delivery: HTTPS providers first, SMTP only as a fallback.
# Gmail API sends from a personal Gmail account without a custom sending domain.
import base64
import json
import os
import smtplib
from email.message import EmailMessage
from html import escape
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

RESEND_ENDPOINT = "https://api.resend.com/emails"
GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token"
GMAIL_SEND_ENDPOINT = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send"


def _request_json(url: str, payload: dict, headers: dict | None = None) -> dict:
    request_headers = {"Content-Type": "application/json", **(headers or {})}
    req = Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers=request_headers,
        method="POST",
    )
    try:
        with urlopen(req, timeout=15) as response:
            status = getattr(response, "status", 200)
            if not 200 <= status < 300:
                raise RuntimeError(f"HTTP request failed (HTTP {status})")
            raw = response.read()
        return json.loads(raw.decode("utf-8") or "{}")
    except HTTPError as exc:
        raise RuntimeError(f"HTTPS email provider returned HTTP {exc.code}") from None
    except URLError as exc:
        raise RuntimeError(
            f"HTTPS email provider connection failed ({type(exc.reason).__name__})"
        ) from None
    except TimeoutError:
        raise RuntimeError("HTTPS email provider request timed out") from None


def _send_via_resend(email: str, subject: str, text_body: str, html_body: str) -> bool:
    api_key = os.getenv("RESEND_API_KEY", "").strip()
    sender = os.getenv("RESEND_FROM", "").strip()
    if not (api_key and sender):
        return False
    _request_json(
        RESEND_ENDPOINT,
        {"from": sender, "to": [email], "subject": subject, "text": text_body, "html": html_body},
        {"Authorization": f"Bearer {api_key}"},
    )
    return True


def _send_via_gmail_api(email: str, subject: str, text_body: str, html_body: str) -> bool:
    client_id = os.getenv("GMAIL_CLIENT_ID", "").strip()
    client_secret = os.getenv("GMAIL_CLIENT_SECRET", "").strip()
    refresh_token = os.getenv("GMAIL_REFRESH_TOKEN", "").strip()
    sender = (os.getenv("GMAIL_SENDER_EMAIL") or os.getenv("SMTP_FROM") or os.getenv("SMTP_USER") or "").strip()
    if not all((client_id, client_secret, refresh_token, sender)):
        return False

    token_request = Request(
        GOOGLE_TOKEN_ENDPOINT,
        data=urlencode({
            "client_id": client_id,
            "client_secret": client_secret,
            "refresh_token": refresh_token,
            "grant_type": "refresh_token",
        }).encode("utf-8"),
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        method="POST",
    )
    try:
        with urlopen(token_request, timeout=15) as response:
            token_data = json.loads(response.read().decode("utf-8") or "{}")
    except HTTPError as exc:
        raise RuntimeError(f"Gmail OAuth token refresh failed (HTTP {exc.code})") from None
    except URLError as exc:
        raise RuntimeError(
            f"Gmail OAuth connection failed ({type(exc.reason).__name__})"
        ) from None
    except TimeoutError:
        raise RuntimeError("Gmail OAuth request timed out") from None

    access_token = str(token_data.get("access_token", "")).strip()
    if not access_token:
        raise RuntimeError("Gmail OAuth token response did not include an access token")

    message = EmailMessage()
    message["To"] = email
    message["From"] = sender
    message["Subject"] = subject
    message.set_content(text_body)
    message.add_alternative(html_body, subtype="html")
    raw_message = base64.urlsafe_b64encode(message.as_bytes()).decode("ascii").rstrip("=")
    _request_json(
        GMAIL_SEND_ENDPOINT,
        {"raw": raw_message},
        {"Authorization": f"Bearer {access_token}"},
    )
    return True


def send_reset_email(email: str, reset_token: str, expires_minutes: int = 30) -> bool:
    frontend_url = os.getenv("FRONTEND_URL", "").strip().rstrip("/")
    if not frontend_url:
        return False

    reset_link = f"{frontend_url}/?token={reset_token}"
    subject = "VELOOP Rewards — Password Reset"
    text_body = (
        "We received a request to reset your VELOOP Rewards password.\n\n"
        f"Reset your password here:\n{reset_link}\n\n"
        f"This link expires in {int(expires_minutes)} minutes.\n"
        "If you did not request this, you can safely ignore this email."
    )
    html_body = (
        "<p>We received a request to reset your VELOOP Rewards password.</p>"
        f'<p><a href="{escape(reset_link, quote=True)}">Reset your password</a></p>'
        f"<p>This link expires in {int(expires_minutes)} minutes.</p>"
        "<p>If you did not request this, you can safely ignore this email.</p>"
    )

    # Keep support for an already-configured Resend provider, but it is optional.
    if _send_via_resend(email, subject, text_body, html_body):
        return True

    # Preferred no-custom-domain option for Render: Gmail API over HTTPS.
    if _send_via_gmail_api(email, subject, text_body, html_body):
        return True

    # SMTP is retained for local development/hosts that permit outbound SMTP.
    smtp_host = os.getenv("SMTP_HOST", "").strip()
    smtp_user = os.getenv("SMTP_USER", "").strip()
    smtp_password = os.getenv("SMTP_PASSWORD", "")
    smtp_from = os.getenv("SMTP_FROM", smtp_user).strip()
    if not (smtp_host and smtp_user and smtp_password and smtp_from):
        return False
    try:
        smtp_port = int(os.getenv("SMTP_PORT", "587"))
    except ValueError:
        raise RuntimeError("SMTP_PORT must be a valid integer") from None

    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = smtp_from
    message["To"] = email
    message.set_content(text_body)
    message.add_alternative(html_body, subtype="html")
    try:
        if smtp_port == 465:
            with smtplib.SMTP_SSL(smtp_host, smtp_port, timeout=15) as server:
                server.login(smtp_user, smtp_password)
                server.send_message(message)
        else:
            with smtplib.SMTP(smtp_host, smtp_port, timeout=15) as server:
                server.ehlo()
                server.starttls()
                server.ehlo()
                server.login(smtp_user, smtp_password)
                server.send_message(message)
        return True
    except (OSError, smtplib.SMTPException) as exc:
        raise RuntimeError(
            f"SMTP email delivery failed ({type(exc).__name__})"
        ) from None
