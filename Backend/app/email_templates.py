"""Reusable branded templates for transactional UniXchange email."""

from collections.abc import Mapping, Sequence
from typing import Optional
from urllib.parse import urlsplit
import html


def _text(value: object) -> str:
    return str(value if value is not None else "").strip()


def _message_paragraphs(message_paragraphs: Sequence[str]) -> list[str]:
    return [paragraph for item in message_paragraphs if (paragraph := _text(item))]


def _badge_colors(badge: str) -> tuple[str, str]:
    value = badge.lower()
    if any(word in value for word in ("success", "complete", "resolved", "approved", "verified", "fulfilled", "paid", "received")):
        return "#047857", "#d1fae5"
    if any(word in value for word in ("pending", "processing", "submitted", "progress", "waiting", "review")):
        return "#b45309", "#fef3c7"
    if any(word in value for word in ("failed", "rejected", "declined", "refunded")):
        return "#b91c1c", "#fee2e2"
    return "#0369a1", "#e0f2fe"


def _validated_action_url(value: object) -> str:
    url = _text(value)
    parsed = urlsplit(url)
    if parsed.netloc and parsed.scheme not in {"http", "https"}:
        raise ValueError("Email action buttons require an HTTP(S) or relative URL.")
    if parsed.scheme and (parsed.scheme not in {"http", "https"} or not parsed.netloc):
        raise ValueError("Email action buttons require an HTTP(S) or relative URL.")
    if not url:
        raise ValueError("Email action buttons require a URL.")
    return url


def _validated_image_url(value: object) -> str:
    url = _text(value)
    parsed = urlsplit(url)
    if parsed.scheme and (parsed.scheme not in {"http", "https"} or not parsed.netloc):
        raise ValueError("Email images require an HTTP(S) or relative URL.")
    if parsed.netloc and parsed.scheme not in {"http", "https"}:
        raise ValueError("Email images require an HTTP(S) or relative URL.")
    return url


