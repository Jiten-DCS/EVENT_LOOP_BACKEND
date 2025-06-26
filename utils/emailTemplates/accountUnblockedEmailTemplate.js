const accountUnblockedEmailTemplate = ({ userName, companyLogoUrl }) => {
  return `
    <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #f4f4f4;">
      <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); overflow: hidden;">
        <div style="text-align: center; padding: 20px;">
          <img src="${companyLogoUrl}" alt="Company Logo" style="max-width: 150px; height: auto;" />
        </div>
        <div style="padding: 30px; color: #333;">
          <h2 style="color: #2ecc71;">Hello ${userName || 'User'},</h2>
          <p style="font-size: 16px;">
            Great news! Your account has been 
            <strong style="color: #2ecc71;">unblocked</strong> by our admin team.
          </p>
          <p style="font-size: 16px; margin-top: 20px;">
            You can now log in and resume using the platform as usual.
          </p>
          <a href="https://yourplatform.com/login" style="display: inline-block; margin-top: 25px; padding: 10px 20px; background-color: #2ecc71; color: white; text-decoration: none; border-radius: 5px;">
            Login Now
          </a>
          <p style="font-size: 14px; color: #555; margin-top: 30px;">Thank you for your patience.</p>
          <p style="font-size: 14px; color: #555;">— The Team</p>
        </div>
        <div style="background-color: #f0f0f0; text-align: center; padding: 15px; font-size: 12px; color: #777;">
          © ${new Date().getFullYear()} Your Company Name. All rights reserved.
        </div>
      </div>
    </div>
  `;
};

module.exports = accountUnblockedEmailTemplate;
