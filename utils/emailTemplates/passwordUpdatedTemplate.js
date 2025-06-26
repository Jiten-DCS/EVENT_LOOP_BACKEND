const passwordUpdatedTemplate = ({ userName, companyLogoUrl }) => {
  return `
    <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #f4f4f4;">
      <div style="max-width: 600px; margin: auto; background-color: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 6px rgba(0,0,0,0.1);">
        
        <div style="text-align: center; padding: 20px;">
          <img src="${companyLogoUrl}" alt="Company Logo" style="max-width: 150px; height: auto;" />
        </div>

        <div style="padding: 30px; color: #333;">
          <h2 style="color: #2c3e50;">Password Updated Successfully</h2>
          <p style="font-size: 16px;">
            Hello ${userName || 'User'},
          </p>
          <p style="font-size: 16px; margin-top: 10px;">
            Your password has been successfully updated.
          </p>
          <p style="font-size: 14px; color: #666; margin-top: 20px;">
            If you didn’t make this change, please contact our support team immediately to secure your account.
          </p>
          <p style="font-size: 14px; color: #555; margin-top: 30px;">— The Team</p>
        </div>

        <div style="background-color: #f0f0f0; text-align: center; padding: 15px; font-size: 12px; color: #777;">
          © ${new Date().getFullYear()} Your Company Name. All rights reserved.
        </div>
      </div>
    </div>
  `;
};

module.exports = passwordUpdatedTemplate;
