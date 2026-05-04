export const prerender = false;

import { readFileSync } from 'fs';
import { join } from 'path';

function loadEnvFile() {
    try {
        const envPath = join(process.cwd(), '.env');
        const content = readFileSync(envPath, 'utf-8');
        const vars = {};
        content.split('\n').forEach(line => {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) return;
            const eqIndex = trimmed.indexOf('=');
            if (eqIndex === -1) return;
            const key = trimmed.slice(0, eqIndex).trim();
            const value = trimmed.slice(eqIndex + 1).trim();
            vars[key] = value;
        });
        return vars;
    } catch (e) {
        return {};
    }
}

export const POST = async ({ request }) => {
    let name, email, message, website, formToken;

    try {
        const text = await request.text();
        const body = JSON.parse(text);
        name = body.name;
        email = body.email;
        message = body.message;
        website = body.website; // Honeypot
        formToken = body.form_token; // Timestamp
    } catch (e) {
        return new Response(
            JSON.stringify({ message: "Ungültige Anfrage." }),
            { status: 400, headers: { "Content-Type": "application/json" } }
        );
    }

    // SPAM PROTECTION CHECKS
    // 1. Honeypot check (website should be empty)
    // 2. Time-trap check (should take at least 3 seconds)
    const isSpam = website || (formToken && Date.now() - parseInt(formToken) < 3000);

    if (isSpam) {
        // We pretend it worked to not tip off the bot
        return new Response(
            JSON.stringify({ message: "Erfolgreich gesendet!" }),
            { status: 200, headers: { "Content-Type": "application/json" } }
        );
    }

    // Basic Validation
    if (!name || !email || !message) {
        return new Response(
            JSON.stringify({ message: "Bitte alle Felder ausfüllen!" }),
            { status: 400, headers: { "Content-Type": "application/json" } }
        );
    }

    // Read the webhook URL - try all available methods
    const env = loadEnvFile();
    const discordUrl = import.meta.env.DISCORD_WEBHOOK_URL
        || process.env.DISCORD_WEBHOOK_URL
        || env.DISCORD_WEBHOOK_URL;

    if (!discordUrl) {
        return new Response(
            JSON.stringify({ message: "Server-Konfiguration fehlt!" }),
            { status: 500, headers: { "Content-Type": "application/json" } }
        );
    }

    try {
        const response = await fetch(discordUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                username: "Studio Bot",
                content: "🚀 **Neue Studio-Anfrage erhalten!**",
                embeds: [
                    {
                        title: "Anfragedetails",
                        color: 9196287,
                        fields: [
                            { name: "👤 Name", value: name, inline: true },
                            { name: "📧 Email", value: email, inline: true },
                            { name: "📝 Nachricht", value: message },
                        ],
                        footer: { text: "RawTone Studio - Website Contact Form" },
                        timestamp: new Date().toISOString(),
                    },
                ],
            }),
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Discord API error: ${response.status} - ${errText}`);
        }

        return new Response(
            JSON.stringify({ message: "Erfolgreich gesendet!" }),
            { status: 200, headers: { "Content-Type": "application/json" } }
        );
    } catch (error) {
        return new Response(
            JSON.stringify({ message: `Senden fehlgeschlagen: ${error.message}` }),
            { status: 500, headers: { "Content-Type": "application/json" } }
        );
    }
};
