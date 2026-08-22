import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, email, company, message } = body;

    await resend.emails.send({
      from: "Levv AI <onboarding@resend.dev>",
      to: ["faraz.chatta@levvai.com"],
      subject: "New Request Demo Submission",
      html: `
        <h2>New Demo Request</h2>
        <p><strong>Name:</strong> ${name || "N/A"}</p>
        <p><strong>Email:</strong> ${email || "N/A"}</p>
        <p><strong>Company:</strong> ${company || "N/A"}</p>
        <p><strong>Message:</strong></p>
        <p>${message || "—"}</p>
      `,
    });

    return Response.json({ success: true });
  } catch (error) {
    console.error("Resend error:", error);
    return new Response("Email failed", { status: 500 });
  }
}
