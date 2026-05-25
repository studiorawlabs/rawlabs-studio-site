export const prerender = false;

import { readFileSync, appendFileSync } from 'fs';
import { join } from 'path';
import nodemailer from 'nodemailer';

function logDebug(msg) {
    try {
        appendFileSync(join(process.cwd(), 'contact_debug.log'), `[${new Date().toISOString()}] ${msg}\n`, 'utf-8');
    } catch (e) { }
}

function loadEnvFile() {
    try {
        const envPath = join(process.cwd(), '.env');
        logDebug(`loadEnvFile: reading path ${envPath}`);
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
        logDebug(`loadEnvFile: successfully read variables: ${Object.keys(vars).join(', ')}`);
        return vars;
    } catch (e) {
        logDebug(`loadEnvFile error: ${e.message}`);
        return {};
    }
}

export const POST = async ({ request }) => {
    let name, email, message, website, formToken, songFile, selectedPackage, addons, additionalSongs;
    let isB2b, companyName, vatNumber, street, zip, city, country;

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
        isB2b = data.get("is_b2b") === "on";
        companyName = data.get("company_name");
        vatNumber = data.get("vat_number");
        street = data.get("street");
        zip = data.get("zip");
        city = data.get("city");
        country = data.get("country") || "DE";
    } catch (e) {
        return new Response(
            JSON.stringify({ message: "Ungültige Anfrage (FormData Fehler)." }),
            { status: 400, headers: { "Content-Type": "application/json" } }
        );
    }

    logDebug(`POST contact API called. Name: ${name}, Email: ${email}, Website (honeypot): ${website}, formToken: ${formToken}`);

    // SPAM PROTECTION
    const timeDiff = formToken ? Date.now() - parseInt(formToken) : null;
    const isSpam = website || (formToken && timeDiff < 3000);
    if (isSpam) {
        logDebug(`Spam detected! website: ${!!website}, timeDiff: ${timeDiff}ms`);
        return new Response(JSON.stringify({ message: "Erfolgreich gesendet!" }), { status: 200, headers: { "Content-Type": "application/json" } });
    }

    if (!name || !email || !message) {
        logDebug("Validation error: name, email, or message is empty.");
        return new Response(JSON.stringify({ message: "Bitte alle Felder ausfüllen!" }), { status: 400, headers: { "Content-Type": "application/json" } });
    }

    const env = loadEnvFile();
    const discordUrl = import.meta.env.DISCORD_WEBHOOK_URL || process.env.DISCORD_WEBHOOK_URL || env.DISCORD_WEBHOOK_URL;
    const invoiceNinjaUrl = import.meta.env.INVOICE_NINJA_URL || process.env.INVOICE_NINJA_URL || env.INVOICE_NINJA_URL;
    const invoiceNinjaToken = import.meta.env.INVOICE_NINJA_TOKEN || process.env.INVOICE_NINJA_TOKEN || env.INVOICE_NINJA_TOKEN;
    const invoiceNinjaUserId = import.meta.env.INVOICE_NINJA_USER_ID || process.env.INVOICE_NINJA_USER_ID || env.INVOICE_NINJA_USER_ID;

    const smtpHost = import.meta.env.SMTP_HOST || process.env.SMTP_HOST || env.SMTP_HOST;
    const smtpPort = import.meta.env.SMTP_PORT || process.env.SMTP_PORT || env.SMTP_PORT;
    const smtpUser = import.meta.env.SMTP_USER || process.env.SMTP_USER || env.SMTP_USER;
    const smtpPass = import.meta.env.SMTP_PASS || process.env.SMTP_PASS || env.SMTP_PASS;
    const smtpFrom = import.meta.env.SMTP_FROM || process.env.SMTP_FROM || env.SMTP_FROM;

    logDebug(`SMTP variables evaluated: host=${smtpHost}, port=${smtpPort}, user=${smtpUser}, passLength=${smtpPass ? smtpPass.length : 0}, from=${smtpFrom}`);

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
                // Map ISO country code to Invoice Ninja country numeric ID
                const countryIdMap = {
                    "AT": 40,
                    "DE": 276,
                    "CH": 756,
                    "GB": 826,
                    "US": 840
                };
                const countryId = countryIdMap[country] || 276; // Default to Germany (276)

                // 1. Create Client
                const clientPayload = {};

                if (isB2b && companyName) {
                    // For business accounts, the company name is the primary client name in Invoice Ninja
                    clientPayload.name = companyName;
                    clientPayload.classification = "business";
                    // Split the name of the contact person into first/last name
                    const nameParts = (name || "").trim().split(/\s+/);
                    const firstName = nameParts[0] || "";
                    const lastName = nameParts.slice(1).join(" ") || "";
                    clientPayload.contacts = [{
                        first_name: firstName,
                        last_name: lastName,
                        email: email
                    }];
                } else {
                    // For individuals, the customer's name is the primary name
                    clientPayload.name = name;
                    clientPayload.classification = "individual";
                    clientPayload.contacts = [{ email: email }];
                }

                // Map address fields if provided
                if (street) clientPayload.address1 = street;
                if (zip) clientPayload.postal_code = zip;
                if (city) clientPayload.city = city;
                clientPayload.country_id = countryId;

                if (vatNumber) {
                    clientPayload.vat_number = vatNumber;
                }

                if (invoiceNinjaUserId) {
                    clientPayload.assigned_user_id = invoiceNinjaUserId;
                }

                const clientRes = await fetch(`${invoiceNinjaUrl}/api/v1/clients`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Api-Token': invoiceNinjaToken,
                        'X-Requested-With': 'XMLHttpRequest'
                    },
                    body: JSON.stringify(clientPayload)
                });

                if (clientRes.ok) {
                    const clientData = await clientRes.json();
                    const clientId = clientData.data.id;

                    // 2. Prepare Line Items
                    const lineItems = [];

                    // Map packages to specific Invoice Ninja Product Keys
                    const productKeyMap = new Map([
                        ["Raw Labs Essentials", "Essential"],
                        ["Raw Labs Advanced", "Advanced"],
                        ["Raw Labs Ultimate", "Ultimate"]
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
                            quantity: totalSongs,
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
                            const addonKey = addon === "Express Lieferung (48h)" ? "Add On: Express Lieferung" : addon;

                            lineItems.push({
                                product_key: addonKey,
                                notes: "Add-on",
                                cost: addonCost,
                                quantity: addonQty
                            });
                        }
                    });

                    const quotePayload = {
                        client_id: clientId,
                        line_items: lineItems
                    };
                    if (invoiceNinjaUserId) {
                        quotePayload.assigned_user_id = invoiceNinjaUserId;
                    }

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

                        // Construct the direct PDF link (bypasses Flutter SPA routing issues)
                        const baseUrl = invoiceNinjaUrl.endsWith('/') ? invoiceNinjaUrl.slice(0, -1) : invoiceNinjaUrl;
                        quoteUrl = `${baseUrl}/quotes/${quoteId}/pdf`;
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

        // --- SEND VALIDATION EMAIL ---
        if (smtpHost && smtpUser && smtpPass) {
            logDebug(`Attempting to send validation email to ${email}...`);
            try {
                const transporter = nodemailer.createTransport({
                    host: smtpHost,
                    port: parseInt(smtpPort || "465"),
                    secure: parseInt(smtpPort || "465") === 465,
                    auth: {
                        user: smtpUser,
                        pass: smtpPass
                    }
                });

                const currentYear = new Date().getFullYear();
                const defaultFrom = '"Raw ' + 'Labs" <info' + '@rawlabs.studio>';
                const defaultInvoiceUrl = 'https://' + 'invoice.' + 'rawlabs.studio';
                const logoUrl = `${(invoiceNinjaUrl || defaultInvoiceUrl).replace(/\/$/, '')}/storage/fJQ1Z4sgyfCpV2h8mn8hV0DSO9wDDBgq/KQK4LinfTcdhQciuIFxBUbIRLUIbysUHKXxMhv0g.png`;
                const mailOptions = {
                    from: smtpFrom || defaultFrom,
                    to: email,
                    subject: "Deine Anfrage bei Raw Labs",
                    text: `Hallo ${name || ""},\n\nVielen Dank für deine Anfrage! Wir haben deine Nachricht erhalten und schauen uns dein Projekt schnellstmöglich an.\n\nWir melden uns in Kürze bei dir, damit es weitergehen kann.\n\nWenn du noch Fragen hast oder etwas hinzufügen willst, antworte gerne einfach auf diese E-Mail oder sende uns eine E-Mail an info@rawlabs.studio\n\nBeste Grüße,\nDein Team von Raw Labs\nhttps://rawlabs.studio`,
                    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Deine Anfrage bei Raw Labs</title>
  <style>
    body {
      font-family: 'roboto', Arial, Helvetica, sans-serif;
      margin: 0;
      padding: 0;
      background-color: #f4f4f4;
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f4; font-family: 'roboto', Arial, Helvetica, sans-serif;">
  <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; margin: 40px auto; background-color: #ffffff;">
    <tbody>
      <!-- Header with Logo -->
      <tr>
        <td align="center" style="padding: 20px 20px 0 20px;">
          <div style="border: 1px solid #c2c2c2; border-bottom: none; padding-bottom: 10px; border-top-left-radius: 3px; border-top-right-radius: 3px; padding-top: 10px;">
            <img src="${logoUrl}" alt="Raw Labs" border="0" style="display: block; width: auto; max-width: 300px; max-height: 100px; height: auto; margin: 0 auto;">
          </div>
        </td>
      </tr>
      
      <!-- Content Section -->
      <tr>
        <td style="padding: 0 20px;">
          <div style="border: 1px solid #c2c2c2; border-top: none; border-bottom: none; padding: 20px; text-align: center; color: #2e2e2e; font-size: 15px; line-height: 1.6;" id="content">
            <div style="padding-top: 10px;"></div>
            
            <p style="font-size: 15px; color: #2e2e2e; font-family: 'roboto', Arial, Helvetica, sans-serif;">Hallo ${name || ""},<br><br>vielen Dank für deine Anfrage! Wir haben deine Nachricht erhalten und schauen uns dein Projekt schnellstmöglich an.<br><br>Wir melden uns in Kürze bei dir, damit es weitergehen kann.<br><br>Wenn du noch Fragen hast oder etwas hinzufügen willst, antworte gerne einfach auf diese E-Mail oder sende uns eine E-Mail an <a href="mailto:info@rawlabs.studio" style="color: #6046c9; text-decoration: underline;">info@rawlabs.studio</a></p>
            
            <div class="center">
              <!--[if (gte mso 9)|(IE)]>
              <table align="center" cellspacing="0" cellpadding="0" style="width: 600px;">
                  <tr>
                  <td align="center" valign="top">
                      <![endif]-->
                      <table align="center" border="0" cellpadding="0" cellspacing="0" role="presentation">
                      <tbody><tr>
                      <td align="center" class="new_button" style="border-radius: 2px; background-color: #6046c9">
                          <a href="https://rawlabs.studio" target="_blank" class="new_button" style="text-decoration: none; border: 1px solid #6046c9; display: inline-block; border-radius: 2px; padding-top: 15px; padding-bottom: 15px; padding-left: 25px; padding-right: 25px; font-size: 20px; color: #fff">
                          <span label="cta button">Website besuchen</span>
                          </a>
                      </td>
                      </tr>
                      </tbody>
                      </table>
              <!--[if (gte mso 9)|(IE)]>
                  </td>
                  </tr>
              </table>
              <![endif]-->
            </div>
            
            <div>
              <a href="#" style="display: inline-block; background-color: #6046c9; color: #ffffff; text-transform: uppercase; letter-spacing: 2px; text-decoration: none; font-size: 13px; font-weight: 600;"></a>
            </div>
          </div>
        </td>
      </tr>
      
      <!-- Divider -->
      <tr>
        <td height="0" style="padding: 0 20px;">
          <div style="border: 1px solid #c2c2c2; border-top: none; border-bottom: none; padding: 5px; text-align: center;"></div>
        </td>
      </tr>
      
      <!-- Footer Info -->
      <tr>
        <td style="padding: 0 20px;">
          <div style="text-align: center; padding-top: 10px; padding-bottom: 25px; background-color: #f9f9f9; border: 1px solid #c2c2c2; border-top: none; border-bottom-color: #f9f9f9;">
            <p style="font-size: 15px; color: #2e2e2e; font-family: 'roboto', Arial, Helvetica, sans-serif; font-weight: 500; margin-bottom: 0;">
              Raw Labs GbR
            </p>
            <p style="font-size: 15px; color: #2e2e2e; font-family: 'roboto', Arial, Helvetica, sans-serif; font-weight: 500; margin-top: 5px; margin-bottom: 0;">
              https://rawlabs.studio
            </p>
          </div>
        </td>
      </tr>
      
      <!-- Copyright Footer -->
      <tr>
        <td bgcolor="#242424" style="padding: 0 20px;">
          <div style="padding-top: 10px; padding-bottom: 10px; background-color: #242424; border: 1px solid #c2c2c2; border-top-color: #242424; border-bottom-color: #242424;">
            <p style="text-align: center; color: #ffffff; font-size: 10px; font-family: Verdana, Geneva, Tahoma, sans-serif; margin: 0;">
              &copy; ${currentYear} Raw Labs. Alle Rechte vorbehalten.
            </p>
          </div>
        </td>
      </tr>
    </tbody>
  </table>
</body>
</html>
`
                };

                const mailInfo = await transporter.sendMail(mailOptions);
                logDebug(`Validation email sent successfully! MessageID: ${mailInfo.messageId}`);
            } catch (mailErr) {
                logDebug(`Failed to send validation email: ${mailErr.message}\nStack: ${mailErr.stack}`);
                console.error("Failed to send validation email:", mailErr);
                // We do not throw here, as we still want to return a success response for the form submission
            }
        } else {
            logDebug(`Skipped email sending: host, user, or pass is missing.`);
        }

        return new Response(JSON.stringify({ message: "Erfolgreich gesendet!" }), { status: 200, headers: { "Content-Type": "application/json" } });
    } catch (error) {
        return new Response(JSON.stringify({ message: `Senden fehlgeschlagen: ${error.message}` }), { status: 500, headers: { "Content-Type": "application/json" } });
    }
};
