const supportTicketStatusUpdateTemplate = ({
  userName,
  ticketId,
  subject,
  status,
  companyLogoUrl
}) => {
  const statusColor = {
    Open: "#3498db",
    InProgress: "#f39c12",
    Resolved: "#27ae60",
    Closed: "#7f8c8d",
    Rejected: "#e74c3c"
  }[status] || "#2c3e50";

  return `
    <div style="font-family: Arial, sans-serif; background-color: #f4f4f4; padding: 20px;">
      <div style="max-width: 600px; margin: auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 6px rgba(0,0,0,0.1);">
        
        <div style="text-align: center; padding: 20px;">
          <img src="${companyLogoUrl}" alt="Company Logo" style="max-width: 150px;" />
        </div>

        <div style="padding: 30px; color: #333;">
          <h2 style="color: #2c3e50;">Support Ticket Status Updated</h2>
          <p>Hello ${userName || 'User'},</p>

          <p>Your support ticket has been updated:</p>

          <p>
            <strong>Ticket ID:</strong> ${ticketId}<br />
            <strong>Subject:</strong> ${subject}<br />
            <strong>Status:</strong> 
            <span style="color: ${statusColor}; font-weight: bold;">${status}</span>
          </p>

          <p style="margin-top: 20px;">You can view the ticket status in your dashboard.</p>

          <a href="https://yourplatform.com/user/support-tickets" style="display:inline-block;margin-top:20px;padding:10px 20px;background-color:#3498db;color:white;text-decoration:none;border-radius:5px;">
            View My Tickets
          </a>

          <p style="font-size: 14px; color: #555; margin-top: 30px;">If you have further questions, feel free to reply to this email or reach out to our support team.</p>
          <p style="font-size: 14px; color: #555;">— The Support Team</p>
        </div>

        <div style="background-color: #f0f0f0; text-align: center; padding: 15px; font-size: 12px; color: #777;">
          © ${new Date().getFullYear()} Your Company Name. All rights reserved.
        </div>
      </div>
    </div>
  `;
};

module.exports = supportTicketStatusUpdateTemplate;
