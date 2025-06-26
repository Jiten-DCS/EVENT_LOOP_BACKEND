const accountBlockedEmailTemplate = ({ userName, reason, companyLogoUrl }) => {
  return `
    <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #f8f8f8;">
      <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); overflow: hidden;">
        <div style="text-align: center; padding: 20px;">
          <img src="${companyLogoUrl}" alt="Company Logo" style="max-width: 150px; height: auto;" />
        </div>
        <div style="padding: 30px; color: #333;">
          <h2 style="color: #c0392b;">Hello ${userName || 'User'},</h2>
          <p style="font-size: 16px;">
            We regret to inform you that your account has been 
            <strong style="color: #c0392b;">blocked</strong> by our admin team.
          </p>
          <p style="font-size: 16px; margin-top: 20px;">
            <strong>Reason:</strong> ${reason || 'No specific reason provided.'}
          </p>
          <p style="font-size: 15px; margin-top: 20px;">
            If you believe this was a mistake or would like to appeal, please contact our support team.
          </p>
          <p style="font-size: 14px; color: #555; margin-top: 30px;">We appreciate your understanding.</p>
          <p style="font-size: 14px; color: #555;">— The Team</p>
        </div>
        <div style="background-color: #f0f0f0; text-align: center; padding: 15px; font-size: 12px; color: #777;">
          © ${new Date().getFullYear()} Your Company Name. All rights reserved.
        </div>
      </div>
    </div>
  `;
};

module.exports = accountBlockedEmailTemplate;
