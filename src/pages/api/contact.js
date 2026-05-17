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
    let name, email, message, website, formToken, songFile, services;

    try {
        const data = await request.formData();
        name = data.get("name");
        email = data.get("email");
        message = data.get("message");
        website = data.get("website");
        formToken = data.get("form_token");
        songFile = data.get("song_demo");
        services = data.getAll("services");
    } catch (e) {
        return new Response(
            JSON.stringify({ message: "Ungültige Anfrage (FormData Fehler)." }),
            { status: 400, headers: { "Content-Type": "application/json" } }
        );
    }

    // SPAM PROTECTION
    const isSpam = website || (formToken && Date.now() - parseInt(formToken) < 3000);
    if (isSpam) {
        return new Response(JSON.stringify({ message: "Erfolgreich gesendet!" }), { status: 200, headers: { "Content-Type": "application/json" } });
    }

    if (!name || !email || !message) {
        return new Response(JSON.stringify({ message: "Bitte alle Felder ausfüllen!" }), { status: 400, headers: { "Content-Type": "application/json" } });
    }

    const env = loadEnvFile();
    const discordUrl = import.meta.env.DISCORD_WEBHOOK_URL || process.env.DISCORD_WEBHOOK_URL || env.DISCORD_WEBHOOK_URL;

    if (!discordUrl) {
        return new Response(JSON.stringify({ message: "Server-Konfiguration fehlt!" }), { status: 500, headers: { "Content-Type": "application/json" } });
    }

    try {
        // Prepare Discord Payload
        const priceMap = {
            "Mixing": 50,
            "Mastering": 30,
            "Beat Production": 100,
            "Asset Creation": 15
        };
        const total = services.reduce((acc, s) => acc + (priceMap[s] || 0), 0);

        const discordFormData = new FormData();
        const payload = {
            username: "Studio Bot",
            content: "🚀 **Neue Studio-Anfrage!**",
            embeds: [
                {
                    title: "Anfragedetails",
                    color: 9196287,
                    fields: [
                        { name: "👤 Name", value: name, inline: true },
                        { name: "📧 Email", value: email, inline: true },
                        { name: "💰 Preisvoranschlag", value: `${total}€`, inline: true },
                        { name: "🛠️ Services", value: services.length > 0 ? services.join(", ") : "Keine ausgewählt" },
                        { name: "📝 Nachricht", value: message },
                        { name: "🎵 Demo", value: songFile && songFile.size > 0 ? `Datei: ${songFile.name}` : "Keine Datei angehängt" }
                    ],
                    footer: { text: "Rawlabs Studios - Website Contact Form" },
                    timestamp: new Date().toISOString(),
                },
            ],
        };

        discordFormData.append('payload_json', JSON.stringify(payload));

        // Add file if exists
        if (songFile && songFile.size > 0) {
            discordFormData.append('files[0]', songFile, songFile.name);
        }

        const response = await fetch(discordUrl, {
            method: "POST",
            body: discordFormData
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Discord API error: ${response.status} - ${errText}`);
        }

        return new Response(JSON.stringify({ message: "Erfolgreich gesendet!" }), { status: 200, headers: { "Content-Type": "application/json" } });
    } catch (error) {
        return new Response(JSON.stringify({ message: `Senden fehlgeschlagen: ${error.message}` }), { status: 500, headers: { "Content-Type": "application/json" } });
    }
};
