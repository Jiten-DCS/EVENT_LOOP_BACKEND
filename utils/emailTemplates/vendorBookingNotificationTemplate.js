const vendorBookingNotificationTemplate = ({
  vendorName,
  customerName,
  serviceTitle,
  date,
  companyLogoUrl
}) => {
  return `
    <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #f8f8f8;">
      <div style="max-width: 600px; margin: auto; background-color: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 6px rgba(0,0,0,0.1);">
        
        <div style="text-align: center; padding: 20px;">
          <img src="${companyLogoUrl}" alt="Company Logo" style="max-width: 150px; height: auto;" />
        </div>

        <div style="padding: 30px; color: #333;">
          <h2 style="color: #2c3e50;">New Booking Request</h2>
          <p style="font-size: 16px;">Hello ${vendorName || 'Vendor'},</p>
          
          <p style="font-size: 16px; margin-top: 15px;">
            You have received a new booking request from <strong>${customerName}</strong> for 
            <strong>${serviceTitle}</strong> on <strong>${date}</strong>.
          </p>

          <p style="font-size: 16px; margin-top: 15px; color: #e67e22;">
            Note: Payment is still pending.
          </p>

          <a href="https://yourplatform.com/vendor/dashboard" style="display: inline-block; margin-top: 25px; padding: 12px 20px; background-color: #3498db; color: white; text-decoration: none; border-radius: 5px;">
            View Booking in Dashboard
          </a>

          <p style="font-size: 14px; color: #555; margin-top: 30px;">We’ll notify you once payment is confirmed.</p>
          <p style="font-size: 14px; color: #555;">— The Team</p>
        </div>

        <div style="background-color: #f0f0f0; text-align: center; padding: 15px; font-size: 12px; color: #777;">
          © ${new Date().getFullYear()} Your Company Name. All rights reserved.
        </div>
      </div>
    </div>
  `;
};

module.exports = vendorBookingNotificationTemplate;
