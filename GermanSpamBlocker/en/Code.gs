/**
 * Gmail German Dating Spam Blocker (with Conflict-Safe & Live Logging)
 * 
 * PURPOSE:
 * Scans recent emails in Inbox and Spam folders, detects German dating/phishing
 * spam patterns, and safely moves matches to Trash.
 */

// ==================== SECTION 1: SETTINGS ====================
// All settings are grouped inside a single 'var SPAM_SETTINGS' object.
// This prevents 'SyntaxError: Identifier has already been declared' errors.

var SPAM_SETTINGS = {
  // Maximum number of email threads to scan per execution
  MAX_THREADS: 25,

  // Minimum keyword matches required for the general German pool
  SCORE_THRESHOLD: 2,

  // Action to apply on caught emails: "TRASH" (Move to Trash) or "LABEL" (Test mode)
  ACTION_TYPE: "TRASH",

  // Privacy / Alias Services (Exempt from the random bot-address rule)
  PRIVACY_SERVICE_DOMAINS: [
    "simplelogin.co",
    "simplelogin.com",
    "simplelogin.fr",
    "aleeas.com",
    "passmail.net",
    "passinbox.com",
    "privaterelay.appleid.com",
    "icloud.com"
  ],

  // Directly blocked Top-Level Domains (TLDs)
  BLOCKED_TLDS: [
    ".biz"
  ],

  // Exact Spam Patterns (Matching ANY SINGLE phrase triggers the filter)
  EXACT_SPAM_PATTERNS: [
    "singles in deiner nähe",
    "sag hallo und schau, wohin es führt",
    "deine art mensch ist online",
    "heute jemanden ins auge gefasst",
    "sind heute online",
    "sind jetzt online",
    "bereit jetzt",
    "sie denkt gerade an dich",
    "das beste fängt mit einem simplen hallo an",
    "echte singles in deiner nähe",
    "nimm, was dein ist",
    "bitte date verantwortungsbewusst",
    "du erhältst diese e-mail im rahmen einer aktion",
    "sie hat dich für heute nacht ausgesucht",
    "wartet auf dich",
    "sie hat dir etwas heißes geschickt",
    "lass die smalltalk-apps",
    "leute in deiner nähe sind gerade online"
  ],

  // Blocked Sender Names or Specific Domain Keywords
  BLOCKED_SENDERS: [
    "new match",
    "meetic",
    "online now",
    "loveciaty",
    "profinderlclubpartner",
    "osmartflirtoneconnect"
  ],

  // General German Keyword Pool (Used for scoring)
  GERMAN_KEYWORDS: [
    "sehr geehrte", "herzlichen glückwunsch", "gewinn", "konto", "bestätigen",
    "klicken sie", "zahlung", "rechnung", "dringend", "verifizierung",
    "kostenlos", "jetzt", "deiner nähe", "bereit", "schau", "chatten", "heißes"
  ],

  // Trusted Senders (Whitelist - completely bypasses all rules)
  WHITELIST_SENDERS: [
    // "trusted@example.com"
  ]
};

// ==================== SECTION 2: MAIN FUNCTION ====================

/**
 * Main function triggered manually via 'Run' button or time-driven Triggers.
 */
