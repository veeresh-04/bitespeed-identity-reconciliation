import { PrismaClient, Contact } from "@prisma/client";

const prisma = new PrismaClient();

interface ConsolidatedContact {
  primaryContatctId: number;
  emails: string[];
  phoneNumbers: string[];
  secondaryContactIds: number[];
}

/**
 * Main identity reconciliation logic.
 *
 * 1. If no existing contacts match → create a new "primary" contact.
 * 2. If existing contacts found with matching email OR phone but request
 *    contains new information → create a "secondary" contact linked to primary.
 * 3. If the request links two separate primary contacts → the older one
 *    stays primary, the newer one (and its chain) becomes secondary.
 */
export async function consolidateContact(
  email?: string,
  phoneNumber?: string
): Promise<ConsolidatedContact> {
  // ── Step 1: Find all contacts matching either email or phone ──
  const matchingContacts = await findMatchingContacts(email, phoneNumber);

  // ── Case A: No matches → create a brand-new primary contact ──
  if (matchingContacts.length === 0) {
    const newContact = await prisma.contact.create({
      data: {
        email: email || null,
        phoneNumber: phoneNumber || null,
        linkPrecedence: "primary",
      },
    });
    return formatResponse(newContact.id);
  }

  // ── Step 2: Resolve all primary IDs involved ──
  const primaryIds = new Set<number>();
  for (const c of matchingContacts) {
    if (c.linkPrecedence === "primary") {
      primaryIds.add(c.id);
    } else if (c.linkedId !== null) {
      primaryIds.add(c.linkedId);
    }
  }

  // Fetch the actual primary contacts to determine oldest
  const primaryContacts = await prisma.contact.findMany({
    where: { id: { in: Array.from(primaryIds) } },
    orderBy: { createdAt: "asc" },
  });

  // The oldest primary is the winner
  const primaryContact = primaryContacts[0];

  // ── Case B: Two (or more) different primary contacts need merging ──
  if (primaryContacts.length > 1) {
    // All other primaries become secondary of the oldest
    for (let i = 1; i < primaryContacts.length; i++) {
      const demoted = primaryContacts[i];
      await prisma.contact.update({
        where: { id: demoted.id },
        data: {
          linkPrecedence: "secondary",
          linkedId: primaryContact.id,
          updatedAt: new Date(),
        },
      });
      // Re-link all secondaries of the demoted primary
      await prisma.contact.updateMany({
        where: { linkedId: demoted.id },
        data: {
          linkedId: primaryContact.id,
          updatedAt: new Date(),
        },
      });
    }
  }

  // ── Step 3: Check if request brings genuinely new information ──
  const allLinkedContacts = await prisma.contact.findMany({
    where: {
      OR: [{ id: primaryContact.id }, { linkedId: primaryContact.id }],
    },
  });

  const existingEmails = new Set(
    allLinkedContacts.map((c: Contact) => c.email).filter(Boolean)
  );
  const existingPhones = new Set(
    allLinkedContacts.map((c: Contact) => c.phoneNumber).filter(Boolean)
  );

  const hasNewEmail = email && !existingEmails.has(email);
  const hasNewPhone = phoneNumber && !existingPhones.has(phoneNumber);

  // Also check if there's an exact duplicate row already
  const exactMatch = allLinkedContacts.some(
    (c: Contact) =>
      c.email === (email || null) &&
      c.phoneNumber === (phoneNumber || null)
  );

  if ((hasNewEmail || hasNewPhone) && !exactMatch) {
    await prisma.contact.create({
      data: {
        email: email || null,
        phoneNumber: phoneNumber || null,
        linkedId: primaryContact.id,
        linkPrecedence: "secondary",
      },
    });
  }

  // ── Step 4: Build and return the consolidated response ──
  return formatResponse(primaryContact.id);
}

/**
 * Find all contacts that match an email OR a phoneNumber.
 */
async function findMatchingContacts(email?: string, phoneNumber?: string) {
  const conditions: any[] = [];
  if (email) conditions.push({ email });
  if (phoneNumber) conditions.push({ phoneNumber });

  if (conditions.length === 0) return [];

  return prisma.contact.findMany({
    where: {
      OR: conditions,
      deletedAt: null,
    },
  });
}

/**
 * Given a primary contact ID, fetch the entire linked group and
 * format the response payload.
 */
async function formatResponse(primaryId: number): Promise<ConsolidatedContact> {
  const allContacts = await prisma.contact.findMany({
    where: {
      OR: [{ id: primaryId }, { linkedId: primaryId }],
      deletedAt: null,
    },
    orderBy: { createdAt: "asc" },
  });

  const primary = allContacts.find((c: Contact) => c.id === primaryId)!;
  const secondaries = allContacts.filter((c: Contact) => c.id !== primaryId);

  // Collect unique emails — primary's email first
  const emails: string[] = [];
  if (primary.email) emails.push(primary.email);
  for (const c of secondaries) {
    if (c.email && !emails.includes(c.email)) {
      emails.push(c.email);
    }
  }

  // Collect unique phone numbers — primary's phone first
  const phoneNumbers: string[] = [];
  if (primary.phoneNumber) phoneNumbers.push(primary.phoneNumber);
  for (const c of secondaries) {
    if (c.phoneNumber && !phoneNumbers.includes(c.phoneNumber)) {
      phoneNumbers.push(c.phoneNumber);
    }
  }

  return {
    primaryContatctId: primaryId,
    emails,
    phoneNumbers,
    secondaryContactIds: secondaries.map((c: Contact) => c.id),
  };
}
