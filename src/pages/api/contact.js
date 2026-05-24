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
    let name, email, message, website, formToken, songFile, selectedPackage, addons, additionalSongs;

    try {
        const data = await request.formData();
        name = data.get("name");
        email = data.get("email");
        message = data.get("message");
        website = data.get("website");
        formToken = data.get("form_token");
        songFile = data.get("song_demo");
        selectedPackage = data.get("package");
        addons = data.getAll("addons");
        additionalSongs = parseInt(data.get("additional_songs") || 0);
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
    const invoiceNinjaUrl = import.meta.env.INVOICE_NINJA_URL || process.env.INVOICE_NINJA_URL || env.INVOICE_NINJA_URL;
    const invoiceNinjaToken = import.meta.env.INVOICE_NINJA_TOKEN || process.env.INVOICE_NINJA_TOKEN || env.INVOICE_NINJA_TOKEN;

    if (!discordUrl) {
        return new Response(JSON.stringify({ message: "Server-Konfiguration fehlt!" }), { status: 500, headers: { "Content-Type": "application/json" } });
    }

    try {
        // Prepare Discord Payload
        const packagePriceMap = new Map([
            ["Raw Labs Essentials", 30],
            ["Raw Labs Advanced", 60],
            ["Raw Labs Ultimate", 150]
        ]);
        
        const addonPriceMap = new Map([
            ["Express Lieferung (48h)", 20]
        ]);

        let total = 0;
        let packagePrice = 0;
        let totalSongs = 1 + additionalSongs;
        let songsSubtotal = 0;
        let addonsSubtotal = 0;
        
        if (selectedPackage && packagePriceMap.has(selectedPackage)) {
            packagePrice = packagePriceMap.get(selectedPackage);
            songsSubtotal = packagePrice * totalSongs;
        }
        
        addons.forEach(addon => {
            if (addon && addonPriceMap.has(addon)) {
                if (addon === "Express Lieferung (48h)") {
                    addonsSubtotal += addonPriceMap.get(addon) * totalSongs;
                } else {
                    addonsSubtotal += addonPriceMap.get(addon);
                }
            }
        });
        
        let discountPct = 0;
        if (totalSongs >= 5) discountPct = 0.20;
        else if (totalSongs >= 3) discountPct = 0.15;
        else if (totalSongs == 2) discountPct = 0.05;
        
        let discountValue = 0;
        if (discountPct > 0) {
            discountValue = Math.round(songsSubtotal * discountPct);
        }
        
        total = songsSubtotal - discountValue + addonsSubtotal;

        // --- INVOICE NINJA INTEGRATION ---
        let quoteUrl = "";
        let quoteNumber = "";
        
        if (invoiceNinjaUrl && invoiceNinjaToken) {
            try {
                // 1. Create Client
                const clientRes = await fetch(`${invoiceNinjaUrl}/api/v1/clients`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Api-Token': invoiceNinjaToken,
                        'X-Requested-With': 'XMLHttpRequest'
                    },
                    body: JSON.stringify({
                        name: name,
                        contacts: [{ email: email }]
                    })
                });
                
                if (clientRes.ok) {
                    const clientData = await clientRes.json();
                    const clientId = clientData.data.id;
                    
                    // 2. Prepare Line Items
                    const lineItems = [];
                    
                    // Map packages to specific Invoice Ninja Product Keys
                    const productKeyMap = new Map([
                        ["Raw Labs Essentials", "pkg_essentials"],
                        ["Raw Labs Advanced", "pkg_advanced"],
                        ["Raw Labs Ultimate", "pkg_ultimate"]
                    ]);
                    
                    let payloadDiscount = 0;
                    if (totalSongs >= 5) payloadDiscount = 20;
                    else if (totalSongs >= 3) payloadDiscount = 15;
                    else if (totalSongs == 2) payloadDiscount = 5;

                    if (selectedPackage && packagePrice > 0) {
                        lineItems.push({
                            product_key: productKeyMap.get(selectedPackage) || selectedPackage,
                            notes: "Studio Paket",
                            cost: packagePrice,
                            qty: totalSongs,
                            discount: payloadDiscount > 0 ? payloadDiscount : 0,
                            is_amount_discount: false // Percentage line discount
                        });
                    }
                    
                    addons.forEach(addon => {
                        if (addon && addonPriceMap.has(addon)) {
                            let addonCost = addonPriceMap.get(addon);
                            let addonQty = 1;
                            if (addon === "Express Lieferung (48h)") {
                                addonQty = totalSongs;
                            }
                            
                            // Map addons to specific Invoice Ninja Product Keys
                            const addonKey = addon === "Express Lieferung (48h)" ? "addon_express" : addon;
                            
                            lineItems.push({
                                product_key: addonKey,
                                notes: "Add-on",
                                cost: addonCost,
                                qty: addonQty
                            });
                        }
                    });
                    
                    const quotePayload = {
                        client_id: clientId,
                        line_items: lineItems
                    };
                    
                    // 3. Create Draft Quote
                    const quoteRes = await fetch(`${invoiceNinjaUrl}/api/v1/quotes`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-Api-Token': invoiceNinjaToken,
                            'X-Requested-With': 'XMLHttpRequest'
                        },
                        body: JSON.stringify(quotePayload)
                    });
                    
                    if (quoteRes.ok) {
                        const quoteData = await quoteRes.json();
                        quoteNumber = quoteData.data.number;
                        const quoteId = quoteData.data.id;
                        
                        // Construct the admin link
                        const baseUrl = invoiceNinjaUrl.endsWith('/') ? invoiceNinjaUrl.slice(0, -1) : invoiceNinjaUrl;
                        quoteUrl = `${baseUrl}/#/quotes/${quoteId}/edit`;
                    } else {
                        console.error("Failed to create quote:", await quoteRes.text());
                    }
                } else {
                    console.error("Failed to create client:", await clientRes.text());
                }
            } catch (err) {
                console.error("Invoice Ninja API error:", err);
            }
        }
        // --------------------------------

        const discordFormData = new FormData();
        const payload = {
            username: "Studio Bot",
            content: "🚀 **Neue Studio-Anfrage!**" + (quoteUrl ? `\n📄 [Angebots-Entwurf ansehen (${quoteNumber || 'Angebot'})](${quoteUrl})` : ""),
            embeds: [
                {
                    title: "Anfragedetails",
                    color: 9196287,
                    fields: [
                        { name: "👤 Name", value: name, inline: true },
                        { name: "📧 Email", value: email, inline: true },
                        { name: "💰 Preisvoranschlag", value: `${total}€`, inline: true },
                        { name: "🛠️ Paket", value: selectedPackage || "Kein Paket ausgewählt", inline: true },
                        { name: "🎵 Zusätzliche Songs", value: `${additionalSongs}`, inline: true },
                        { name: "➕ Add-ons", value: addons.length > 0 ? addons.join(", ") : "Keine ausgewählt" },
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
