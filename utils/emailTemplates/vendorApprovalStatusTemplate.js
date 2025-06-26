const vendorApprovalStatusTemplate = ({ vendorName, isApproved, companyLogoUrl }) => {
  const title = isApproved
    ? "Congratulations! Your Vendor Account is Approved"
    : "Vendor Account Rejected";

  const message = isApproved
    ? "We’re excited to inform you that your vendor account has been <strong style='color: #27ae60;'>approved</strong>. You can now log in and start offering your services."
    : "Unfortunately, your vendor account has been <strong style='color: #e74c3c;'>rejected</strong>. Please contact our support team for more details.";

  const actionBtn = isApproved
    ? `<a href="https://yourplatform.com/vendor/dashboard" style="display: inline-block; margin-top: 25px; padding: 12px 20px; background-color: #27ae60; color: #fff; text-decoration: none; border-radius: 6px;">
        Go to Dashboard
      </a>`
    : "";

  return `
    <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #f4f4f4;">
      <div style="max-width: 600px; margin: auto; background-color: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 6px rgba(0,0,0,0.1);">
        
        <div style="text-align: center; padding: 20px;">
          <img src="${companyLogoUrl}" alt="Company Logo" style="max-width: 150px; height: auto;" />
        </div>
        
        <div style="padding: 30px; color: #333;">
          <h2 style="color: ${isApproved ? '#27ae60' : '#e74c3c'};">${title}</h2>
          <p style="font-size: 16px;">
            Hello ${vendorName || 'Vendor'},
          </p>
          <p style="font-size: 16px; margin-top: 10px;">
            ${message}
          </p>
          ${actionBtn}
          <p style="font-size: 14px; color: #555; margin-top: 30px;">Thank you for your interest in working with us.</p>
          <p style="font-size: 14px; color: #555;">— The Team</p>
        </div>

        <div style="background-color: #f0f0f0; text-align: center; padding: 15px; font-size: 12px; color: #777;">
          © ${new Date().getFullYear()} Your Company Name. All rights reserved.
        </div>
      </div>
    </div>
  `;
};

module.exports = vendorApprovalStatusTemplate;
