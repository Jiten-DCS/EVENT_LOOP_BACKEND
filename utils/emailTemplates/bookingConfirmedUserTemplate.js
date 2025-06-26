const bookingConfirmedUserTemplate = ({
  userName,
  serviceTitle,
  amount,
  companyLogoUrl
}) => {
  return `
    <div style="font-family: Arial, sans-serif; background-color: #f8f8f8; padding: 20px;">
      <div style="max-width: 600px; margin: auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 6px rgba(0,0,0,0.1); overflow: hidden;">
        <div style="text-align: center; padding: 20px;">
          <img src="${companyLogoUrl}" alt="Company Logo" style="max-width: 150px;" />
        </div>
        <div style="padding: 30px; color: #333;">
          <h2 style="color: #27ae60;">Booking Confirmed</h2>
          <p>Hello ${userName || 'User'},</p>
          <p>Your booking for <strong>${serviceTitle}</strong> has been <strong>confirmed</strong>.</p>
          <p>We’ve successfully received your payment of <strong>₹${amount}</strong>.</p>
          <p style="margin-top: 25px;">You can view your bookings anytime in your dashboard.</p>
          <a href="https://yourplatform.com/user/bookings" style="display:inline-block;margin-top:20px;padding:10px 20px;background-color:#3498db;color:white;text-decoration:none;border-radius:5px;">
            View My Bookings
          </a>
          <p style="font-size: 14px; color: #777; margin-top: 30px;">Thanks for using our platform.</p>
          <p style="font-size: 14px; color: #555;">— The Team</p>
        </div>
        <div style="background-color: #f0f0f0; text-align: center; padding: 15px; font-size: 12px; color: #777;">
          © ${new Date().getFullYear()} Your Company Name. All rights reserved.
        </div>
      </div>
    </div>
  `;
};

module.exports = bookingConfirmedUserTemplate;
