import axios from "axios";

const waClient = axios.create({
  baseURL: `https://graph.facebook.com/v19.0/${process.env.WA_PHONE_NUMBER_ID}/messages`,
  headers: {
    Authorization: `Bearer ${process.env.WA_ACCESS_TOKEN}`,
    "Content-Type": "application/json",
  },
});

function formatPhone(phone) {
  const cleaned = phone.replace(/\D/g, "");
  return cleaned.startsWith("91") ? cleaned : `91${cleaned}`;
}

export const sendReceipt = async (phone, bill) => {
  const { invoiceNo, total, customerName } = bill;

  console.log("here");

  const message = `🧾 *Family Super Mart*
Thank you, ${customerName || "Customer"}!

*Invoice:* #${invoiceNo}
*Total:* ₹${total.toFixed(2)}

Visit us again! 🙏`;

  const res = await waClient.post("", {
    messaging_product: "whatsapp",
    to: formatPhone(phone),
    type: "template",
    template: {
      name: "hello_world",
      language: { code: "en_US" },
    },
  });
  console.log("message sent ", res.data);

  return res.data;
};

export const sendLuckyDraw = async (
  phone,
  { customerName, ticketNumbers, drawDate = "15-08-2026" },
) => {
  return await waClient.post("", {
    messaging_product: "whatsapp",
    to: formatPhone(phone),
    type: "template",
    template: {
      name: "lucky_draw_entry",
      language: { code: "en" },
      components: [
        {
          type: "body",
          parameters: [
            { type: "text", text: customerName || "Customer" },
            { type: "text", text: ticketNumbers.join(", ") },
            { type: "text", text: drawDate },
          ],
        },
      ],
    },
  });
};

export const openWhatsApp = (
  phone,
  { customerName, ticketNumbers, drawDate },
) => {
  const cleaned = phone.replace(/\D/g, "");
  const number = cleaned.startsWith("91") ? cleaned : `91${cleaned}`;

  const tickets = ticketNumbers.join(", ");

  const message = `🎉 *Lucky Draw Entry Confirmed, ${customerName}!*

Your ticket number(s): *${tickets}*
Draw Date: ${drawDate}

Good luck! 🍀
Family Super Mart`;

  const encoded = encodeURIComponent(message);
  window.open(`https://wa.me/${number}?text=${encoded}`, "_blank");
};
