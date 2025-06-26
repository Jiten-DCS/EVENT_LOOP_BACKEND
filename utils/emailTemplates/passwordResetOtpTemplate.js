const passwordResetOtpTemplate = ({ userName, otp, companyLogoUrl }) => {
  return `
    <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #f4f4f4;">
      <div style="max-width: 600px; margin: auto; background-color: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 6px rgba(0,0,0,0.1);">
        
        <div style="text-align: center; padding: 20px;">
          <img src="${companyLogoUrl}" alt="Company Logo" style="max-width: 150px; height: auto;" />
        </div>

        <div style="padding: 30px; color: #333;">
          <h2 style="color: #2c3e50;">Password Reset Request</h2>
          <p style="font-size: 16px;">
            Hello ${userName || 'User'},
          </p>
          <p style="font-size: 16px; margin-top: 10px;">
            You requested to reset your password. Please use the OTP code below to proceed.
          </p>
          <p style="font-size: 24px; font-weight: bold; text-align: center; margin: 30px 0; color: #e67e22;">
            ${otp}
          </p>
          <p style="font-size: 14px; color: #666; text-align: center;">
            This OTP is valid for the next <strong>10 minutes</strong>. Do not share it with anyone.
          </p>
          <p style="font-size: 14px; color: #999; margin-top: 40px;">
            If you did not request this, please ignore this email or contact support.
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

module.exports = passwordResetOtpTemplate;
