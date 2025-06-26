const supportTicketConfirmationTemplate = ({
  name,
  ticketId,
  subject,
  companyLogoUrl
}) => {
  return `
    <div style="font-family: Arial, sans-serif; background-color: #f4f4f4; padding: 20px;">
      <div style="max-width: 600px; margin: auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 6px rgba(0,0,0,0.1);">
        
        <div style="text-align: center; padding: 20px;">
          <img src="${companyLogoUrl}" alt="Company Logo" style="max-width: 150px;" />
        </div>

        <div style="padding: 30px; color: #333;">
          <h2 style="color: #2c3e50;">Support Ticket Received</h2>
          <p>Hello ${name || 'Customer'},</p>

          <p>Thank you for reaching out to us. Your support ticket has been received and is currently being reviewed by our team.</p>

          <p style="margin-top: 20px;">
            <strong>Ticket ID:</strong> ${ticketId}<br />
            <strong>Subject:</strong> ${subject}
          </p>

          <p style="margin-top: 20px;">
            We'll get back to you as soon as possible.
          </p>

          <p style="font-size: 14px; color: #555; margin-top: 30px;">— The Support Team</p>
        </div>

        <div style="background-color: #f0f0f0; text-align: center; padding: 15px; font-size: 12px; color: #777;">
          © ${new Date().getFullYear()} Your Company Name. All rights reserved.
        </div>

      </div>
    </div>
  `;
};

module.exports = supportTicketConfirmationTemplate;
