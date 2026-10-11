# Password-reset email delivery using HTTPS (Resend) with SMTP fallback.
import json
import os
import smtplib
from email.message import EmailMessage
from html import escape
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

RESEND_ENDPOINT = "https://api.resend.com/emails"


def send_reset_email(email: str, reset_token: str, expires_minutes: int = 30) -> bool:
    # Return False only when no provider or frontend URL is configured.
    frontend_url = os.getenv("FRONTEND_URL", "").strip().rstrip("/")
    resend_api_key = os.getenv("RESEND_API_KEY", "").strip()
    resend_from = os.getenv("RESEND_FROM", "").strip()
    if not frontend_url:
        return False

    # Root URL avoids depending on a static-host rewrite for /reset-password.
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

    # Prefer HTTPS API on Render; free Render services block outbound SMTP ports.
    if resend_api_key and resend_from:
        payload = {
            "from": resend_from, "to": [email], "subject": subject,
            "text": text_body, "html": html_body,
        }
        req = Request(
            RESEND_ENDPOINT,
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Authorization": f"Bearer {resend_api_key}",
                "Content-Type": "application/json",
            },
            method="POST",
        )
        try:
            with urlopen(req, timeout=15) as response:
                status = getattr(response, "status", 200)
                if not 200 <= status < 300:
                    raise RuntimeError(f"Resend email API returned HTTP {status}")
                response.read()
            return True
        except HTTPError as exc:
            raise RuntimeError(f"Resend email API returned HTTP {exc.code}") from None
        except URLError as exc:
            raise RuntimeError(
                f"Resend email API connection failed ({type(exc.reason).__name__})"
            ) from None
        except TimeoutError:
            raise RuntimeError("Resend email API request timed out") from None

    # Optional SMTP fallback for local development or SMTP-enabled hosting.
    smtp_host = os.getenv("SMTP_HOST", "").strip()
    smtp_user = os.getenv("SMTP_USER", "").strip()
    smtp_password = os.getenv("SMTP_PASSWORD", "")
    smtp_from = os.getenv("SMTP_FROM", smtp_user).strip()
    if smtp_host and smtp_user and smtp_password and smtp_from:
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
    return False
