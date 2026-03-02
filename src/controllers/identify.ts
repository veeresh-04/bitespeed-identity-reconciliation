import { Request, Response } from "express";
import { consolidateContact } from "../services/contactService";

interface IdentifyRequest {
  email?: string;
  phoneNumber?: string;
}

export async function identifyHandler(req: Request, res: Response): Promise<void> {
  try {
    const { email, phoneNumber } = req.body as IdentifyRequest;

    // Validate: at least one of email or phoneNumber must be provided
    if (!email && !phoneNumber) {
      res.status(400).json({
        error: "At least one of email or phoneNumber must be provided",
      });
      return;
    }

    // Normalize phoneNumber to string
    const phone = phoneNumber ? String(phoneNumber) : undefined;

    const result = await consolidateContact(email || undefined, phone);

    res.status(200).json({ contact: result });
  } catch (error) {
    console.error("Error in /identify:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}
