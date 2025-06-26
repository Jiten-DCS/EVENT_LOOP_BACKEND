const bookingStatusUpdateTemplate = ({
  userName,
  updatedBy,
  status,
  companyLogoUrl
}) => {
  const statusColor = {
    Confirmed: "#27ae60",
    Pending: "#f39c12",
    Cancelled: "#e74c3c",
    Rejected: "#e74c3c"
  }[status] || "#3498db";

  return `
    <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #f8f8f8;">
      <div style="max-width: 600px; margin: auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 6px rgba(0,0,0,0.1);">
        
        <div style="text-align: center; padding: 20px;">
          <img src="${companyLogoUrl}" alt="Company Logo" style="max-width: 150px; height: auto;" />
        </div>

        <div style="padding: 30px; color: #333;">
          <h2 style="color: #2c3e50;">Booking Status Updated</h2>
          <p style="font-size: 16px;">Hello ${userName || 'User'},</p>
          
          <p style="font-size: 16px; margin-top: 10px;">
            Your booking status has been updated to:
          </p>

          <div style="margin: 20px 0; font-size: 20px; font-weight: bold; color: ${statusColor}; text-align: center;">
            ${status}
          </div>

          <p style="font-size: 16px;">
            Updated by: <strong>${updatedBy}</strong>
          </p>

          <a href="https://yourplatform.com/user/bookings" style="display: inline-block; margin-top: 25px; padding: 10px 20px; background-color: #3498db; color: white; text-decoration: none; border-radius: 5px;">
            View My Bookings
          </a>

          <p style="font-size: 14px; color: #777; margin-top: 30px;">
            If you have any questions, feel free to reach out to our support team.
          </p>

          <p style="font-size: 14px; color: #555;">— The Team</p>
        </div>

        <div style="background-color: #f0f0f0; text-align: center; padding: 15px; font-size: 12px; color: #777;">
          © ${new Date().getFullYear()} Your Company Name. All rights reserved.
        </div>
      </div>
    </div>
  `;
};

module.exports = bookingStatusUpdateTemplate;
