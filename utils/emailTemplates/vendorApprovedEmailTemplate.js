const vendorApprovedEmailTemplate = ({ vendorName, companyLogoUrl }) => {
  return `
    <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #f4f4f4;">
      <div style="max-width: 600px; margin: auto; background-color: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 6px rgba(0,0,0,0.1);">
        
        <div style="text-align: center; padding: 20px;">
          <img src="${companyLogoUrl}" alt="Company Logo" style="max-width: 150px; height: auto;" />
        </div>
        
        <div style="padding: 30px; color: #333;">
          <h2 style="color: #2c3e50;">Congratulations, ${vendorName || 'Vendor'}!</h2>
          <p style="font-size: 16px;">
            We’re excited to let you know that your vendor account has been 
            <strong style="color: #27ae60;">approved</strong>.
          </p>
          <p style="font-size: 16px; margin-top: 15px;">
            You can now log in to your dashboard and start offering your services on our platform.
          </p>
          <a href="https://yourplatform.com/vendor/dashboard" style="display: inline-block; margin-top: 25px; padding: 12px 20px; background-color: #27ae60; color: #fff; text-decoration: none; border-radius: 6px;">
            Go to Dashboard
          </a>
          <p style="font-size: 14px; color: #555; margin-top: 30px;">We’re here to support you every step of the way.</p>
          <p style="font-size: 14px; color: #555;">— The Team</p>
        </div>

        <div style="background-color: #f0f0f0; text-align: center; padding: 15px; font-size: 12px; color: #777;">
          © ${new Date().getFullYear()} Your Company Name. All rights reserved.
        </div>
      </div>
    </div>
  `;
};

module.exports = vendorApprovedEmailTemplate;
