import smtplib
import os
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

SMTP_HOST = os.getenv("SMTP_HOST", "smtp-relay.brevo.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
SMTP_FROM_EMAIL = os.getenv("SMTP_FROM_EMAIL", SMTP_USER)
PLATFORM_NAME = os.getenv("PLATFORM_NAME", "HydroVision MALOPS")
PLATFORM_URL = os.getenv("PLATFORM_URL", "http://localhost:3000")


def send_welcome_email(to_email: str, full_name: str, username: str, password: str) -> bool:
    if not SMTP_USER or not SMTP_PASSWORD:
        return False

    display_name = full_name.strip() if full_name else username

    html = f"""
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
</head>
<body style="margin:0;padding:0;background-color:#f4f6f9;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#2d6a4f,#40916c);padding:36px 40px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:26px;font-weight:700;letter-spacing:1px;">
                {PLATFORM_NAME}
              </h1>
              <p style="margin:8px 0 0;color:rgba(255,255,255,0.8);font-size:13px;letter-spacing:0.5px;">
                Plateforme MLOps de Prédiction du Stress Hydrique
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px 40px 32px;">
              <p style="margin:0 0 16px;font-size:16px;color:#1f2937;font-weight:600;">
                Bonjour {display_name},
              </p>
              <p style="margin:0 0 24px;font-size:15px;color:#4b5563;line-height:1.7;">
                Votre compte a été créé avec succès sur la plateforme <strong>{PLATFORM_NAME}</strong>.
                Vous trouverez ci-dessous vos informations de connexion. Veuillez les conserver en lieu sûr.
              </p>

              <!-- Credentials box -->
              <table width="100%" cellpadding="0" cellspacing="0"
                     style="background:#f0fdf4;border:1px solid #86efac;border-radius:8px;margin-bottom:28px;">
                <tr>
                  <td style="padding:24px 28px;">
                    <p style="margin:0 0 4px;font-size:12px;font-weight:700;color:#166534;text-transform:uppercase;letter-spacing:0.8px;">
                      Vos identifiants de connexion
                    </p>
                    <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:14px;">
                      <tr>
                        <td style="padding:7px 0;width:150px;">
                          <span style="font-size:13px;color:#6b7280;font-weight:500;">Nom d'utilisateur</span>
                        </td>
                        <td style="padding:7px 0;">
                          <span style="font-size:15px;color:#111827;font-weight:700;font-family:monospace;">
                            {username}
                          </span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:7px 0;">
                          <span style="font-size:13px;color:#6b7280;font-weight:500;">Mot de passe</span>
                        </td>
                        <td style="padding:7px 0;">
                          <span style="font-size:15px;color:#111827;font-weight:700;font-family:monospace;">
                            {password}
                          </span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                <tr>
                  <td align="center">
                    <a href="{PLATFORM_URL}/login"
                       style="display:inline-block;background:linear-gradient(135deg,#2d6a4f,#40916c);
                              color:#ffffff;text-decoration:none;padding:14px 36px;
                              border-radius:8px;font-size:15px;font-weight:600;letter-spacing:0.3px;">
                      Accéder à la plateforme
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Security note -->
              <table width="100%" cellpadding="0" cellspacing="0"
                     style="background:#fffbeb;border:1px solid #fcd34d;border-radius:8px;margin-bottom:24px;">
                <tr>
                  <td style="padding:16px 20px;">
                    <p style="margin:0;font-size:13px;color:#92400e;line-height:1.6;">
                      ⚠️ <strong>Important :</strong> Pour des raisons de sécurité, nous vous recommandons
                      de changer votre mot de passe dès votre première connexion. Ne partagez jamais
                      vos identifiants avec d'autres personnes.
                    </p>
                  </td>
                </tr>
              </table>

              <p style="margin:0;font-size:14px;color:#6b7280;line-height:1.7;">
                Si vous avez des questions ou besoin d'assistance, n'hésitez pas à contacter
                votre administrateur système.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:20px 40px;text-align:center;">
              <p style="margin:0;font-size:12px;color:#9ca3af;">
                © 2025 {PLATFORM_NAME} — Cet email a été envoyé automatiquement, merci de ne pas y répondre.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
"""

    msg = MIMEMultipart("alternative")
    msg["Subject"] = f"[{PLATFORM_NAME}] Vos identifiants de connexion"
    msg["From"] = f"{PLATFORM_NAME} <{SMTP_FROM_EMAIL}>"
    msg["To"] = to_email
    msg.attach(MIMEText(html, "html", "utf-8"))

    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.ehlo()
            server.starttls()
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.sendmail(SMTP_FROM_EMAIL, to_email, msg.as_string())
        return True
    except Exception as e:
        print(f"[email_service] Échec envoi email vers {to_email}: {e}")
        return False