function blockGermanSpam() {
  console.info("Scan started... Checking emails from the last 2 days.");

  // Search Inbox and Spam folders for threads newer than 2 days
  const searchQuery = "(in:inbox OR in:spam) newer_than:2d";
  const threads = GmailApp.search(searchQuery, 0, SPAM_SETTINGS.MAX_THREADS);

  console.info("Found " + threads.length + " email threads. Analyzing...");

  // Prepare test label if ACTION_TYPE is set to "LABEL"
  let testLabel = null;
  if (SPAM_SETTINGS.ACTION_TYPE === "LABEL") {
    testLabel = GmailApp.getUserLabelByName("German-Spam-Test") ||
                GmailApp.createLabel("German-Spam-Test");
  }

  let caughtCount = 0;

  // Iterate through each email thread
  for (let i = 0; i < threads.length; i++) {
    const thread = threads[i];
    const messages = thread.getMessages();
    const lastMessage = messages[messages.length - 1];

    const rawSender = (lastMessage.getFrom() || "").toLowerCase();
    const cleanEmail = extractEmailAddress(rawSender);

    // Layer 0: Skip whitelisted senders completely
    if (containsAny(rawSender, SPAM_SETTINGS.WHITELIST_SENDERS)) {
      continue;
    }

    const subject = lastMessage.getSubject() || "(No Subject)";
    const body = lastMessage.getPlainBody() || "";
    const fullText = (subject + " " + body).toLowerCase();

    // Layers 1-4: Filtering Checks
    const tldMatch = hasBlockedTld(cleanEmail);
    const senderMatch = containsAny(rawSender, SPAM_SETTINGS.BLOCKED_SENDERS);
    const exactPatternMatch = containsAny(fullText, SPAM_SETTINGS.EXACT_SPAM_PATTERNS);
    const score = calculateGermanScore(fullText);

    // Apply random bot-address check only if sender is NOT a privacy/alias service
    const isPrivacy = isPrivacyService(cleanEmail);
    const botAddressAndGerman = !isPrivacy && isRandomBotAddress(cleanEmail) && score >= 1;

    // Trigger action if any detection layer matches
    if (tldMatch || senderMatch || exactPatternMatch || botAddressAndGerman || score >= SPAM_SETTINGS.SCORE_THRESHOLD) {
      caughtCount++;

      // Determine exact reason for Execution Log visibility
      let reason = "Keyword Score (" + score + ")";
      if (tldMatch) reason = "Blocked TLD (.biz etc.)";
      else if (senderMatch) reason = "Blocked Sender";
      else if (exactPatternMatch) reason = "Exact Spam Pattern";
      else if (botAddressAndGerman) reason = "Bot Address + German";

      applyAction(thread, testLabel, subject, cleanEmail, reason);
    }
  }

  // Print final summary to the Execution Log
  console.info(
    "Scan complete! Analyzed: " + threads.length +
    " | Caught Spam: " + caughtCount +
    " | Clean/Normal: " + (threads.length - caughtCount)
  );
}

// ==================== SECTION 3: HELPER FUNCTIONS ====================

/**
 * Extracts 'user@domain.com' from 'Display Name <user@domain.com>'.
 */
function extractEmailAddress(fromHeader) {
  const match = fromHeader.match(/<([^>]+)>/);
  return (match ? match[1] : fromHeader).trim();
}

/**
 * Checks whether the sender domain belongs to a known privacy/alias service.
 */
function isPrivacyService(emailAddress) {
  const parts = emailAddress.split("@");
  if (parts.length !== 2) return false;

  const domain = parts[1].toLowerCase();
  return SPAM_SETTINGS.PRIVACY_SERVICE_DOMAINS.some(service =>
    domain === service.toLowerCase() || domain.endsWith("." + service.toLowerCase())
  );
}

/**
 * Checks if the email address ends with any TLD in BLOCKED_TLDS.
 */
function hasBlockedTld(emailAddress) {
  return SPAM_SETTINGS.BLOCKED_TLDS.some(tld =>
    emailAddress.endsWith(tld.toLowerCase())
  );
}

/**
 * Detects bot-generated random alphanumeric usernames (14+ chars, both letters and digits).
 */
function isRandomBotAddress(emailAddress) {
  const parts = emailAddress.split("@");
  if (parts.length !== 2) return false;

  const username = parts[0];
  const botRegex = /^(?=.*[a-z])(?=.*\d)[a-z0-9]{14,}$/;
  return botRegex.test(username);
}

/**
 * Checks if any string in the list appears in the target text.
 */
function containsAny(text, list) {
  return list.some(phrase => text.includes(phrase.toLowerCase()));
}

/**
 * Counts whole-word matches from GERMAN_KEYWORDS to avoid partial-word false positives.
 */
function calculateGermanScore(text) {
  let score = 0;
  const keywords = SPAM_SETTINGS.GERMAN_KEYWORDS;
  for (let j = 0; j < keywords.length; j++) {
    const word = keywords[j].toLowerCase();
    const regex = new RegExp("(^|[\\s.,!?;:()\"'\\-])" + word + "($|[\\s.,!?;:()\"'\\-])", "i");
    if (regex.test(text)) {
      score++;
    }
  }
  return score;
}

/**
 * Applies the configured ACTION_TYPE and logs the exact reason.
 */
function applyAction(thread, testLabel, subject, cleanEmail, reason) {
  if (SPAM_SETTINGS.ACTION_TYPE === "TRASH") {
    thread.moveToTrash();
    console.log("🗑️ Moved to Trash [" + reason + "] -> Sender: " + cleanEmail + " | Subject: " + subject);
  } else if (SPAM_SETTINGS.ACTION_TYPE === "LABEL") {
    thread.addLabel(testLabel);
    console.log("🏷️ Labeled [" + reason + "] -> Sender: " + cleanEmail + " | Subject: " + subject);
  }
}