def render_system_email(
    title: str,
    greeting: str,
    message_paragraphs: Sequence[str],
    badge: Optional[str] = None,
    details_table: Optional[Mapping[str, object]] = None,
    action_button: Optional[Mapping[str, str]] = None,
    image_url: Optional[str] = None,
) -> str:
    """Render a responsive, escaped UniXchange transactional email."""
    safe_title = html.escape(_text(title))
    safe_greeting = html.escape(_text(greeting))
    paragraphs = "".join(
        f'<p style="margin:0 0 16px;color:#334155;font-size:15px;line-height:1.65;">'
        f'{html.escape(paragraph).replace(chr(10), "<br>")}</p>'
        for paragraph in _message_paragraphs(message_paragraphs)
    )

    badge_html = ""
    if badge:
        safe_badge = html.escape(_text(badge))
        foreground, background = _badge_colors(_text(badge))
        badge_html = (
            f'<p style="margin:0 0 18px;"><span style="display:inline-block;'
            f'border-radius:999px;padding:6px 12px;background:{background};'
            f'color:{foreground};font-size:12px;font-weight:700;">{safe_badge}</span></p>'
        )

    details_html = ""
    if details_table:
        rows = "".join(
            '<tr>'
            f'<td style="padding:11px 12px;border-bottom:1px solid #e2e8f0;'
            f'color:#64748b;font-size:13px;font-weight:600;">{html.escape(_text(key))}</td>'
            f'<td style="padding:11px 12px;border-bottom:1px solid #e2e8f0;'
            f'color:#0f172a;font-size:13px;text-align:right;overflow-wrap:anywhere;">'
            f'{html.escape(_text(value))}</td>'
            '</tr>'
            for key, value in details_table.items()
        )
        if rows:
            details_html = (
                '<table role="presentation" cellpadding="0" cellspacing="0" '
                'style="width:100%;margin:22px 0;border:1px solid #e2e8f0;'
                'border-radius:8px;border-collapse:separate;border-spacing:0;overflow:hidden;">'
                f'<tbody>{rows}</tbody></table>'
            )

    action_html = ""
    if action_button:
        label = html.escape(_text(action_button.get("label")))
        url = html.escape(_validated_action_url(action_button.get("url")), quote=True)
        if not label:
            raise ValueError("Email action buttons require a label.")
        action_html = (
            '<div style="margin:26px 0 8px;text-align:center;">'
            f'<a href="{url}" style="display:inline-block;padding:13px 22px;'
            'border-radius:8px;background:#0284c7;color:#ffffff;font-size:14px;'
            'font-weight:700;text-decoration:none;">'
            f'{label}</a></div>'
        )

    badge_title = f'<h1 style="margin:0 0 12px;color:#0f172a;font-size:22px;line-height:1.3;">{safe_title}</h1>'
    image_html = ""
    if image_url:
        safe_image_url = html.escape(_validated_image_url(image_url), quote=True)
        image_html = (
            f'<img src="{safe_image_url}" alt="" '
            'style="width:100%;border-radius:12px;margin-bottom:16px;display:block;" />'
        )
    greeting_html = (
        f'<p style="margin:0 0 18px;color:#0f172a;font-size:16px;line-height:1.5;">'
        f'{safe_greeting}</p>'
        if safe_greeting else ""
    )
    return (
        '<!doctype html><html lang="en"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width,initial-scale=1">'
        f'<title>{safe_title}</title></head>'
        '<body style="margin:0;padding:28px 12px;background:#f8fafc;'
        'font-family:Arial,Helvetica,sans-serif;">'
        '<div style="width:100%;max-width:560px;margin:0 auto;">'
        '<div style="padding:22px 24px;border-radius:12px 12px 0 0;'
        'background:linear-gradient(120deg,#0284c7,#0369a1);">'
        '<div style="color:#ffffff;font-size:22px;font-weight:800;letter-spacing:.2px;">'
        'UniXchange</div></div>'
        '<main style="padding:28px 26px;background:#ffffff;border:1px solid #e2e8f0;'
        'border-top:0;border-radius:0 0 12px 12px;box-shadow:0 8px 24px rgba(15,23,42,.08);">'
        f'{image_html}{badge_title}{badge_html}{greeting_html}{paragraphs}{details_html}{action_html}'
        '<p style="margin:24px 0 0;padding-top:18px;border-top:1px solid #e2e8f0;'
        'color:#64748b;font-size:12px;line-height:1.6;">For your security, UniXchange will never ask you '
        'to share your password or verification codes by email.</p>'
        '</main>'
        '<p style="margin:16px 0 0;color:#64748b;font-size:11px;line-height:1.5;text-align:center;">'
        '© 2026 UniXchange Campus Marketplace. All rights reserved.</p>'
        '</div></body></html>'
    )


def render_system_email_text(
    title: str,
    greeting: str,
    message_paragraphs: Sequence[str],
    badge: Optional[str] = None,
    details_table: Optional[Mapping[str, object]] = None,
    action_button: Optional[Mapping[str, str]] = None,
) -> str:
    """Create the plain-text alternative using the same template content."""
    lines = [_text(title)]
    if badge:
        lines.append(f"Status: {_text(badge)}")
    if greeting:
        lines.extend(["", _text(greeting)])
    lines.extend(["", *_message_paragraphs(message_paragraphs)])
    if details_table:
        lines.extend(["", "Details:"])
        lines.extend(f"{_text(key)}: {_text(value)}" for key, value in details_table.items())
    if action_button:
        lines.extend(["", f'{_text(action_button.get("label"))}: {_validated_action_url(action_button.get("url"))}'])
    lines.extend([
        "",
        "For your security, UniXchange will never ask you to share your password or verification codes by email.",
        "© 2026 UniXchange Campus Marketplace. All rights reserved.",
    ])
    return "\n".join(lines)
