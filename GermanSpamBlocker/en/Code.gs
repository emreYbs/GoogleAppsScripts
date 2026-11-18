/**
 * Gmail German Spam Blocker (v4 - English)
 * - Scans both Inbox and Spam folders.
 * - Exempts privacy/alias services (SimpleLogin, Proton Pass, Apple Hide My Email)
 *   from the random bot-address rule to prevent false positives.
 * - Never permanently deletes emails; safely moves matches to Trash.
 */

// ==================== SETTINGS ====================

// 1. Privacy / Alias Services (Exempt from the random bot-address rule)
const PRIVACY_SERVICE_DOMAINS = [
  "simplelogin.co",
  "simplelogin.com",
  "simplelogin.fr",
  "aleeas.com",
  "passmail.net",
  "passinbox.com",
  "privaterelay.appleid.com",
  "icloud.com"
];

// 2. Directly blocked Top-Level Domains (TLDs)
const BLOCKED_TLDS = [
  ".biz"
];

// 3. Exact Spam Patterns (Matching ANY SINGLE phrase triggers the filter)
const EXACT_SPAM_PATTERNS = [
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
];

// 4. Blocked Sender Names or Specific Domain Keywords
const BLOCKED_SENDERS = [
  "new match",
  "meetic",
  "online now",
  "loveciaty",
  "profinderlclubpartner",
  "osmartflirtoneconnect"
];

// 5. General German Keyword Pool (Used for scoring)
const GERMAN_KEYWORDS = [
  "sehr geehrte", "herzlichen glückwunsch", "gewinn", "konto", "bestätigen",
  "klicken sie", "zahlung", "rechnung", "dringend", "verifizierung",
  "kostenlos", "jetzt", "deiner nähe", "bereit", "schau", "chatten", "heißes"
];

// 6. Trusted Senders (Whitelist - completely bypasses all rules)
const WHITELIST_SENDERS = [
  // "trusted@example.com"
];

// 7. Minimum keyword matches required for the general German pool
const SCORE_THRESHOLD = 2;

// 8. Action to take on matched emails:
// "TRASH" -> Moves to Trash (recoverable for 30 days, safe)
// "LABEL" -> Does not move; applies a test label ("German-Spam-Test")
const ACTION_TYPE = "TRASH";

// ==================================================

function blockGermanSpam() {
  const searchQuery = "(in:inbox OR in:spam) newer_than:2d";
  const threads = GmailApp.search(searchQuery, 0, 50);

  let testLabel = null;
  if (ACTION_TYPE === "LABEL") {
    testLabel = GmailApp.getUserLabelByName("German-Spam-Test") ||
                GmailApp.createLabel("German-Spam-Test");
  }

  for (let i = 0; i < threads.length; i++) {
    const thread = threads[i];
    const messages = thread.getMessages();
    const lastMessage = messages[messages.length - 1];

    const rawSender = (lastMessage.getFrom() || "").toLowerCase();
    const cleanEmail = extractEmailAddress(rawSender);

    // Layer 0: Skip whitelisted senders completely
    if (containsAny(rawSender, WHITELIST_SENDERS)) {
      continue;
    }

    const subject = lastMessage.getSubject() || "";
    const body = lastMessage.getPlainBody() || "";
    const fullText = (subject + " " + body).toLowerCase();

    // Detection Layers
    const tldMatch = hasBlockedTld(cleanEmail);
    const senderMatch = containsAny(rawSender, BLOCKED_SENDERS);
    const exactPatternMatch = containsAny(fullText, EXACT_SPAM_PATTERNS);
    const score = calculateGermanScore(fullText);

    // Only apply random bot-address check if sender is NOT a privacy/alias service
    const isPrivacy = isPrivacyService(cleanEmail);
    const botAddressAndGerman = !isPrivacy && isRandomBotAddress(cleanEmail) && score >= 1;

    if (tldMatch || senderMatch || exactPatternMatch || botAddressAndGerman || score >= SCORE_THRESHOLD) {
      applyAction(thread, testLabel, subject, cleanEmail);
    }
  }
}

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
  return PRIVACY_SERVICE_DOMAINS.some(service =>
    domain === service.toLowerCase() || domain.endsWith("." + service.toLowerCase())
  );
}

/**
 * Checks if the email address ends with any TLD in BLOCKED_TLDS.
 */
function hasBlockedTld(emailAddress) {
  return BLOCKED_TLDS.some(tld => emailAddress.endsWith(tld.toLowerCase()));
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
  for (let j = 0; j < GERMAN_KEYWORDS.length; j++) {
    const word = GERMAN_KEYWORDS[j].toLowerCase();
    const regex = new RegExp("(^|[\\s.,!?;:()\"'\\-])" + word + "($|[\\s.,!?;:()\"'\\-])", "i");
    if (regex.test(text)) {
      score++;
    }
  }
  return score;
}

/**
 * Applies the configured ACTION_TYPE and logs the result.
 */
function applyAction(thread, testLabel, subject, cleanEmail) {
  if (ACTION_TYPE === "TRASH") {
    thread.moveToTrash();
    Logger.log("Moved to Trash [" + cleanEmail + "]: " + subject);
  } else if (ACTION_TYPE === "LABEL") {
    thread.addLabel(testLabel);
    Logger.log("Test label added [" + cleanEmail + "]: " + subject);
  }
}
