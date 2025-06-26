const bookingConfirmedVendorTemplate = ({
  vendorName,
  customerName,
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
          <h2 style="color: #2c3e50;">New Booking Confirmed</h2>
          <p>Hello ${vendorName || 'Vendor'},</p>
          <p><strong>${customerName}</strong> has confirmed a booking for <strong>${serviceTitle}</strong>.</p>
          <p>Payment of <strong>₹${amount}</strong> has been successfully received.</p>
          <a href="https://yourplatform.com/vendor/bookings" style="display:inline-block;margin-top:20px;padding:10px 20px;background-color:#27ae60;color:white;text-decoration:none;border-radius:5px;">
            View Booking
          </a>
          <p style="font-size: 14px; color: #777; margin-top: 30px;">Please make the necessary arrangements for the scheduled service.</p>
          <p style="font-size: 14px; color: #555;">— The Team</p>
        </div>
        <div style="background-color: #f0f0f0; text-align: center; padding: 15px; font-size: 12px; color: #777;">
          © ${new Date().getFullYear()} Your Company Name. All rights reserved.
        </div>
      </div>
    </div>
  `;
};

module.exports = bookingConfirmedVendorTemplate;
